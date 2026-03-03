import { DDRAGON_URL } from "./config";
import { getActiveGame } from "./riot-api";
import type { Friend, GameInfo, RuneTreeInfo } from "@/utils/types";
import { getCachedDdragon, setCachedDdragon } from "./turso";

/** Strip HTML tags and decode basic entities for tooltip text */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Module-scope maps (populated from DDragon, cached via Next.js Data Cache)
let championMap: Record<number, string> = {};
let spellMap: Record<number, { id: string; name: string; description: string }> = {};
let runeMap: Record<number, { name: string; icon: string }> = {};
let runeTreesMap: Record<number, RuneTreeInfo> = {};
let itemMap: Record<number, { name: string; description: string }> = {};
let cachedDdVersion: string | null = null;

async function fetchDdragonWithCache(
  url: string,
  cacheKey: string,
  version: string,
  revalidate: number
): Promise<unknown> {
  const cached = await getCachedDdragon(cacheKey);
  if (cached) return JSON.parse(cached);

  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) {
    throw new Error(`DDragon fetch failed (${cacheKey}): ${res.status}`);
  }

  const rawText = await res.text();
  setCachedDdragon(cacheKey, version, rawText);
  return JSON.parse(rawText);
}

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

  // Champion + spell + rune + item data — versioned URLs are effectively immutable
  const [champData, spellData, runesData, itemData] = await Promise.all([
    fetchDdragonWithCache(
      `${DDRAGON_URL}/cdn/${version}/data/en_US/champion.json`,
      `champion:${version}`,
      version,
      31536000
    ),
    fetchDdragonWithCache(
      `${DDRAGON_URL}/cdn/${version}/data/pl_PL/summoner.json`,
      `spell:${version}`,
      version,
      31536000
    ),
    fetchDdragonWithCache(
      `${DDRAGON_URL}/cdn/${version}/data/pl_PL/runesReforged.json`,
      `runes:${version}`,
      version,
      31536000
    ),
    fetchDdragonWithCache(
      `${DDRAGON_URL}/cdn/${version}/data/pl_PL/item.json`,
      `item:${version}`,
      version,
      31536000
    ),
  ]) as [
    { data: Record<string, { key: string; id: string }> },
    { data: Record<string, { key: string; id: string; name: string; description: string }> },
    Array<{
      id: number; key: string; name: string; icon: string;
      slots: Array<{ runes: Array<{ id: number; key: string; name: string; icon: string; shortDesc?: string }> }>;
    }>,
    { data: Record<string, { name: string; description: string }> },
  ];
  const newChampionMap: Record<number, string> = {};
  for (const champ of Object.values(champData.data)) {
    newChampionMap[parseInt(champ.key, 10)] = champ.id;
  }
  championMap = newChampionMap;

  const newSpellMap: Record<number, { id: string; name: string; description: string }> = {};
  for (const spell of Object.values(spellData.data)) {
    newSpellMap[parseInt(spell.key, 10)] = {
      id: spell.id,
      name: spell.name,
      description: stripHtml(spell.description),
    };
  }
  spellMap = newSpellMap;

  // Build rune map + full tree data
  const newRuneMap: Record<number, { name: string; icon: string }> = {};
  const newRuneTreesMap: Record<number, RuneTreeInfo> = {};
  for (const tree of runesData) {
    // Map the tree itself (perkStyleId)
    newRuneMap[tree.id] = { name: tree.name, icon: tree.icon };
    // Build full tree info
    newRuneTreesMap[tree.id] = {
      id: tree.id,
      name: tree.name,
      icon: tree.icon,
      slots: tree.slots.map((slot) => ({
        runes: slot.runes.map((r) => ({
          id: r.id,
          name: r.name,
          icon: r.icon,
          shortDesc: stripHtml(r.shortDesc ?? ""),
        })),
      })),
    };
    // Map each individual rune
    for (const slot of tree.slots) {
      for (const rune of slot.runes) {
        newRuneMap[rune.id] = { name: rune.name, icon: rune.icon };
      }
    }
  }
  // Stat shards — not in runesReforged.json, hardcoded mapping
  const statShards: Record<number, { name: string; icon: string }> = {
    5008: { name: "+9 Siła adaptacyjna", icon: "perk-images/StatMods/StatModsAdaptiveForceIcon.png" },
    5005: { name: "+10% Szybkość ataku", icon: "perk-images/StatMods/StatModsAttackSpeedIcon.png" },
    5007: { name: "+8 Przyspieszenie umiejętności", icon: "perk-images/StatMods/StatModsCDRScalingIcon.png" },
    5002: { name: "+6 Pancerz", icon: "perk-images/StatMods/StatModsArmorIcon.png" },
    5003: { name: "+8 Odporność na magię", icon: "perk-images/StatMods/StatModsMagicResIcon.png" },
    5001: { name: "+10-180 Zdrowie", icon: "perk-images/StatMods/StatModsHealthScalingIcon.png" },
    5010: { name: "+2% Szybkość ruchu", icon: "perk-images/StatMods/StatModsMovementSpeedIcon.png" },
    5011: { name: "+65 Zdrowie", icon: "perk-images/StatMods/StatModsHealthScalingIcon.png" },
    5013: { name: "+10% Odporność i spowolnienie", icon: "perk-images/StatMods/StatModsTenacityIcon.png" },
  };
  for (const [id, data] of Object.entries(statShards)) {
    newRuneMap[Number(id)] = data;
  }

  runeMap = newRuneMap;
  runeTreesMap = newRuneTreesMap;

  // Build item map: itemId → { name, description }
  const newItemMap: Record<number, { name: string; description: string }> = {};
  for (const [key, item] of Object.entries(itemData.data)) {
    newItemMap[parseInt(key, 10)] = {
      name: item.name,
      description: stripHtml(item.description),
    };
  }
  itemMap = newItemMap;

  cachedDdVersion = version;
  return version;
}

export function getChampionName(championId: number): string {
  return championMap[championId] ?? "Unknown";
}

export function getSpellName(spellId: number): string {
  return spellMap[spellId]?.id ?? "Unknown";
}

export function getSpellInfo(spellId: number): { id: string; name: string; description: string } | null {
  return spellMap[spellId] ?? null;
}

export function getRuneIcon(runeId: number): string {
  return runeMap[runeId]?.icon ?? "";
}

export function getRuneName(runeId: number): string {
  return runeMap[runeId]?.name ?? "Unknown";
}

export function getRuneTree(treeId: number): RuneTreeInfo | null {
  return runeTreesMap[treeId] ?? null;
}

export function getItemInfo(itemId: number): { name: string; description: string } | null {
  return itemMap[itemId] ?? null;
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
    // API returned a game (not 404), so the player IS in-game
    // but puuid might be anonymized — return limited info
    return {
      inGame: true,
      gameInfo: {
        gameId: game.gameId,
        championId: 0,
        championName: "Unknown",
        gameMode: game.gameMode,
        gameStartTime: game.gameStartTime,
        spell1Id: 0,
        spell2Id: 0,
        teamId: 0,
      },
    };
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
