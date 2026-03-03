"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import type { RankedMatchDetail, RankDataPoint, Region } from "@/utils/types";
import { ScoreboardModal } from "@/components/scoreboard-modal/scoreboard-modal";
import { partyLabel, getPostScoreColor } from "@/utils/format";

const DDRAGON_IMG = "https://ddragon.leagueoflegends.com/cdn/img";

interface MatchHistoryTableProps {
  matches: RankedMatchDetail[];
  ddVersion: string;
  playerPuuid: string;
  friendMap?: Map<string, string>;
  region?: Region;
  rankProgression?: RankDataPoint[];
  totalLoaded?: number;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

function getQueueName(queueId: number): string {
  if (queueId === 420) return "Solo/Duo";
  if (queueId === 440) return "Flex";
  return "Ranked";
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "< 1h temu";
  if (hours < 24) return `${hours}h temu`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 dzień temu";
  if (days < 7) return `${days} dni temu`;
  return new Date(timestamp).toLocaleDateString("pl-PL");
}

export function MatchHistoryTable({ matches, ddVersion, playerPuuid, friendMap, region, rankProgression, totalLoaded, hasMore, loadingMore, onLoadMore }: MatchHistoryTableProps) {
  const [scoreboardMatchId, setScoreboardMatchId] = useState<string | null>(null);

  // Build matchId → LP delta map from rank progression points
  const lpDeltaMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!rankProgression || rankProgression.length === 0) return map;
    for (let i = 0; i < rankProgression.length; i++) {
      const point = rankProgression[i];
      const prevValue = i === 0 ? rankProgression[0].value - (point.match.win ? 20 : -16) : rankProgression[i - 1].value;
      const delta = point.value - prevValue;
      map.set(point.match.matchId, delta);
    }
    return map;
  }, [rankProgression]);

  if (matches.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-text-muted text-sm">Brak meczów w wybranym okresie</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-gold-primary text-sm font-semibold uppercase tracking-widest"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Historia meczów
        </h3>
        {totalLoaded !== undefined && (
          <span className="text-text-muted text-xs">
            Załadowano {totalLoaded} meczów
          </span>
        )}
      </div>
      <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
        {matches.map((match) => {
          const champIconUrl = `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${match.championName}.png`;
          const kda = match.deaths === 0
            ? "Perfect"
            : ((match.kills + match.assists) / match.deaths).toFixed(1);

          // Detect duo partners from friend list
          const duoNames: string[] = [];
          if (friendMap && match.teammatePuuids) {
            for (const tPuuid of match.teammatePuuids) {
              const name = friendMap.get(tPuuid);
              if (name) duoNames.push(name);
            }
          }

          return (
            <div
              key={match.matchId}
              onClick={() => setScoreboardMatchId(match.matchId)}
              className={`
                flex items-center gap-1.5 sm:gap-3 px-2 sm:px-4 py-1.5 sm:py-2.5 transition-colors cursor-pointer rounded-sm
                ${match.win
                  ? "bg-win/5 border-l-2 border-win/40 hover:bg-win/10"
                  : "bg-loss/5 border-l-2 border-loss/40 hover:bg-loss/10"
                }
              `}
            >
              {/* W/L + duration */}
              <div className="flex flex-col items-center shrink-0 w-8 sm:w-10">
                <span className={`text-xs sm:text-sm font-bold ${match.win ? "text-win" : "text-loss"}`}>
                  {match.win ? "W" : "L"}
                </span>
                <span className="text-text-muted text-[8px] sm:text-[9px] mt-0.5">
                  {formatDuration(match.gameDuration)}
                </span>
              </div>

              {/* Champion icon */}
              <div className="w-8 h-8 sm:w-10 sm:h-10 shrink-0 border border-gold-dark/30 rounded-sm">
                <Image
                  src={champIconUrl}
                  alt={match.championName}
                  width={40}
                  height={40}
                  className="w-full h-full object-cover rounded-sm"
                  unoptimized
                />
              </div>

              {/* Summoner spells */}
              <div className="flex flex-col gap-[2px] shrink-0">
                {match.spell1Name && match.spell1Name !== "Unknown" && (
                  <div className="w-[14px] h-[14px] sm:w-[18px] sm:h-[18px] border border-gold-dark/20 rounded-sm">
                    <Image
                      src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/spell/${match.spell1Name}.png`}
                      alt={match.spell1Name}
                      width={18}
                      height={18}
                      className="w-full h-full object-cover rounded-sm"
                      unoptimized
                    />
                  </div>
                )}
                {match.spell2Name && match.spell2Name !== "Unknown" && (
                  <div className="w-[14px] h-[14px] sm:w-[18px] sm:h-[18px] border border-gold-dark/20 rounded-sm">
                    <Image
                      src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/spell/${match.spell2Name}.png`}
                      alt={match.spell2Name}
                      width={18}
                      height={18}
                      className="w-full h-full object-cover rounded-sm"
                      unoptimized
                    />
                  </div>
                )}
              </div>

              {/* Rune tree icons — hidden on mobile */}
              <div className="hidden sm:flex flex-col gap-[2px] shrink-0">
                {match.primaryStyleIcon && (
                  <div className="w-[18px] h-[18px]">
                    <Image
                      src={`${DDRAGON_IMG}/${match.primaryStyleIcon}`}
                      alt="Primary"
                      width={18}
                      height={18}
                      className="w-full h-full object-contain"
                      unoptimized
                    />
                  </div>
                )}
                {match.subStyleIcon && (
                  <div className="w-[18px] h-[18px] opacity-60">
                    <Image
                      src={`${DDRAGON_IMG}/${match.subStyleIcon}`}
                      alt="Secondary"
                      width={18}
                      height={18}
                      className="w-full h-full object-contain"
                      unoptimized
                    />
                  </div>
                )}
              </div>

              {/* KDA */}
              <div className="flex flex-col items-center shrink-0 w-14 sm:w-16">
                <span className="text-text-primary text-[11px] sm:text-xs font-medium">
                  <span className="text-win">{match.kills}</span>
                  <span className="text-text-muted">/</span>
                  <span className="text-loss">{match.deaths}</span>
                  <span className="text-text-muted">/</span>
                  <span className="text-text-primary">{match.assists}</span>
                </span>
                <span className={`text-[9px] sm:text-[10px] ${
                  Number(kda) >= 3 ? "text-win" : Number(kda) >= 2 ? "text-gold-primary" : "text-text-muted"
                }`}>
                  {kda} KDA
                </span>
              </div>

              {/* CS — hidden on mobile */}
              <div className="hidden sm:flex flex-col items-center shrink-0 w-10">
                <span className="text-text-secondary text-xs">{match.cs}</span>
                <span className="text-text-muted text-[9px]">CS</span>
              </div>

              {/* Score */}
              <div className="flex flex-col items-center shrink-0 w-10 sm:w-12">
                <span className={`text-[11px] sm:text-xs font-bold ${getPostScoreColor(match.postScore)}`}>
                  {match.postScore.toFixed(1)}
                </span>
                {match.isMvp ? (
                  <span className="text-[7px] sm:text-[8px] font-bold px-1 sm:px-1.5 py-px rounded-full bg-[#ffb928] text-white leading-tight">
                    MVP
                  </span>
                ) : match.isAce ? (
                  <span className="text-[7px] sm:text-[8px] font-bold px-1 sm:px-1.5 py-px rounded-full bg-[#8b5cf6] text-white leading-tight">
                    ACE
                  </span>
                ) : (
                  <span className="text-text-muted text-[8px] sm:text-[9px]">SCORE</span>
                )}
              </div>

              {/* Items — hidden on mobile */}
              <div className="hidden sm:flex gap-[3px] shrink-0">
                {match.items.map((itemId, idx) => (
                  <div
                    key={idx}
                    className="w-[22px] h-[22px] border border-gold-dark/20 bg-[#0a0e1a] rounded-sm"
                  >
                    {itemId > 0 && (
                      <Image
                        src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/item/${itemId}.png`}
                        alt={`Item ${itemId}`}
                        width={22}
                        height={22}
                        className="w-full h-full object-cover rounded-sm"
                        unoptimized
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Spacer — party info (desktop only) */}
              <div className="hidden sm:flex flex-1 min-w-0 items-center gap-2">
                {duoNames.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-dark/15 border border-blue-dark/30 text-blue-bright flex items-center gap-1 truncate rounded-sm">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span className="truncate">{partyLabel(duoNames.length)} — {duoNames.join(", ")}</span>
                  </span>
                )}
              </div>

              {/* Right side: time ago + queue */}
              <div className="flex flex-col items-end shrink-0 ml-auto">
                <span className="text-text-muted text-[9px] sm:text-[10px]">
                  {timeAgo(match.gameCreation)}
                </span>
                <span className="text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.5 bg-text-muted/10 border border-text-muted/20 text-text-muted rounded-sm mt-0.5">
                  {getQueueName(match.queueId)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && onLoadMore && (
        <div className="flex justify-center mt-3">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="px-4 py-2 text-xs uppercase tracking-widest font-medium border border-gold-dark/40 bg-bg-secondary/40 text-gold-primary hover:bg-gold-dark/20 hover:text-gold-bright transition-all duration-200 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {loadingMore ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border border-gold-dark border-t-gold-primary rounded-full animate-spin" />
                Ładowanie...
              </span>
            ) : (
              "Załaduj więcej"
            )}
          </button>
        </div>
      )}

      {scoreboardMatchId && (
        <ScoreboardModal
          matchId={scoreboardMatchId}
          playerPuuid={playerPuuid}
          knownPlayersMap={friendMap}
          region={region}
          onClose={() => setScoreboardMatchId(null)}
        />
      )}
    </div>
  );
}
