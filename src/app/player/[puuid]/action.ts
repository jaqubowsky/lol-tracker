"use server";

import {
  getAccountByPuuid,
  getSummonerByPuuid,
  getRankedEntries,
  getMatchHistoryFiltered,
  getMatch,
  prefetchMatchCache,
  clearMatchPrefetch,
} from "@/lib/riot-api";
import { loadStaticData, getSpellName, getRuneIcon } from "@/lib/game-checker";
import { computePostScores } from "@/lib/post-score";
import { API_BATCH_SIZE, API_BATCH_SIZE_SMALL } from "@/lib/config";
import { getPlayerMatchIds, savePlayerMatches, type PlayerMatchEntry } from "@/lib/turso";
import type {
  PlayerDetail,
  RankInfo,
  RankedMatchDetail,
  QueueFilter,
  TimeRangeFilter,
  Region,
} from "@/utils/types";

function parseRankEntry(
  entry: { tier: string; rank: string; leaguePoints: number; queueType: string },
  queueType: string
): RankInfo | null {
  if (entry.queueType !== queueType) return null;
  return {
    tier: entry.tier as RankInfo["tier"],
    division: entry.rank as RankInfo["division"],
    lp: entry.leaguePoints,
    queueType: entry.queueType as RankInfo["queueType"],
  };
}

export async function fetchPlayerDetail(puuid: string, region: Region = "eun1"): Promise<PlayerDetail> {
  const [account, summoner, entries, ddVersion] = await Promise.all([
    getAccountByPuuid(puuid),
    getSummonerByPuuid(puuid, region),
    getRankedEntries(puuid, region),
    loadStaticData(),
  ]);

  let soloRank: RankInfo | null = null;
  let flexRank: RankInfo | null = null;

  for (const entry of entries) {
    const solo = parseRankEntry(entry, "RANKED_SOLO_5x5");
    if (solo) soloRank = solo;
    const flex = parseRankEntry(entry, "RANKED_FLEX_SR");
    if (flex) flexRank = flex;
  }

  return {
    puuid: account.puuid,
    gameName: account.gameName,
    tagLine: account.tagLine,
    profileIconId: summoner.profileIconId,
    summonerLevel: summoner.summonerLevel,
    soloRank,
    flexRank,
    ddVersion,
  };
}

function getQueueId(queue: QueueFilter): number | undefined {
  if (queue === "solo") return 420;
  if (queue === "flex") return 440;
  return undefined;
}

function getStartTime(timeRange: TimeRangeFilter): number | undefined {
  if (timeRange === "all") return undefined;
  const days = timeRange === "7d" ? 7 : timeRange === "14d" ? 14 : 30;
  return Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
}

export async function fetchRankedMatches(
  puuid: string,
  queue: QueueFilter = "all",
  timeRange: TimeRangeFilter = "30d",
  options: { start?: number; startTime?: number; endTime?: number } = {}
): Promise<{ matches: RankedMatchDetail[]; hasMore: boolean }> {
  await loadStaticData();
  const queueId = getQueueId(queue);
  const startTimeEpoch = options.startTime ?? getStartTime(timeRange);
  const count = 50;

  // Fetch fresh IDs from Riot + historical IDs from Turso in parallel
  const [riotMatchIds, tursoEntries] = await Promise.all([
    getMatchHistoryFiltered(puuid, {
      queue: queueId,
      startTime: startTimeEpoch,
      endTime: options.endTime,
      start: options.start,
      count,
      type: "ranked",
    }),
    options.start === undefined || options.start === 0
      ? getPlayerMatchIds(puuid, {
          queueId: queueId,
          startTime: startTimeEpoch,
          endTime: options.endTime,
        })
      : Promise.resolve([]),
  ]);

  const hasMore = riotMatchIds.length === count;

  // Merge Riot + Turso IDs, deduplicate
  const seen = new Set<string>();
  const allMatchIds: string[] = [];
  for (const id of riotMatchIds) {
    if (!seen.has(id)) {
      seen.add(id);
      allMatchIds.push(id);
    }
  }
  for (const entry of tursoEntries) {
    if (!seen.has(entry.matchId)) {
      seen.add(entry.matchId);
      allMatchIds.push(entry.matchId);
    }
  }

  if (allMatchIds.length === 0) return { matches: [], hasMore: false };

  // Pre-warm Turso cache: 1 batch query instead of N individual lookups
  const cachedMatchData = await prefetchMatchCache(allMatchIds);

  // Split IDs: cached ones can be processed in large parallel batches (no API calls),
  // uncached ones need small batches to respect Riot rate limits
  const cachedIds = allMatchIds.filter((id) => cachedMatchData.has(id));
  const uncachedIds = allMatchIds.filter((id) => !cachedMatchData.has(id));

  const results: (RankedMatchDetail | null)[] = [];
  const newTursoEntries: PlayerMatchEntry[] = [];

  // Process all cached matches in one big parallel batch (just JSON.parse, no network)
  const allIds = [...cachedIds, ...uncachedIds];
  const BATCH_SIZE = API_BATCH_SIZE;

  // Cached: process all at once; Uncached: batch by API_BATCH_SIZE
  const cachedSet = new Set(cachedIds);
  let i = 0;
  while (i < allIds.length) {
    // Grab as many consecutive cached IDs as possible, or one API batch of uncached
    let end = i;
    if (cachedSet.has(allIds[i])) {
      while (end < allIds.length && cachedSet.has(allIds[end])) end++;
    } else {
      end = Math.min(i + BATCH_SIZE, allIds.length);
    }
    const batch = allIds.slice(i, end);
    i = end;

    const batchResults = await Promise.all(
      batch.map(async (matchId) => {
        try {
          const match = await getMatch(matchId);
          const participant = match.info.participants.find((p) => p.puuid === puuid);
          if (!participant) return null;

          // Track for Turso index — index for ALL participants
          for (const p of match.info.participants) {
            newTursoEntries.push({
              puuid: p.puuid,
              matchId,
              queueId: match.info.queueId,
              gameCreation: match.info.gameCreation,
            });
          }

          // Same-team participants (same win value = same team), excluding self
          const teammates = match.info.participants
            .filter((p) => p.win === participant.win && p.puuid !== puuid);

          const teammatePuuids = teammates.map((p) => p.puuid);
          const teammateChampions: Record<string, string> = {};
          for (const p of teammates) {
            teammateChampions[p.puuid] = p.championName;
          }

          const items = [
            participant.item0, participant.item1, participant.item2,
            participant.item3, participant.item4, participant.item5,
            participant.item6,
          ];

          const spell1Name = getSpellName(participant.summoner1Id);
          const spell2Name = getSpellName(participant.summoner2Id);

          const primaryStyleId = participant.perks?.styles?.[0]?.style ?? 0;
          const subStyleId = participant.perks?.styles?.[1]?.style ?? 0;
          const primaryStyleIcon = primaryStyleId ? getRuneIcon(primaryStyleId) : "";
          const subStyleIcon = subStyleId ? getRuneIcon(subStyleId) : "";

          // Compute POST Scores for all participants in this match
          const scoreInputs = match.info.participants.map((mp) => ({
            puuid: mp.puuid,
            kills: mp.kills,
            deaths: mp.deaths,
            assists: mp.assists,
            totalMinionsKilled: mp.totalMinionsKilled ?? 0,
            neutralMinionsKilled: mp.neutralMinionsKilled ?? 0,
            totalDamageDealtToChampions: mp.totalDamageDealtToChampions,
            goldEarned: mp.goldEarned,
            visionScore: mp.visionScore,
            totalDamageDealtToObjectives: mp.totalDamageDealtToObjectives,
            timeCCingOthers: mp.timeCCingOthers,
            teamPosition: mp.teamPosition,
            individualPosition: mp.individualPosition,
            teamId: mp.teamId,
            win: mp.win,
          }));
          const scoreResults = computePostScores(scoreInputs, match.info.gameDuration, matchId);
          const playerScore = scoreResults.find((r) => r.puuid === puuid);

          return {
            matchId,
            win: participant.win,
            championName: participant.championName,
            kills: participant.kills,
            deaths: participant.deaths,
            assists: participant.assists,
            cs: (participant.totalMinionsKilled ?? 0) + (participant.neutralMinionsKilled ?? 0),
            queueId: match.info.queueId,
            gameCreation: match.info.gameCreation,
            gameDuration: match.info.gameDuration,
            teammatePuuids,
            teammateChampions,
            items,
            spell1Name,
            spell2Name,
            primaryStyleIcon,
            subStyleIcon,
            postScore: playerScore?.postScore ?? 0,
            postScoreRank: playerScore?.postScoreRank ?? 0,
            isMvp: playerScore?.isMvp ?? false,
            isAce: playerScore?.isAce ?? false,
          } satisfies RankedMatchDetail;
        } catch {
          return null;
        }
      })
    );
    results.push(...batchResults);
  }

  // Clean up prefetch cache
  clearMatchPrefetch();

  // Fire-and-forget: save match metadata to Turso for future visits
  // Entries include all 10 participants per match, so visiting one profile
  // pre-populates the index for every player in those games
  savePlayerMatches(newTursoEntries);

  const matches = results.filter((m): m is RankedMatchDetail => m !== null);
  matches.sort((a, b) => b.gameCreation - a.gameCreation);

  return { matches, hasMore };
}

/** Resolve a list of puuids to gameName#tagLine + profileIconId. Silently skips failures. */
export async function resolveAccountNames(
  puuids: string[],
  region: Region = "eun1"
): Promise<Record<string, { gameName: string; tagLine: string; profileIconId: number }>> {
  const result: Record<string, { gameName: string; tagLine: string; profileIconId: number }> = {};

  // Resolve in small batches to stay within rate limits
  const BATCH = API_BATCH_SIZE_SMALL;
  for (let i = 0; i < puuids.length; i += BATCH) {
    const batch = puuids.slice(i, i + BATCH);
    const settled = await Promise.all(
      batch.map(async (puuid) => {
        try {
          const [acc, summoner] = await Promise.all([
            getAccountByPuuid(puuid),
            getSummonerByPuuid(puuid, region),
          ]);
          return { puuid, gameName: acc.gameName, tagLine: acc.tagLine, profileIconId: summoner.profileIconId };
        } catch {
          return null;
        }
      })
    );
    for (const r of settled) {
      if (r) result[r.puuid] = { gameName: r.gameName, tagLine: r.tagLine, profileIconId: r.profileIconId };
    }
  }

  return result;
}
