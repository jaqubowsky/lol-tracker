"use client";

import { FriendCard } from "@/components/friend-card/friend-card";
import { useInfiniteScroll } from "@/utils/use-infinite-scroll";
import type { Friend } from "@/utils/types";

const PAGE_SIZE = 9;

interface FriendListProps {
  friends: Friend[];
  ddVersion: string;
  onRemove: (puuid: string) => void;
  loading: boolean;
  hydrated: boolean;
  pinnedPuuids: string[];
  onTogglePin: (puuid: string) => void;
  rankChanges: Record<string, "up" | "down" | null>;
}

export function FriendList({
  friends,
  ddVersion,
  onRemove,
  loading,
  hydrated,
  pinnedPuuids,
  onTogglePin,
  rankChanges,
}: FriendListProps) {
  const { visibleCount, hasMore, sentinelRef } = useInfiniteScroll({
    totalCount: friends.length,
    pageSize: PAGE_SIZE,
  });

  if (!hydrated || (loading && friends.length === 0)) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card-border-wrap">
            <div className="hex-clip bg-bg-card p-4 sm:p-5 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-[52px] h-[52px] bg-bg-surface" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-4 bg-bg-surface w-3/4" />
                  <div className="h-3 bg-bg-surface w-1/2" />
                </div>
              </div>
              <div className="lol-divider my-3" />
              <div className="flex gap-[3px]">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="w-[22px] h-[22px] bg-bg-surface" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="inline-block mb-4">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="text-gold-dark mx-auto">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p
          className="text-gold-primary text-lg tracking-wider uppercase"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Nie dodano jeszcze znajomych
        </p>
        <p className="text-text-muted text-sm mt-2">
          Dodaj znajomych wpisując ich Riot ID powyżej
        </p>
      </div>
    );
  }

  // Sort: pinned → in-game → lastSeen desc → unknown last → alpha
  const pinnedSet = new Set(pinnedPuuids);
  const sorted = [...friends].sort((a, b) => {
    const aPinned = pinnedSet.has(a.puuid);
    const bPinned = pinnedSet.has(b.puuid);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    if (a.inGame && !b.inGame) return -1;
    if (!a.inGame && b.inGame) return 1;
    if (a.lastSeen !== null && b.lastSeen !== null) {
      const diff = b.lastSeen - a.lastSeen;
      if (diff !== 0) return diff;
    }
    if (a.lastSeen !== null && b.lastSeen === null) return -1;
    if (a.lastSeen === null && b.lastSeen !== null) return 1;
    return a.gameName.localeCompare(b.gameName);
  });

  const visible = sorted.slice(0, visibleCount);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {visible.map((friend, index) => (
          <div
            key={friend.puuid}
            className="card-reveal h-full"
            style={{ animationDelay: `${Math.min(index, PAGE_SIZE - 1) * 60}ms` }}
          >
            <FriendCard
              friend={friend}
              ddVersion={ddVersion}
              allFriends={friends}
              onRemove={onRemove}
              isPinned={pinnedSet.has(friend.puuid)}
              onTogglePin={onTogglePin}
              rankChange={rankChanges[friend.puuid] ?? null}
            />
          </div>
        ))}
      </div>
      {hasMore && <div ref={sentinelRef} className="h-1" />}
    </div>
  );
}
