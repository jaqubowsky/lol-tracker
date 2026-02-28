"use server";

import { getMatchScoreboard, getRankedEntries } from "@/lib/riot-api";
import { loadStaticData } from "@/lib/game-checker";
import { API_BATCH_SIZE } from "@/lib/config";
import type { ScoreboardData, RankInfo, Region } from "@/utils/types";

export async function fetchScoreboard(
  matchId: string,
  region: Region = "eun1"
): Promise<{ data: ScoreboardData; ddVersion: string }> {
  const [ddVersion, match] = await Promise.all([
    loadStaticData(),
    getMatchScoreboard(matchId),
  ]);

  // Fetch ranks in batches to avoid rate limits
  const rawParticipants = match.info.participants;
  const ranks: (RankInfo | null)[] = new Array(rawParticipants.length).fill(null);

  for (let i = 0; i < rawParticipants.length; i += API_BATCH_SIZE) {
    const batch = rawParticipants.slice(i, i + API_BATCH_SIZE);
    const batchRanks = await Promise.all(
      batch.map(async (p) => {
        try {
          const entries = await getRankedEntries(p.puuid, region);
          for (const entry of entries) {
            if (entry.queueType === "RANKED_SOLO_5x5") {
              return {
                tier: entry.tier as RankInfo["tier"],
                division: entry.rank as RankInfo["division"],
                lp: entry.leaguePoints,
                queueType: "RANKED_SOLO_5x5" as const,
              };
            }
          }
        } catch {
          // no rank info
        }
        return null;
      })
    );
    for (let j = 0; j < batchRanks.length; j++) {
      ranks[i + j] = batchRanks[j];
    }
  }

  const participants = rawParticipants.map((p, idx) => ({
    puuid: p.puuid,
    championName: p.championName,
    champLevel: p.champLevel,
    summonerName: p.summonerName,
    riotIdGameName: p.riotIdGameName,
    riotIdTagline: p.riotIdTagline,
    teamId: p.teamId,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    totalMinionsKilled: p.totalMinionsKilled,
    neutralMinionsKilled: p.neutralMinionsKilled,
    totalDamageDealtToChampions: p.totalDamageDealtToChampions,
    goldEarned: p.goldEarned,
    visionScore: p.visionScore,
    item0: p.item0,
    item1: p.item1,
    item2: p.item2,
    item3: p.item3,
    item4: p.item4,
    item5: p.item5,
    item6: p.item6,
    win: p.win,
    rank: ranks[idx],
  }));

  return {
    data: {
      matchId,
      gameDuration: match.info.gameDuration,
      gameMode: match.info.gameMode,
      participants,
    },
    ddVersion,
  };
}
