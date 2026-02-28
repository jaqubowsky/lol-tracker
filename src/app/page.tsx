"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Header } from "@/components/header";
import { AddFriendForm } from "@/components/add-friend-form/add-friend-form";
import { FriendList } from "@/components/friend-list/friend-list";
import { ImportExport } from "@/components/import-export/import-export";
import {
  pollFriendsStatus,
  fullRefreshFriends,
} from "@/components/friend-list/action";
import { checkRateLimit, onRateLimitResume, RATE_LIMIT_MARKER } from "@/utils/rate-limit-event";
import {
  getFriends,
  saveFriends,
  addFriend as storedAddFriend,
  removeFriend as storedRemoveFriend,
  getDdVersion,
  saveDdVersion,
  getPinnedFriends,
  togglePin,
  getPrevRanks,
  savePrevRanks,
} from "@/utils/storage";
import { POLL_INTERVAL } from "@/lib/config";
import type { Friend, Region, RankInfo, Tier, Division } from "@/utils/types";

const TIER_ORDER: Record<Tier, number> = {
  IRON: 0, BRONZE: 1, SILVER: 2, GOLD: 3, PLATINUM: 4,
  EMERALD: 5, DIAMOND: 6, MASTER: 7, GRANDMASTER: 8, CHALLENGER: 9,
};
const DIVISION_ORDER: Record<Division, number> = { IV: 0, III: 1, II: 2, I: 3 };

function rankScore(r: RankInfo): number {
  return TIER_ORDER[r.tier] * 1000 + DIVISION_ORDER[r.division] * 100 + r.lp;
}

function compareRank(prev: RankInfo | undefined, curr: RankInfo | null): "up" | "down" | null {
  if (!prev || !curr) return null;
  const diff = rankScore(curr) - rankScore(prev);
  if (diff > 0) return "up";
  if (diff < 0) return "down";
  return null;
}

export default function Home() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [ddVersion, setDdVersion] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinnedPuuids, setPinnedPuuids] = useState<string[]>([]);
  const [rankChanges, setRankChanges] = useState<Record<string, "up" | "down" | null>>({});
  const friendsRef = useRef<Friend[]>([]);
  const refreshingRef = useRef(false);
  const initialRefreshDone = useRef(false);

  // Keep ref in sync for interval callback
  useEffect(() => {
    friendsRef.current = friends;
  }, [friends]);

  // Apply result helper
  const applyResult = useCallback(
    (result: { friends: Friend[]; ddVersion: string }) => {
      // Compute rank changes
      const prev = getPrevRanks();
      const changes: Record<string, "up" | "down" | null> = {};
      const newRanks: Record<string, RankInfo> = {};
      for (const f of result.friends) {
        if (f.rank) {
          changes[f.puuid] = compareRank(prev[f.puuid], f.rank);
          newRanks[f.puuid] = f.rank;
        }
      }
      savePrevRanks(newRanks);
      setRankChanges(changes);

      setFriends(result.friends);
      setDdVersion(result.ddVersion);
      saveFriends(result.friends);
      saveDdVersion(result.ddVersion);
      setLastUpdated(new Date());
      setError(null);
    },
    []
  );

  // Full refresh — only on mount and manual button click. No auto-retry.
  const doFullRefresh = useCallback(
    async (friendList: Friend[]) => {
      if (friendList.length === 0) return;
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const result = await fullRefreshFriends(friendList);
        applyResult(result);
        initialRefreshDone.current = true;
        if (result.rateLimited) {
          checkRateLimit(new Error(RATE_LIMIT_MARKER));
        }
      } catch (err) {
        checkRateLimit(err);
        setError(
          "Nie udało się odświeżyć — kliknij Odśwież aby spróbować ponownie"
        );
      } finally {
        setLoading(false);
        refreshingRef.current = false;
      }
    },
    [applyResult]
  );

  // Light poll — silent background, cheap (rank + game status only)
  const doPoll = useCallback(
    async (friendList: Friend[]) => {
      if (friendList.length === 0) return;
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      try {
        const result = await pollFriendsStatus(friendList);
        applyResult(result);
        if (result.rateLimited) {
          checkRateLimit(new Error(RATE_LIMIT_MARKER));
        }
      } catch (err) {
        checkRateLimit(err);
      } finally {
        refreshingRef.current = false;
      }
    },
    [applyResult]
  );

  // Load from localStorage on mount, then do a full refresh
  useEffect(() => {
    const stored = getFriends();
    const cachedDd = getDdVersion();
    setFriends(stored);
    setDdVersion(cachedDd);
    setPinnedPuuids(getPinnedFriends());
    setHydrated(true);
    if (stored.length > 0) {
      doFullRefresh(stored);
    }
  }, [doFullRefresh]);

  // Light poll every 30s — only after initial refresh is done
  useEffect(() => {
    const interval = setInterval(() => {
      if (initialRefreshDone.current) {
        doPoll(friendsRef.current);
      }
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [doPoll]);

  // Resume polling after rate limit countdown/dismiss
  useEffect(() => {
    return onRateLimitResume(() => {
      doPoll(friendsRef.current);
    });
  }, [doPoll]);

  function handleAddFriend(friend: Friend) {
    const updated = storedAddFriend(friend);
    setFriends(updated);
    doFullRefresh(updated);
  }

  function handleRemoveFriend(puuid: string) {
    const updated = storedRemoveFriend(puuid);
    setFriends(updated);
  }

  function handleTogglePin(puuid: string) {
    const updated = togglePin(puuid);
    setPinnedPuuids(updated);
  }

  function handleImport(imported: { puuid: string; gameName: string; tagLine: string; region: Region }[]) {
    const stubs: Friend[] = imported.map((f) => ({
      puuid: f.puuid,
      gameName: f.gameName,
      tagLine: f.tagLine,
      region: f.region,
      profileIconId: 0,
      summonerLevel: 0,
      rank: null,
      inGame: false,
      gameInfo: null,
      recentMatches: [],
      topChampions: [],
      playingWith: [],
      lastSeen: null,
    }));
    const merged = [...friends, ...stubs];
    saveFriends(merged);
    setFriends(merged);
    doFullRefresh(merged);
  }

  return (
    <main className="max-w-6xl mx-auto px-3 sm:px-4 pb-12 sm:pb-16">
      <Header />
      <AddFriendForm onAdd={handleAddFriend} />
      <div className="mb-6">
        <ImportExport friends={friends} onImport={handleImport} />
      </div>

      {error && (
        <div className="text-center mb-6">
          <p className="text-danger text-xs tracking-wider uppercase">
            {error}
          </p>
        </div>
      )}

      <FriendList
        friends={friends}
        ddVersion={ddVersion}
        onRemove={handleRemoveFriend}
        loading={loading}
        hydrated={hydrated}
        pinnedPuuids={pinnedPuuids}
        onTogglePin={handleTogglePin}
        rankChanges={rankChanges}
      />

      {/* Footer */}
      <div className="mt-12">
        <div className="lol-divider max-w-xs mx-auto mb-4" />
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-text-muted text-xs tracking-wider">
          {lastUpdated && (
            <span>
              Ostatnia aktualizacja:{" "}
              <span className="text-text-secondary">
                {lastUpdated.toLocaleTimeString("pl-PL")}
              </span>
            </span>
          )}
          <button
            onClick={() => doFullRefresh(friends)}
            disabled={loading}
            className="text-gold-primary hover:text-gold-bright transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed uppercase tracking-widest font-medium"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {loading ? "Odświeżam..." : "Odśwież"}
          </button>
        </div>
      </div>
    </main>
  );
}
