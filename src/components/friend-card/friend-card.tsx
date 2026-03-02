"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { GameTimer } from "@/components/game-timer";
import { LiveGameModal } from "@/components/live-game-modal/live-game-modal";
import { RecentMatches } from "./recent-matches";
import { TopChampions } from "./top-champions";
import { PartyBadge } from "./party-badge";
import { formatRelativeTime } from "@/utils/format-time";
import { getTierColorClass } from "@/lib/rank-utils";
import type { Friend } from "@/utils/types";

interface FriendCardProps {
  friend: Friend;
  ddVersion: string;
  allFriends: Friend[];
  onRemove: (puuid: string) => void;
  isPinned: boolean;
  onTogglePin: (puuid: string) => void;
  rankChange: "up" | "down" | null;
}

export function FriendCard({
  friend,
  ddVersion,
  allFriends,
  onRemove,
  isPinned,
  onTogglePin,
  rankChange,
}: FriendCardProps) {
  const profileIconUrl = ddVersion
    ? `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/profileicon/${friend.profileIconId}.png`
    : null;
  const hasChampion = friend.inGame && friend.gameInfo && friend.gameInfo.championName !== "Unknown";
  const championSplashUrl = hasChampion
    ? `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${friend.gameInfo!.championName}_0.jpg`
    : null;
  const championIconUrl = hasChampion && ddVersion
    ? `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${friend.gameInfo!.championName}.png`
    : null;

  const rankText = friend.rank
    ? `${friend.rank.tier} ${friend.rank.division} — ${friend.rank.lp} LP`
    : "Brak rangi";
  const isFlexRank = friend.rank?.queueType === "RANKED_FLEX_SR";

  const isInGame = friend.inGame && friend.gameInfo;
  const [showLiveGame, setShowLiveGame] = useState(false);

  return (
    <>
    <Link href={`/player/${friend.puuid}?region=${friend.region ?? "eun1"}`} className="block h-full">
    <div className={`card-border-wrap h-full ${isInGame ? "card-border-wrap--ingame" : ""}`}>
      <div
        className={`
          relative overflow-hidden hex-clip group flex flex-col h-full
          bg-bg-card transition-colors duration-300 ease-in-out
          hover:bg-bg-card-hover
          ${isInGame ? "scan-line" : ""}
        `}
      >
        {/* Champion splash background when in-game */}
        {championSplashUrl && (
          <div className="absolute inset-0 z-0">
            <Image
              src={championSplashUrl}
              alt={`${friend.gameInfo?.championName} splash`}
              fill
              className="object-cover opacity-20 scale-110"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg-card via-bg-card/85 to-bg-card/40" />
          </div>
        )}

        <div className="relative z-10 p-4 sm:p-5 flex flex-col flex-1">
        {/* Top row: profile icon + name + status + remove */}
        <div className="flex items-start gap-3">
          {/* Profile icon with gold border */}
          {profileIconUrl && (
            <div className="relative shrink-0">
              <div className="w-[52px] h-[52px] p-[2px] bg-gradient-to-b from-gold-primary to-gold-dark">
                <Image
                  src={profileIconUrl}
                  alt={`Ikona ${friend.gameName}`}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-bg-secondary text-gold-primary text-[9px] font-semibold px-1.5 py-[1px] border border-gold-dark">
                {friend.summonerLevel}
              </span>
            </div>
          )}

          {/* Name + rank */}
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center gap-2">
              <h3
                className="font-semibold text-gold-bright truncate tracking-wide"
                style={{ fontFamily: "var(--font-display)", fontSize: "0.9rem" }}
              >
                {friend.gameName}
              </h3>
              <span className="text-text-muted text-xs font-normal shrink-0">
                #{friend.tagLine}
              </span>
              {/* Status indicator */}
              <span
                className={`shrink-0 w-2 h-2 rounded-full ${
                  isInGame
                    ? "bg-blue-primary status-pulse"
                    : "bg-status-offline"
                }`}
              />
              {/* Rate limit warning */}
              {friend.rateLimited && (
                <span
                  className="shrink-0 w-2 h-2 rounded-full bg-amber-400"
                  title="Dane mogą być nieaktualne (limit zapytań)"
                />
              )}
            </div>
            <p className={`${getTierColorClass(friend.rank?.tier)} text-xs mt-0.5 tracking-wide uppercase flex items-center gap-1.5`}
               style={{ fontFamily: "var(--font-body)", fontWeight: 500 }}
            >
              {rankText}
              {rankChange === "up" && (
                <span className="text-win text-[10px] font-bold">▲</span>
              )}
              {rankChange === "down" && (
                <span className="text-loss text-[10px] font-bold">▼</span>
              )}
              {isFlexRank && (
                <span className="text-[9px] px-1 py-px bg-text-muted/20 border border-text-muted/30 text-text-muted normal-case tracking-normal">
                  Flex
                </span>
              )}
            </p>
            {!isInGame && friend.lastSeen && (
              <p className="text-text-muted text-[10px] mt-0.5 flex items-center gap-1 normal-case tracking-normal">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                {formatRelativeTime(friend.lastSeen)}
              </p>
            )}
          </div>

          {/* Pin + Remove buttons */}
          <div className="flex items-center gap-1 shrink-0 mt-1">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTogglePin(friend.puuid); }}
              className={`text-xs transition-all duration-200 cursor-pointer ${
                isPinned
                  ? "text-gold-primary opacity-60 hover:opacity-100"
                  : "text-text-muted hover:text-gold-primary opacity-0 group-hover:opacity-100"
              }`}
              title={isPinned ? "Odepnij" : "Przypnij"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={isPinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <path d="M12 2l3 7h7l-5.5 4.5L18.5 21 12 17l-6.5 4 2-7.5L2 9h7l3-7z" />
              </svg>
            </button>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(friend.puuid); }}
              className="text-text-muted hover:text-danger text-xs opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
              title="Usuń"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* In-game info bar — always reserve space for consistent card height */}
        <div className="mt-3 min-h-[40px]">
          {isInGame && friend.gameInfo ? (
            <div
              className="flex items-center gap-2 px-3 py-2 bg-blue-dark/20 border border-blue-dark/30 hover:bg-blue-dark/30 transition-colors cursor-pointer"
              style={{ clipPath: "polygon(0% 0%, calc(100% - 8px) 0%, 100% 8px, 100% 100%, 8px 100%, 0% calc(100% - 8px))" }}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowLiveGame(true); }}
              title="Pokaż szczegóły gry"
            >
              {championIconUrl && (
                <div className="w-6 h-6 border border-blue-secondary/50">
                  <Image
                    src={championIconUrl}
                    alt={friend.gameInfo.championName}
                    width={24}
                    height={24}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
              )}
              <span className="text-blue-bright text-xs font-semibold tracking-wide">
                {friend.gameInfo.championName !== "Unknown" ? friend.gameInfo.championName : "W grze"}
              </span>
              <span className="text-text-muted text-xs">
                {friend.gameInfo.gameMode}
              </span>
              <div className="ml-auto">
                <GameTimer gameStartTime={friend.gameInfo.gameStartTime} />
              </div>
            </div>
          ) : null}
        </div>

        {/* Party badge */}
        {friend.playingWith.length > 0 && (
          <div className="mt-2">
            <PartyBadge
              playingWith={friend.playingWith}
              allFriends={allFriends}
            />
          </div>
        )}

        {/* Divider + bottom section pushed to bottom */}
        <div className="mt-auto pt-3">
          <div className="lol-divider mb-3" />
          {/* Bottom row: recent matches + top champions */}
          <div className="flex items-start justify-between gap-4">
            <RecentMatches matches={friend.recentMatches} />
            <TopChampions
              champions={friend.topChampions}
              ddVersion={ddVersion}
            />
          </div>
        </div>
        </div>
      </div>
    </div>
    </Link>
    {showLiveGame && (
      <LiveGameModal puuid={friend.puuid} region={friend.region ?? "eun1"} onClose={() => setShowLiveGame(false)} />
    )}
    </>
  );
}
