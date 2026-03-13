"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { resolveFriend } from "@/components/add-friend-form/action";
import { checkRateLimit } from "@/utils/rate-limit-event";
import { getFriends, addFriend as storageAddFriend } from "@/utils/storage";
import { getTierColorClass } from "@/lib/rank-utils";
import type { PlayerDetail, Region } from "@/utils/types";

interface PlayerHeaderProps {
  player: PlayerDetail;
  region: Region;
  onRefresh?: () => void;
  refreshing?: boolean;
}

function InlineRank({ label, rank }: { label: string; rank: { tier: string; division: string; lp: number } | null }) {
  if (!rank) {
    return (
      <span className="text-text-muted text-xs">
        <span className="text-text-muted/60 uppercase text-[10px] tracking-wider mr-1">{label}</span>
        Brak
      </span>
    );
  }
  return (
    <span className="text-xs">
      <span className="text-text-muted/60 uppercase text-[10px] tracking-wider mr-1">{label}</span>
      <span className={`${getTierColorClass(rank.tier)} font-semibold uppercase`}>
        {rank.tier} {rank.division}
      </span>
      <span className={`${getTierColorClass(rank.tier)} opacity-60 ml-1`}>{rank.lp} LP</span>
    </span>
  );
}

export function PlayerHeader({ player, region, onRefresh, refreshing }: PlayerHeaderProps) {
  const profileIconUrl = `https://ddragon.leagueoflegends.com/cdn/${player.ddVersion}/img/profileicon/${player.profileIconId}.png`;

  const [isFriend, setIsFriend] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const friends = getFriends();
    setIsFriend(friends.some((f) => f.puuid === player.puuid));
  }, [player.puuid]);

  async function handleAdd() {
    setAdding(true);
    try {
      const friend = await resolveFriend(player.gameName, player.tagLine, region);
      storageAddFriend(friend);
      setIsFriend(true);
    } catch (err) {
      checkRateLimit(err);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div
      className="sticky top-0 py-3 mb-6"
      style={{
        zIndex: 40,
        width: "100vw",
        marginLeft: "calc(-50vw + 50%)",
        paddingLeft: "max(calc(50vw - 50% + 0.75rem), 1rem)",
        paddingRight: "max(calc(50vw - 50% + 0.75rem), 1rem)",
        background: "rgb(1, 10, 19)",
        borderBottom: "1px solid rgba(200, 170, 110, 0.15)",
      }}
    >
      {/* Row 1: back + icon + name + actions */}
      <div className="flex items-center gap-3">
        {/* Back */}
        <Link
          href="/"
          className="shrink-0 text-text-muted hover:text-gold-primary transition-colors"
          title="Powrót"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>

        {/* Divider */}
        <div className="w-[1px] h-6 bg-gold-dark/30 shrink-0" />

        {/* Icon */}
        <div className="relative shrink-0">
          <div className="w-[40px] h-[40px] p-[1.5px] bg-gradient-to-b from-gold-primary to-gold-dark">
            <Image
              src={profileIconUrl}
              alt={`Ikona ${player.gameName}`}
              width={40}
              height={40}
              className="w-full h-full object-cover"
              unoptimized
            />
          </div>
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-bg-secondary text-gold-primary text-[8px] font-semibold px-1 py-[0.5px] border border-gold-dark leading-tight">
            {player.summonerLevel}
          </span>
        </div>

        {/* Name + tag */}
        <div className="flex items-center gap-1.5 min-w-0">
          <h1
            className="text-base sm:text-lg font-bold text-gold-bright tracking-wide truncate"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {player.gameName}
          </h1>
          <span className="text-text-muted text-xs shrink-0">#{player.tagLine}</span>
        </div>

        {/* Actions */}
        {!isFriend && (
          <button
            onClick={handleAdd}
            disabled={adding}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded border border-gold-dark/40 bg-gold-primary/10 text-gold-primary hover:bg-gold-primary/20 hover:border-gold-primary/60 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Dodaj do obserwowanych"
          >
            {adding ? (
              <div className="w-2.5 h-2.5 border border-gold-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
            )}
          </button>
        )}
        {isFriend && (
          <span className="shrink-0 text-win text-xs" title="Obserwujesz tego gracza">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </span>
        )}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded border border-gold-dark/40 bg-gold-primary/10 text-gold-primary hover:bg-gold-primary/20 hover:border-gold-primary/60 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Odśwież dane"
          >
            {refreshing ? (
              <div className="w-2.5 h-2.5 border border-gold-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M1 4v6h6M23 20v-6h-6" />
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
              </svg>
            )}
          </button>
        )}

        {/* Divider */}
        <div className="w-[1px] h-6 bg-gold-dark/30 shrink-0 hidden sm:block" />

        {/* Ranks inline — desktop */}
        <div className="hidden sm:flex items-center gap-4 ml-auto shrink-0">
          <InlineRank label="Solo" rank={player.soloRank} />
          <div className="w-[1px] h-4 bg-gold-dark/20" />
          <InlineRank label="Flex" rank={player.flexRank} />
        </div>
      </div>

      {/* Row 2: ranks — mobile only */}
      <div className="sm:hidden flex items-center gap-3 mt-2 ml-[66px]">
        <InlineRank label="Solo" rank={player.soloRank} />
        <div className="w-[1px] h-3 bg-gold-dark/20" />
        <InlineRank label="Flex" rank={player.flexRank} />
      </div>
    </div>
  );
}
