"use server";

import { getActiveGame, getAccountByPuuid, getRankedEntries } from "@/lib/riot-api";
import { loadStaticData, getChampionName, getSpellName } from "@/lib/game-checker";
import { API_BATCH_SIZE } from "@/lib/config";
import type { LiveGameData, LiveGameParticipant, RankInfo, Region } from "@/utils/types";

export async function fetchLiveGame(puuid: string, region: Region = "eun1"): Promise<{ data: LiveGameData; ddVersion: string } | null> {
  const [game, ddVersion] = await Promise.all([
    getActiveGame(puuid, region),
    loadStaticData(),
  ]);

  if (!game) return null;

  // Resolve all participants' accounts and ranks in parallel (batched to avoid rate limit)
  const BATCH_SIZE = API_BATCH_SIZE;
  const participants: LiveGameParticipant[] = [];

  for (let i = 0; i < game.participants.length; i += BATCH_SIZE) {
    const batch = game.participants.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (p) => {
        let gameName = "???";
        let tagLine = "";
        let rank: RankInfo | null = null;

        try {
          const account = await getAccountByPuuid(p.puuid);
          gameName = account.gameName;
          tagLine = account.tagLine;
        } catch {
          // fallback to ???
        }

        try {
          const entries = await getRankedEntries(p.puuid, region);
          for (const entry of entries) {
            if (entry.queueType === "RANKED_SOLO_5x5") {
              rank = {
                tier: entry.tier as RankInfo["tier"],
                division: entry.rank as RankInfo["division"],
                lp: entry.leaguePoints,
                queueType: "RANKED_SOLO_5x5",
              };
              break;
            }
          }
        } catch {
          // no rank info
        }

        return {
          puuid: p.puuid,
          gameName,
          tagLine,
          championName: getChampionName(p.championId),
          teamId: p.teamId,
          spell1Name: getSpellName(p.spell1Id),
          spell2Name: getSpellName(p.spell2Id),
          rank,
        };
      })
    );
    participants.push(...batchResults);
  }

  return {
    data: {
      gameId: game.gameId,
      gameMode: game.gameMode,
      gameStartTime: game.gameStartTime,
      participants,
    },
    ddVersion,
  };
}
