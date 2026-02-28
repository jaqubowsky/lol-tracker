import type { Friend, RankInfo } from "./types";

const STORAGE_KEY = "lol-tracker-friends";
const DD_VERSION_KEY = "lol-tracker-dd-version";
const PINNED_KEY = "lol-tracker-pinned";
const PREV_RANKS_KEY = "lol-tracker-prev-ranks";

export function getFriends(): Friend[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const friends = JSON.parse(data) as Friend[];
    // Migration: default region to "eun1" for existing friends without it
    for (const f of friends) {
      if (!f.region) f.region = "eun1";
    }
    return friends;
  } catch {
    return [];
  }
}

export function saveFriends(friends: Friend[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(friends));
}

export function addFriend(friend: Friend): Friend[] {
  const friends = getFriends();
  if (friends.some((f) => f.puuid === friend.puuid)) {
    throw new Error("Gracz już dodany");
  }
  friends.push(friend);
  saveFriends(friends);
  return friends;
}

export function removeFriend(puuid: string): Friend[] {
  const friends = getFriends().filter((f) => f.puuid !== puuid);
  saveFriends(friends);
  return friends;
}

export function getDdVersion(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(DD_VERSION_KEY) ?? "";
}

export function saveDdVersion(version: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DD_VERSION_KEY, version);
}

// --- Pinned friends ---

export function getPinnedFriends(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(PINNED_KEY);
    if (!data) return [];
    return JSON.parse(data) as string[];
  } catch {
    return [];
  }
}

export function savePinnedFriends(puuids: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PINNED_KEY, JSON.stringify(puuids));
}

export function togglePin(puuid: string): string[] {
  const pinned = getPinnedFriends();
  const idx = pinned.indexOf(puuid);
  if (idx >= 0) {
    pinned.splice(idx, 1);
  } else {
    pinned.push(puuid);
  }
  savePinnedFriends(pinned);
  return pinned;
}

// --- Previous ranks (for rank change indicator) ---

export function getPrevRanks(): Record<string, RankInfo> {
  if (typeof window === "undefined") return {};
  try {
    const data = localStorage.getItem(PREV_RANKS_KEY);
    if (!data) return {};
    return JSON.parse(data) as Record<string, RankInfo>;
  } catch {
    return {};
  }
}

export function savePrevRanks(ranks: Record<string, RankInfo>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREV_RANKS_KEY, JSON.stringify(ranks));
}
