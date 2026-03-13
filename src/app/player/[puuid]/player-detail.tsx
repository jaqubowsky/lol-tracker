"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { fetchPlayerDetail, fetchRankedMatches, resolveAccountNames } from "./action";
import { checkRateLimit } from "@/utils/rate-limit-event";
import { estimateRankProgression } from "@/lib/rank-utils";
import { getFriends } from "@/utils/storage";
import { PlayerHeader } from "@/components/player-detail/player-header";
import { RankFilters } from "@/components/player-detail/rank-filters";
import { RankChart } from "@/components/player-detail/rank-chart";
import { MatchStatsSummary } from "@/components/player-detail/match-stats-summary";
import { ChampionStats } from "@/components/player-detail/champion-stats";
import { FrequentTeammates } from "@/components/player-detail/frequent-teammates";
import { MatchHistoryTable } from "@/components/player-detail/match-history-table";
import { ScoreboardModal } from "@/components/scoreboard-modal/scoreboard-modal";
import type {
  PlayerDetail,
  RankedMatchDetail,
  QueueFilter,
  TimeRangeFilter,
  CustomDateRange,
  Friend,
  Region,
} from "@/utils/types";

interface PlayerDetailPageProps {
  puuid: string;
}

function dateToEpochSeconds(dateStr: string): number {
  return Math.floor(new Date(dateStr).getTime() / 1000);
}

// ---------------------------------------------------------------------------
// Cache key + per-filter-combo cache
// ---------------------------------------------------------------------------
interface CacheEntry {
  matches: RankedMatchDetail[];
  hasMore: boolean;
}

function cacheKey(q: QueueFilter, tr: TimeRangeFilter, custom?: CustomDateRange): string {
  if (tr === "custom" && custom?.startDate && custom?.endDate) {
    return `${q}|custom|${custom.startDate}|${custom.endDate}`;
  }
  return `${q}|${tr}`;
}

// ---------------------------------------------------------------------------
// Parse / validate query params
// ---------------------------------------------------------------------------
const VALID_QUEUES: QueueFilter[] = ["all", "solo", "flex"];
const VALID_TIMES: TimeRangeFilter[] = ["7d", "14d", "30d", "all", "custom"];

function parseQueue(v: string | null): QueueFilter {
  return VALID_QUEUES.includes(v as QueueFilter) ? (v as QueueFilter) : "all";
}
function parseTime(v: string | null): TimeRangeFilter {
  return VALID_TIMES.includes(v as TimeRangeFilter) ? (v as TimeRangeFilter) : "all";
}

const VALID_REGIONS: Region[] = ["eun1", "euw1"];
function parseRegion(v: string | null): Region {
  return VALID_REGIONS.includes(v as Region) ? (v as Region) : "eun1";
}

export function PlayerDetailPage({ puuid }: PlayerDetailPageProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const region = parseRegion(searchParams.get("region"));

  // Initialise filter state from URL query params
  const [queue, setQueue] = useState<QueueFilter>(() => parseQueue(searchParams.get("queue")));
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>(() => parseTime(searchParams.get("time")));
  const [customDateRange, setCustomDateRange] = useState<CustomDateRange>(() => ({
    startDate: searchParams.get("from") ?? "",
    endDate: searchParams.get("to") ?? "",
  }));

  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [matches, setMatches] = useState<RankedMatchDetail[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scoreboardMatchId, setScoreboardMatchId] = useState<string | null>(
    () => searchParams.get("match")
  );
  const [refreshing, setRefreshing] = useState(false);

  // Match cache — survives filter switches, keyed by filter combo
  const matchCache = useRef<Map<string, CacheEntry>>(new Map());

  // Friend list from observations
  const [friendMap, setFriendMap] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    const friends = getFriends();
    setFriendMap(new Map(friends.map((f: Friend) => [f.puuid, f.gameName])));
  }, []);

  // Premade detection: co-occurrence analysis + resolved names
  const [resolvedNames, setResolvedNames] = useState<Map<string, string>>(new Map());
  const resolvedPuuids = useRef<Set<string>>(new Set());

  // Find frequent teammates (2+ games together) from current matches
  const frequentPuuids = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of matches) {
      for (const tp of m.teammatePuuids) {
        counts.set(tp, (counts.get(tp) ?? 0) + 1);
      }
    }
    const result = new Set<string>();
    for (const [p, count] of counts) {
      if (count >= 2) result.add(p);
    }
    return result;
  }, [matches]);

  // Resolve names for frequent teammates we haven't resolved yet
  useEffect(() => {
    const toResolve = [...frequentPuuids].filter(
      (p) => !friendMap.has(p) && !resolvedPuuids.current.has(p)
    );
    if (toResolve.length === 0) return;

    // Mark as in-flight so we don't re-request
    for (const p of toResolve) resolvedPuuids.current.add(p);

    let cancelled = false;
    resolveAccountNames(toResolve, region)
      .then((resolved) => {
        if (cancelled) return;
        setResolvedNames((prev) => {
          const next = new Map(prev);
          for (const [p, acct] of Object.entries(resolved)) {
            next.set(p, acct.gameName);
          }
          return next;
        });
      })
      .catch((err) => checkRateLimit(err));

    return () => { cancelled = true; };
  }, [frequentPuuids, friendMap]);

  // Combined map: friends + resolved frequent teammates
  const knownPlayersMap = useMemo(() => {
    const combined = new Map(friendMap);
    for (const [p, name] of resolvedNames) {
      if (!combined.has(p)) combined.set(p, name);
    }
    return combined;
  }, [friendMap, resolvedNames]);

  const requestId = useRef(0);

  // ---- helpers ----

  const updateUrl = useCallback((q: QueueFilter, tr: TimeRangeFilter, custom?: CustomDateRange, loaded?: number) => {
    const params = new URLSearchParams();
    if (region !== "eun1") params.set("region", region);
    if (q !== "all") params.set("queue", q);
    if (tr !== "all") params.set("time", tr);
    if (tr === "custom" && custom?.startDate) params.set("from", custom.startDate);
    if (tr === "custom" && custom?.endDate) params.set("to", custom.endDate);
    if (loaded && loaded > 50) params.set("loaded", String(loaded));
    const qs = params.toString();
    router.replace(`?${qs}`, { scroll: false });
  }, [router, region]);

  // Load profile on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const detail = await fetchPlayerDetail(puuid, region);
        if (!cancelled) setPlayer(detail);
      } catch (err) {
        checkRateLimit(err);
        if (!cancelled) setError("Nie udało się załadować profilu gracza");
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [puuid]);

  // Fetch a single page of matches from the server — always "all" queue + time,
  // except custom date ranges which need server-side startTime/endTime.
  const fetchPage = useCallback(async (
    customRange: CustomDateRange | undefined,
    start: number
  ) => {
    const opts: { start?: number; startTime?: number; endTime?: number } = { start };
    if (customRange?.startDate && customRange?.endDate) {
      opts.startTime = dateToEpochSeconds(customRange.startDate);
      opts.endTime = dateToEpochSeconds(customRange.endDate) + 86400;
    }
    // Always fetch all queues + all time from server; client filters the rest
    return fetchRankedMatches(puuid, "all", "all", opts);
  }, [puuid]);

  // Fetch matches — always fetches the broadest dataset from the server.
  // Queue + preset time filtering is done client-side via `filteredMatches`.
  const fetchMatches = useCallback(async (
    customRange?: CustomDateRange,
    start: number = 0,
    targetCount: number = 50
  ) => {
    const key = customRange?.startDate && customRange?.endDate
      ? `custom|${customRange.startDate}|${customRange.endDate}`
      : "all";
    const isLoadMore = start > 0;

    // If not loading more and cache has data, restore instantly
    if (!isLoadMore) {
      const cached = matchCache.current.get(key);
      if (cached) {
        setMatches(cached.matches);
        setHasMore(cached.hasMore);
        setLoadingMatches(false);
        return;
      }
    }

    const id = ++requestId.current;
    if (!isLoadMore) {
      setLoadingMatches(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let accumulated: RankedMatchDetail[] = isLoadMore
        ? (matchCache.current.get(key)?.matches ?? [])
        : [];
      let currentStart = start;
      let moreAvailable = true;

      while (accumulated.length < (isLoadMore ? start + targetCount : targetCount) && moreAvailable) {
        if (requestId.current !== id) return;
        const result = await fetchPage(customRange, currentStart);
        if (requestId.current !== id) return;

        const existingIds = new Set(accumulated.map((m) => m.matchId));
        const newMatches = result.matches.filter((m) => !existingIds.has(m.matchId));
        accumulated = [...accumulated, ...newMatches];
        moreAvailable = result.hasMore;
        currentStart += 50;
      }

      matchCache.current.set(key, { matches: accumulated, hasMore: moreAvailable });
      setMatches(accumulated);
      setHasMore(moreAvailable);

      updateUrl(queue, timeRange, customDateRange, accumulated.length);
    } catch (err) {
      checkRateLimit(err);
      if (requestId.current !== id) return;
      if (!isLoadMore) {
        setMatches([]);
        setHasMore(false);
      }
    } finally {
      if (requestId.current !== id) return;
      setLoadingMatches(false);
      setLoadingMore(false);
    }
  }, [puuid, fetchPage, updateUrl, queue, timeRange, customDateRange]);

  // Initial fetch on mount
  const initialFetched = useRef(false);
  useEffect(() => {
    if (initialFetched.current) return;
    initialFetched.current = true;

    const restoredCount = Math.max(50, parseInt(searchParams.get("loaded") ?? "50", 10) || 50);

    if (timeRange === "custom" && customDateRange.startDate && customDateRange.endDate) {
      fetchMatches(customDateRange, 0, restoredCount);
    } else {
      fetchMatches(undefined, 0, restoredCount);
    }
  }, [fetchMatches, timeRange, customDateRange, searchParams]);

  // ---- filter handlers ----
  // Queue + preset time changes are instant (client-side only, no server fetch).
  // Only custom date ranges trigger a server fetch.

  const handleQueueChange = useCallback((q: QueueFilter) => {
    setQueue(q);
    updateUrl(q, timeRange, customDateRange);
  }, [timeRange, customDateRange, updateUrl]);

  const handleTimeRangeChange = useCallback((tr: TimeRangeFilter) => {
    setTimeRange(tr);
    updateUrl(queue, tr, customDateRange);
  }, [queue, customDateRange, updateUrl]);

  const handleCustomDateChange = useCallback((range: CustomDateRange) => {
    setCustomDateRange(range);
    updateUrl(queue, "custom", range);
    if (range.startDate && range.endDate) {
      fetchMatches(range);
    }
  }, [queue, fetchMatches, updateUrl]);

  const handleLoadMore = useCallback(() => {
    const customRange = timeRange === "custom" ? customDateRange : undefined;
    fetchMatches(customRange, matches.length, 50);
  }, [timeRange, customDateRange, matches.length, fetchMatches]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);

    // Clear caches so data is re-fetched from server
    matchCache.current.clear();
    resolvedPuuids.current.clear();
    setResolvedNames(new Map());

    try {
      const detail = await fetchPlayerDetail(puuid, region);
      setPlayer(detail);
    } catch (err) {
      checkRateLimit(err);
      setError("Nie udało się załadować profilu gracza");
      setRefreshing(false);
      return;
    }

    try {
      const customRange = timeRange === "custom" && customDateRange.startDate && customDateRange.endDate
        ? customDateRange
        : undefined;
      await fetchMatches(customRange, 0, 50);
    } catch (err) {
      checkRateLimit(err);
    }

    setRefreshing(false);
  }, [puuid, region, timeRange, customDateRange, fetchMatches]);

  // Auto-refresh when browser tab regains focus (throttled to once per 60s)
  const lastFocusRefresh = useRef(0);
  useEffect(() => {
    const onFocus = () => {
      const now = Date.now();
      if (now - lastFocusRefresh.current < 60_000) return;
      lastFocusRefresh.current = now;
      handleRefresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [handleRefresh]);

  // Client-side filtering as safety net (server may return cached/broader data)
  const filteredMatches = useMemo(() => {
    let result = matches;

    // Queue filter
    if (queue === "solo") {
      result = result.filter((m) => m.queueId === 420);
    } else if (queue === "flex") {
      result = result.filter((m) => m.queueId === 440);
    }

    // Time range filter
    if (timeRange === "custom") {
      if (customDateRange.startDate) {
        const startMs = new Date(customDateRange.startDate).getTime();
        result = result.filter((m) => m.gameCreation >= startMs);
      }
      if (customDateRange.endDate) {
        const endMs = new Date(customDateRange.endDate).getTime() + 86400000;
        result = result.filter((m) => m.gameCreation < endMs);
      }
    } else if (timeRange !== "all") {
      const days = timeRange === "7d" ? 7 : timeRange === "14d" ? 14 : 30;
      const cutoff = Date.now() - days * 86400000;
      result = result.filter((m) => m.gameCreation >= cutoff);
    }

    return result;
  }, [matches, queue, timeRange, customDateRange]);

  // Compute chart data
  const chartData = useMemo(() => {
    if (!player) return [];
    const rank = queue === "flex" ? player.flexRank : (player.soloRank ?? player.flexRank);
    return estimateRankProgression(rank, filteredMatches);
  }, [player, queue, filteredMatches]);

  if (loadingProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
        <div className="w-8 h-8 border-2 border-gold-dark border-t-gold-primary rounded-full animate-spin mb-4" />
        <p className="text-text-muted text-sm uppercase tracking-wider" style={{ fontFamily: "var(--font-display)" }}>
          Ładowanie profilu...
        </p>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] text-center">
        <h1
          className="text-5xl sm:text-6xl font-bold text-gold-primary mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Błąd
        </h1>
        <h2
          className="text-xl font-bold text-text-primary mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {error ?? "Nie udało się załadować profilu gracza"}
        </h2>
        <p className="text-text-muted text-sm mb-6">
          Sprawdź identyfikator gracza lub spróbuj ponownie później.
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-block px-4 py-2 bg-gold-dark/40 border border-gold-secondary/60 text-gold-bright text-sm uppercase tracking-wider rounded hover:bg-gold-dark/60 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {refreshing ? "Ładowanie..." : "Spróbuj ponownie"}
          </button>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-gold-dark/40 border border-gold-secondary/60 text-gold-bright text-sm uppercase tracking-wider rounded hover:bg-gold-dark/60 transition-colors"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Strona główna
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PlayerHeader player={player} region={region} onRefresh={handleRefresh} refreshing={refreshing} />

      <div className="lol-divider mb-6" />

      {/* Filters */}
      <RankFilters
        queue={queue}
        timeRange={timeRange}
        customDateRange={customDateRange}
        onQueueChange={handleQueueChange}
        onTimeRangeChange={handleTimeRangeChange}
        onCustomDateChange={handleCustomDateChange}
      />

      {/* Chart — only show when rank data exists */}
      {(loadingMatches || chartData.length > 0) && (
        <div className="mb-6">
          <h3
            className="text-gold-primary text-sm font-semibold uppercase tracking-widest mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Progresja rangi
          </h3>
          {loadingMatches ? (
            <div className="flex items-center justify-center h-[200px] border border-gold-dark/20 bg-bg-secondary/30 rounded">
              <div className="w-5 h-5 border-2 border-gold-dark border-t-gold-primary rounded-full animate-spin" />
            </div>
          ) : (
            <RankChart dataPoints={chartData} friendMap={knownPlayersMap} onMatchClick={(matchId) => setScoreboardMatchId(matchId)} />
          )}
        </div>
      )}

      {/* Stats summary */}
      {!loadingMatches && <MatchStatsSummary matches={filteredMatches} ddVersion={player.ddVersion} />}

      {/* Champion stats */}
      {!loadingMatches && <ChampionStats matches={filteredMatches} ddVersion={player.ddVersion} />}

      {/* Frequent teammates */}
      {!loadingMatches && <FrequentTeammates matches={filteredMatches} playerPuuid={puuid} ddVersion={player.ddVersion} />}

      {/* Match history */}
      {!loadingMatches && (
        <MatchHistoryTable
          matches={filteredMatches}
          ddVersion={player.ddVersion}
          playerPuuid={puuid}
          friendMap={knownPlayersMap}
          region={region}
          rankProgression={chartData}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={handleLoadMore}
        />
      )}
      {scoreboardMatchId && (
        <ScoreboardModal
          matchId={scoreboardMatchId}
          playerPuuid={puuid}
          knownPlayersMap={knownPlayersMap}
          region={region}
          onClose={() => {
            setScoreboardMatchId(null);
            // Remove match param from URL so it doesn't re-open on refresh
            const params = new URLSearchParams(window.location.search);
            if (params.has("match")) {
              params.delete("match");
              const qs = params.toString();
              router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
            }
          }}
        />
      )}
    </div>
  );
}
