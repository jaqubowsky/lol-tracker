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
}

function RankBadge({ label, rank }: { label: string; rank: { tier: string; division: string; lp: number } | null }) {
  if (!rank) {
    return (
      <div className="flex flex-col items-center gap-1 px-3 sm:px-4 py-2 bg-bg-secondary/60 border border-gold-dark/30 min-w-[100px] sm:min-w-[120px]"
           style={{ clipPath: "polygon(0% 0%, calc(100% - 8px) 0%, 100% 8px, 100% 100%, 8px 100%, 0% calc(100% - 8px))" }}>
        <span className="text-text-muted text-[10px] uppercase tracking-widest">{label}</span>
        <span className="text-text-secondary text-xs">Brak rangi</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1 px-3 sm:px-4 py-2 bg-bg-secondary/60 border border-gold-dark/30 min-w-[100px] sm:min-w-[120px]"
         style={{ clipPath: "polygon(0% 0%, calc(100% - 8px) 0%, 100% 8px, 100% 100%, 8px 100%, 0% calc(100% - 8px))" }}>
      <span className="text-text-muted text-[10px] uppercase tracking-widest">{label}</span>
      <span className={`${getTierColorClass(rank.tier)} text-xs sm:text-sm font-semibold uppercase tracking-wide`}>
        {rank.tier} {rank.division}
      </span>
      <span className={`${getTierColorClass(rank.tier)} text-xs opacity-70`}>{rank.lp} LP</span>
    </div>
  );
}

export function PlayerHeader({ player, region }: PlayerHeaderProps) {
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
    <div className="mb-8">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-text-muted hover:text-gold-primary transition-colors text-sm tracking-wider uppercase mb-6"
        style={{ fontFamily: "var(--font-display)" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Powrót
      </Link>

      {/* Player info */}
      <div className="flex items-start sm:items-center gap-4 sm:gap-5">
        {/* Profile icon */}
        <div className="relative shrink-0">
          <div className="w-[72px] h-[72px] p-[2px] bg-gradient-to-b from-gold-primary to-gold-dark">
            <Image
              src={profileIconUrl}
              alt={`Ikona ${player.gameName}`}
              width={68}
              height={68}
              className="w-full h-full object-cover"
              unoptimized
            />
          </div>
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-bg-secondary text-gold-primary text-[10px] font-semibold px-2 py-[2px] border border-gold-dark">
            {player.summonerLevel}
          </span>
        </div>

        {/* Name + ranks */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 sm:mb-3 flex-wrap">
            <h1
              className="text-xl sm:text-2xl font-bold text-gold-bright tracking-wide truncate"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {player.gameName}
            </h1>
            <span className="text-text-muted text-sm shrink-0">#{player.tagLine}</span>
            {!isFriend && (
              <button
                onClick={handleAdd}
                disabled={adding}
                className="ml-1 shrink-0 w-7 h-7 flex items-center justify-center rounded border border-gold-dark/40 bg-gold-primary/10 text-gold-primary hover:bg-gold-primary/20 hover:border-gold-primary/60 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Dodaj do obserwowanych"
              >
                {adding ? (
                  <div className="w-3 h-3 border border-gold-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                )}
              </button>
            )}
            {isFriend && (
              <span className="ml-1 shrink-0 text-win text-xs" title="Obserwujesz tego gracza">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
            )}
          </div>

          <div className="flex gap-3 flex-wrap">
            <RankBadge label="Solo/Duo" rank={player.soloRank} />
            <RankBadge label="Flex" rank={player.flexRank} />
          </div>
        </div>
      </div>
    </div>
  );
}
