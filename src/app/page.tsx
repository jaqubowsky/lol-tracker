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
  const [initialLoaded, setInitialLoaded] = useState(false);
  const friendsRef = useRef<Friend[]>([]);
  const refreshingRef = useRef(false);
  const lastRefreshRef = useRef(0);
  const [refreshCooldown, setRefreshCooldown] = useState(0);

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
        setInitialLoaded(true);
        refreshingRef.current = false;
        lastRefreshRef.current = Date.now();
        setRefreshCooldown(60);
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
    } else {
      setInitialLoaded(true);
    }
  }, [doFullRefresh]);

  // Refresh cooldown countdown (1s tick)
  const cooldownActive = refreshCooldown > 0;
  useEffect(() => {
    if (!cooldownActive) return;
    const timer = setInterval(() => {
      const remaining = Math.ceil((lastRefreshRef.current + 60000 - Date.now()) / 1000);
      if (remaining <= 0) {
        setRefreshCooldown(0);
      } else {
        setRefreshCooldown(remaining);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownActive]);

  // Light poll every 60s — only after initial refresh is done
  useEffect(() => {
    const interval = setInterval(() => {
      if (initialLoaded) {
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

  if (!initialLoaded) {
    return (
      <main className="flex flex-col items-center justify-center min-h-[60dvh]">
        <div className="lol-divider max-w-xs mx-auto mb-6" />
        <h1
          className="text-3xl sm:text-4xl font-bold tracking-[0.1em] uppercase gold-shimmer mb-4"
          style={{ fontFamily: "var(--font-display)" }}
        >
          LoL Tracker
        </h1>
        <div className="flex items-center gap-2 text-text-secondary text-sm tracking-wider uppercase">
          <svg className="w-4 h-4 animate-spin text-gold-primary" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Ładowanie...
        </div>
        <div className="lol-divider max-w-xs mx-auto mt-6" />
      </main>
    );
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
        <div className="flex flex-col items-center justify-center gap-2 text-text-muted text-xs tracking-wider">
          <a
            href="https://github.com/jaqubowsky"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-text-muted/80 hover:text-text-secondary transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            jaqubowsky
          </a>
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
            disabled={loading || refreshCooldown > 0}
            className="text-gold-primary hover:text-gold-bright transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed uppercase tracking-widest font-medium"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {loading
              ? "Odświeżam..."
              : refreshCooldown > 0
                ? `Odśwież (${refreshCooldown}s)`
                : "Odśwież"}
          </button>
        </div>
      </div>
    </main>
  );
}
