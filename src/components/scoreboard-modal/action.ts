"use server";

import { getMatchScoreboard, getRankedEntries } from "@/lib/riot-api";
import { loadStaticData, getSpellName, getRuneIcon, getRuneName, getRuneTree, getItemInfo } from "@/lib/game-checker";
import { API_BATCH_SIZE } from "@/lib/config";
import type { ScoreboardData, RankInfo, ParticipantPerks, RuneTreeInfo, Region } from "@/utils/types";

export async function fetchScoreboard(
  matchId: string,
  region: Region = "eun1"
): Promise<{
  data: ScoreboardData;
  ddVersion: string;
  runeIconMap: Record<number, string>;
  runeNameMap: Record<number, string>;
  runeTreesData: Record<number, RuneTreeInfo>;
  itemDescMap: Record<number, string>;
}> {
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

  // Collect all used rune IDs and tree IDs
  const usedRuneIds = new Set<number>();
  const usedTreeIds = new Set<number>();
  const usedItemIds = new Set<number>();

  const participants = rawParticipants.map((p, idx) => {
    let perks: ParticipantPerks | null = null;
    if (p.perks && p.perks.styles.length >= 2) {
      const primary = p.perks.styles[0];
      const sub = p.perks.styles[1];
      perks = {
        primaryStyleId: primary.style,
        subStyleId: sub.style,
        primarySelections: primary.selections.map((s) => s.perk),
        subSelections: sub.selections.map((s) => s.perk),
        statOffense: p.perks.statPerks.offense,
        statFlex: p.perks.statPerks.flex,
        statDefense: p.perks.statPerks.defense,
      };
      usedRuneIds.add(primary.style);
      usedRuneIds.add(sub.style);
      usedTreeIds.add(primary.style);
      usedTreeIds.add(sub.style);
      for (const s of primary.selections) usedRuneIds.add(s.perk);
      for (const s of sub.selections) usedRuneIds.add(s.perk);
      if (p.perks.statPerks.offense) usedRuneIds.add(p.perks.statPerks.offense);
      if (p.perks.statPerks.flex) usedRuneIds.add(p.perks.statPerks.flex);
      if (p.perks.statPerks.defense) usedRuneIds.add(p.perks.statPerks.defense);
    }

    // Collect used item IDs
    const items = [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6];
    for (const id of items) {
      if (id > 0) usedItemIds.add(id);
    }

    return {
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
      spell1Name: getSpellName(p.summoner1Id),
      spell2Name: getSpellName(p.summoner2Id),
      perks,
    };
  });

  // Build maps
  const runeIconMap: Record<number, string> = {};
  const runeNameMap: Record<number, string> = {};
  for (const id of usedRuneIds) {
    const icon = getRuneIcon(id);
    if (icon) runeIconMap[id] = icon;
    const name = getRuneName(id);
    if (name !== "Unknown") runeNameMap[id] = name;
  }

  // Full tree data for used trees
  const runeTreesData: Record<number, RuneTreeInfo> = {};
  for (const treeId of usedTreeIds) {
    const tree = getRuneTree(treeId);
    if (tree) runeTreesData[treeId] = tree;
  }

  // Item descriptions for used items
  const itemDescMap: Record<number, string> = {};
  for (const id of usedItemIds) {
    const info = getItemInfo(id);
    if (info) itemDescMap[id] = `${info.name}\n${info.description}`;
  }

  return {
    data: {
      matchId,
      gameDuration: match.info.gameDuration,
      gameMode: match.info.gameMode,
      participants,
    },
    ddVersion,
    runeIconMap,
    runeNameMap,
    runeTreesData,
    itemDescMap,
  };
}
