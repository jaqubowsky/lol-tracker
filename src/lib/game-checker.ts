import { DDRAGON_URL } from "./config";
import { getActiveGame } from "./riot-api";
import type { Friend, GameInfo } from "@/utils/types";

// Module-scope maps (populated from DDragon, cached via Next.js Data Cache)
let championMap: Record<number, string> = {};
let spellMap: Record<number, string> = {};
let cachedDdVersion: string | null = null;

// In-flight dedup so concurrent calls don't trigger multiple fetches
let ddLoadPromise: Promise<string> | null = null;

export async function loadStaticData(): Promise<string> {
  if (cachedDdVersion) return cachedDdVersion;

  if (ddLoadPromise) return ddLoadPromise;

  ddLoadPromise = _loadStaticData().finally(() => {
    ddLoadPromise = null;
  });
  return ddLoadPromise;
}

async function _loadStaticData(): Promise<string> {
  // Version list — revalidate every 4h (patches are ~biweekly)
  const versionsRes = await fetch(`${DDRAGON_URL}/api/versions.json`, {
    next: { revalidate: 14400 },
  });
  if (!versionsRes.ok) {
    throw new Error(`DDragon versions fetch failed: ${versionsRes.status}`);
  }
  const versions: string[] = await versionsRes.json();
  if (!versions.length) {
    throw new Error("DDragon returned empty versions array");
  }
  const version = versions[0];

  // Champion + spell data — versioned URLs are effectively immutable
  const [champRes, spellRes] = await Promise.all([
    fetch(`${DDRAGON_URL}/cdn/${version}/data/en_US/champion.json`, {
      next: { revalidate: 86400 },
    }),
    fetch(`${DDRAGON_URL}/cdn/${version}/data/en_US/summoner.json`, {
      next: { revalidate: 86400 },
    }),
  ]);
  if (!champRes.ok) {
    throw new Error(`DDragon champion data fetch failed: ${champRes.status}`);
  }
  if (!spellRes.ok) {
    throw new Error(`DDragon spell data fetch failed: ${spellRes.status}`);
  }

  const champData = await champRes.json();
  const newChampionMap: Record<number, string> = {};
  for (const champ of Object.values(champData.data) as Array<{
    key: string;
    id: string;
  }>) {
    newChampionMap[parseInt(champ.key, 10)] = champ.id;
  }
  championMap = newChampionMap;

  const spellData = await spellRes.json();
  const newSpellMap: Record<number, string> = {};
  for (const spell of Object.values(spellData.data) as Array<{
    key: string;
    id: string;
  }>) {
    newSpellMap[parseInt(spell.key, 10)] = spell.id;
  }
  spellMap = newSpellMap;

  cachedDdVersion = version;
  return version;
}

export function getChampionName(championId: number): string {
  return championMap[championId] ?? "Unknown";
}

export function getSpellName(spellId: number): string {
  return spellMap[spellId] ?? "Unknown";
}

export async function checkFriendGameStatus(
  friend: Friend
): Promise<{ inGame: boolean; gameInfo: GameInfo | null }> {
  const game = await getActiveGame(friend.puuid, friend.region ?? "eun1");

  if (!game) {
    return { inGame: false, gameInfo: null };
  }

  const participant = game.participants.find(
    (p) => p.puuid === friend.puuid
  );

  if (!participant) {
    return { inGame: false, gameInfo: null };
  }

  const championName = getChampionName(participant.championId);

  return {
    inGame: true,
    gameInfo: {
      gameId: game.gameId,
      championId: participant.championId,
      championName,
      gameMode: game.gameMode,
      gameStartTime: game.gameStartTime,
      spell1Id: participant.spell1Id,
      spell2Id: participant.spell2Id,
      teamId: participant.teamId,
    },
  };
}

export function detectParties(friends: Friend[]): void {
  // Reset all playingWith arrays
  for (const friend of friends) {
    friend.playingWith = [];
  }

  // Group friends by gameId
  const gameGroups: Record<number, Friend[]> = {};
  for (const friend of friends) {
    if (friend.inGame && friend.gameInfo) {
      const gameId = friend.gameInfo.gameId;
      if (!gameGroups[gameId]) {
        gameGroups[gameId] = [];
      }
      gameGroups[gameId].push(friend);
    }
  }

  // For groups with 2+ friends, populate playingWith
  for (const group of Object.values(gameGroups)) {
    if (group.length >= 2) {
      for (const friend of group) {
        friend.playingWith = group
          .filter((f) => f.puuid !== friend.puuid)
          .map((f) => f.puuid);
      }
    }
  }
}
