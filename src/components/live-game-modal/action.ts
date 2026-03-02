"use server";

import { getActiveGame, getAccountByPuuid, getRankedEntries } from "@/lib/riot-api";
import { loadStaticData, getChampionName, getSpellName, getRuneIcon, getRuneName, getRuneTree } from "@/lib/game-checker";
import { API_BATCH_SIZE } from "@/lib/config";
import type { LiveGameData, LiveGameParticipant, RankInfo, ParticipantPerks, RuneTreeInfo, Region } from "@/utils/types";

export async function fetchLiveGame(puuid: string, region: Region = "eun1"): Promise<{
  data: LiveGameData;
  ddVersion: string;
  runeIconMap: Record<number, string>;
  runeNameMap: Record<number, string>;
  runeTreesData: Record<number, RuneTreeInfo>;
} | null> {
  const [game, ddVersion] = await Promise.all([
    getActiveGame(puuid, region),
    loadStaticData(),
  ]);

  if (!game) return null;

  const BATCH_SIZE = API_BATCH_SIZE;
  const participants: LiveGameParticipant[] = [];
  const usedRuneIds = new Set<number>();
  const usedTreeIds = new Set<number>();

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

        let perks: ParticipantPerks | null = null;
        if (p.perks && p.perks.perkIds.length >= 6) {
          perks = {
            primaryStyleId: p.perks.perkStyle,
            subStyleId: p.perks.perkSubStyle,
            primarySelections: p.perks.perkIds.slice(0, 4),
            subSelections: p.perks.perkIds.slice(4, 6),
            statOffense: p.perks.perkIds[6] ?? 0,
            statFlex: p.perks.perkIds[7] ?? 0,
            statDefense: p.perks.perkIds[8] ?? 0,
          };
          usedRuneIds.add(p.perks.perkStyle);
          usedRuneIds.add(p.perks.perkSubStyle);
          usedTreeIds.add(p.perks.perkStyle);
          usedTreeIds.add(p.perks.perkSubStyle);
          for (const id of p.perks.perkIds.slice(0, 9)) usedRuneIds.add(id);
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
          perks,
        };
      })
    );
    participants.push(...batchResults);
  }

  const runeIconMap: Record<number, string> = {};
  const runeNameMap: Record<number, string> = {};
  for (const id of usedRuneIds) {
    const icon = getRuneIcon(id);
    if (icon) runeIconMap[id] = icon;
    const name = getRuneName(id);
    if (name !== "Unknown") runeNameMap[id] = name;
  }

  const runeTreesData: Record<number, RuneTreeInfo> = {};
  for (const treeId of usedTreeIds) {
    const tree = getRuneTree(treeId);
    if (tree) runeTreesData[treeId] = tree;
  }

  return {
    data: {
      gameId: game.gameId,
      gameMode: game.gameMode,
      gameStartTime: game.gameStartTime,
      participants,
    },
    ddVersion,
    runeIconMap,
    runeNameMap,
    runeTreesData,
  };
}
