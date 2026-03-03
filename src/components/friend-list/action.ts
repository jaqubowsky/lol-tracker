"use server";

import {
  loadStaticData,
  checkFriendGameStatus,
  detectParties,
  getChampionName,
} from "@/lib/game-checker";
import {
  getRankedEntries,
  getSummonerByPuuid,
  getMatchHistory,
  getMatch,
  getChampionMastery,
} from "@/lib/riot-api";
import { computePostScores } from "@/lib/post-score";
import { API_BATCH_SIZE_SMALL } from "@/lib/config";
import { RATE_LIMIT_MARKER } from "@/utils/rate-limit-event";
import type { Friend, Region, RankInfo, RecentMatch, ChampionMastery } from "@/utils/types";

async function refreshRank(puuid: string, region: Region = "eun1"): Promise<RankInfo | null> {
  const entries = await getRankedEntries(puuid, region);
  const soloEntry = entries.find((e) => e.queueType === "RANKED_SOLO_5x5");
  const flexEntry = entries.find((e) => e.queueType === "RANKED_FLEX_SR");
  const rankedEntry = soloEntry ?? flexEntry;
  if (!rankedEntry) return null;
  return {
    tier: rankedEntry.tier as RankInfo["tier"],
    division: rankedEntry.rank as RankInfo["division"],
    lp: rankedEntry.leaguePoints,
    queueType: rankedEntry.queueType as RankInfo["queueType"],
  };
}

async function refreshMatches(puuid: string): Promise<RecentMatch[]> {
  const matchIds = await getMatchHistory(puuid, 5);
  const recentMatches: RecentMatch[] = [];
  for (const matchId of matchIds) {
    try {
      const match = await getMatch(matchId);
      const participant = match.info.participants.find(
        (p) => p.puuid === puuid
      );
      if (participant) {
        // Compute POST Score for this match
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

        recentMatches.push({
          win: participant.win,
          championName: participant.championName,
          kills: participant.kills,
          deaths: participant.deaths,
          assists: participant.assists,
          gameEndTimestamp: match.info.gameEndTimestamp,
          postScore: playerScore?.postScore ?? 0,
        });
      }
    } catch {
      // Skip failed match fetches
    }
  }
  return recentMatches;
}

async function refreshChampions(puuid: string, region: Region = "eun1"): Promise<ChampionMastery[]> {
  const masteries = await getChampionMastery(puuid, 3, region);
  return masteries.map((m) => ({
    championId: m.championId,
    championName: getChampionName(m.championId),
    championLevel: m.championLevel,
    championPoints: m.championPoints,
  }));
}

function isRateLimitError(err: unknown): boolean {
  return err instanceof Error && err.message.includes(RATE_LIMIT_MARKER);
}

/**
 * Light poll — rank + game status only (2 API calls per friend).
 * Used by the 30s auto-refresh interval.
 * Processes friends in sequential batches to avoid hitting rate limits.
 */
export async function pollFriendsStatus(
  friends: Friend[]
): Promise<{ friends: Friend[]; ddVersion: string; rateLimited: boolean }> {
  const ddVersion = await loadStaticData();
  const updatedFriends: Friend[] = [];
  let rateLimited = false;

  for (let i = 0; i < friends.length; i += API_BATCH_SIZE_SMALL) {
    const batch = friends.slice(i, i + API_BATCH_SIZE_SMALL);
    const results = await Promise.all(
      batch.map(async (friend) => {
        try {
          const region = friend.region ?? "eun1";
          const [status, rank] = await Promise.all([
            checkFriendGameStatus(friend),
            refreshRank(friend.puuid, region),
          ]);
          return {
            ...friend,
            inGame: status.inGame,
            gameInfo: status.gameInfo,
            rank,
            lastSeen: status.inGame ? Date.now() : friend.lastSeen,
            rateLimited: false,
          };
        } catch (err) {
          if (isRateLimitError(err)) {
            rateLimited = true;
            return { ...friend, rateLimited: true };
          }
          return { ...friend };
        }
      })
    );
    updatedFriends.push(...results);
  }

  detectParties(updatedFriends);
  return { friends: updatedFriends, ddVersion, rateLimited };
}

/**
 * Full refresh — all visible data (summoner, matches, champions, rank, game status).
 * Used on page mount and manual refresh button.
 * Processes friends in sequential batches to avoid hitting rate limits.
 */
export async function fullRefreshFriends(
  friends: Friend[]
): Promise<{ friends: Friend[]; ddVersion: string; rateLimited: boolean }> {
  const ddVersion = await loadStaticData();
  const updatedFriends: Friend[] = [];
  let rateLimited = false;

  for (let i = 0; i < friends.length; i += API_BATCH_SIZE_SMALL) {
    const batch = friends.slice(i, i + API_BATCH_SIZE_SMALL);
    const results = await Promise.all(
      batch.map(async (friend) => {
        try {
          const region = friend.region ?? "eun1";
          const [status, rank, summoner, recentMatches, topChampions] =
            await Promise.all([
              checkFriendGameStatus(friend),
              refreshRank(friend.puuid, region),
              getSummonerByPuuid(friend.puuid, region),
              refreshMatches(friend.puuid),
              refreshChampions(friend.puuid, region),
            ]);
          const lastSeen = status.inGame
            ? Date.now()
            : recentMatches.length > 0
              ? Math.max(...recentMatches.map((m) => m.gameEndTimestamp))
              : friend.lastSeen;

          return {
            ...friend,
            inGame: status.inGame,
            gameInfo: status.gameInfo,
            rank,
            profileIconId: summoner.profileIconId,
            summonerLevel: summoner.summonerLevel,
            recentMatches,
            topChampions,
            lastSeen,
            rateLimited: false,
          };
        } catch (err) {
          if (isRateLimitError(err)) {
            rateLimited = true;
            return { ...friend, rateLimited: true };
          }
          // Preserve existing data on failure
          return { ...friend };
        }
      })
    );
    updatedFriends.push(...results);
  }

  detectParties(updatedFriends);
  return { friends: updatedFriends, ddVersion, rateLimited };
}
