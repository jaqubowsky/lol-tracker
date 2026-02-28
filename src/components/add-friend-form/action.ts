"use server";

import {
  getAccountByRiotId,
  getSummonerByPuuid,
  getRankedEntries,
  getChampionMastery,
  getMatchHistory,
  getMatch,
} from "@/lib/riot-api";
import { loadStaticData, getChampionName } from "@/lib/game-checker";
import type { Friend, Region, RankInfo, RecentMatch, ChampionMastery } from "@/utils/types";

export async function resolveFriend(
  gameName: string,
  tagLine: string,
  region: Region = "eun1"
): Promise<Friend> {
  try {
    return await _resolveFriend(gameName, tagLine, region);
  } catch (err) {
    if (err instanceof Error) {
      // Clean up Zod validation errors — show user-friendly message
      if (err.name === "ZodError" || err.message.includes("expected")) {
        throw new Error("Nieoczekiwana odpowiedź z serwera Riot — spróbuj ponownie");
      }
      throw err;
    }
    throw new Error("Błąd serwera — spróbuj ponownie");
  }
}

async function _resolveFriend(
  gameName: string,
  tagLine: string,
  region: Region
): Promise<Friend> {
  // Ensure static data is loaded for champion name resolution
  await loadStaticData();

  // Resolve account
  const account = await getAccountByRiotId(gameName, tagLine);

  // Get summoner data
  const summoner = await getSummonerByPuuid(account.puuid, region);

  // Get ranked entries
  const entries = await getRankedEntries(account.puuid, region);
  const soloEntry = entries.find((e) => e.queueType === "RANKED_SOLO_5x5");
  const flexEntry = entries.find((e) => e.queueType === "RANKED_FLEX_SR");
  const rankedEntry = soloEntry ?? flexEntry;
  const rank: RankInfo | null = rankedEntry
    ? {
        tier: rankedEntry.tier as RankInfo["tier"],
        division: rankedEntry.rank as RankInfo["division"],
        lp: rankedEntry.leaguePoints,
        queueType: rankedEntry.queueType as RankInfo["queueType"],
      }
    : null;

  // Get top 3 champion masteries
  const masteries = await getChampionMastery(account.puuid, 3, region);
  const topChampions: ChampionMastery[] = masteries.map((m) => ({
    championId: m.championId,
    championName: getChampionName(m.championId),
    championLevel: m.championLevel,
    championPoints: m.championPoints,
  }));

  // Get last 5 matches
  const matchIds = await getMatchHistory(account.puuid, 5);
  const recentMatches: RecentMatch[] = [];
  for (const matchId of matchIds) {
    try {
      const match = await getMatch(matchId);
      const participant = match.info.participants.find(
        (p) => p.puuid === account.puuid
      );
      if (participant) {
        recentMatches.push({
          win: participant.win,
          championName: participant.championName,
          kills: participant.kills,
          deaths: participant.deaths,
          assists: participant.assists,
          gameEndTimestamp: match.info.gameEndTimestamp,
        });
      }
    } catch {
      // Skip failed match fetches
    }
  }

  return {
    puuid: account.puuid,
    gameName: account.gameName,
    tagLine: account.tagLine,
    region,
    profileIconId: summoner.profileIconId,
    summonerLevel: summoner.summonerLevel,
    rank,
    inGame: false,
    gameInfo: null,
    recentMatches,
    topChampions,
    playingWith: [],
    lastSeen: recentMatches.length > 0
      ? Math.max(...recentMatches.map((m) => m.gameEndTimestamp))
      : null,
  };
}
