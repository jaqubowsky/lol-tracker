"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import type { RankedMatchDetail, RankDataPoint, Region } from "@/utils/types";
import { ScoreboardModal } from "@/components/scoreboard-modal/scoreboard-modal";
import { partyLabel } from "@/utils/format";

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
      <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
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
                flex items-center gap-2 px-2 sm:px-3 py-1.5 transition-colors cursor-pointer
                ${match.win
                  ? "bg-win/5 border-l-2 border-win/40 hover:bg-win/10"
                  : "bg-loss/5 border-l-2 border-loss/40 hover:bg-loss/10"
                }
              `}
            >
              {/* W/L + LP indicator */}
              <div className="flex flex-col items-center shrink-0 w-8">
                <span className={`text-xs font-bold ${match.win ? "text-win" : "text-loss"}`}>
                  {match.win ? "W" : "L"}
                </span>
                {lpDeltaMap.has(match.matchId) && (
                  <span className={`text-[9px] font-semibold ${lpDeltaMap.get(match.matchId)! >= 0 ? "text-win/70" : "text-loss/70"}`}>
                    {lpDeltaMap.get(match.matchId)! > 0 ? "+" : ""}{lpDeltaMap.get(match.matchId)} LP
                  </span>
                )}
              </div>

              {/* Champion icon */}
              <div className="w-8 h-8 shrink-0 border border-gold-dark/30">
                <Image
                  src={champIconUrl}
                  alt={match.championName}
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>

              {/* Summoner spells */}
              <div className="flex flex-col gap-[1px] shrink-0">
                {match.spell1Name && match.spell1Name !== "Unknown" && (
                  <div className="w-[14px] h-[14px] border border-gold-dark/20">
                    <Image
                      src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/spell/${match.spell1Name}.png`}
                      alt={match.spell1Name}
                      width={14}
                      height={14}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </div>
                )}
                {match.spell2Name && match.spell2Name !== "Unknown" && (
                  <div className="w-[14px] h-[14px] border border-gold-dark/20">
                    <Image
                      src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/spell/${match.spell2Name}.png`}
                      alt={match.spell2Name}
                      width={14}
                      height={14}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </div>
                )}
              </div>

              {/* Rune tree icons (primary + secondary) */}
              <div className="flex flex-col gap-[1px] shrink-0">
                {match.primaryStyleIcon && (
                  <div className="w-[14px] h-[14px]">
                    <Image
                      src={`${DDRAGON_IMG}/${match.primaryStyleIcon}`}
                      alt="Primary"
                      width={14}
                      height={14}
                      className="w-full h-full object-contain"
                      unoptimized
                    />
                  </div>
                )}
                {match.subStyleIcon && (
                  <div className="w-[14px] h-[14px] opacity-60">
                    <Image
                      src={`${DDRAGON_IMG}/${match.subStyleIcon}`}
                      alt="Secondary"
                      width={14}
                      height={14}
                      className="w-full h-full object-contain"
                      unoptimized
                    />
                  </div>
                )}
              </div>

              {/* KDA */}
              <div className="flex flex-col items-center shrink-0 w-14 sm:w-16">
                <span className="text-text-primary text-[11px]">
                  {match.kills}/{match.deaths}/{match.assists}
                </span>
                <span className={`text-[9px] ${
                  Number(kda) >= 3 ? "text-win" : Number(kda) >= 2 ? "text-gold-primary" : "text-text-muted"
                }`}>
                  {kda} KDA
                </span>
              </div>

              {/* CS */}
              <span className="text-text-secondary text-[10px] shrink-0 text-center hidden sm:block">
                {match.cs} CS
              </span>

              {/* Items */}
              <div className="flex gap-[2px] shrink-0 hidden sm:flex">
                {match.items.map((itemId, idx) => (
                  <div
                    key={idx}
                    className="w-[18px] h-[18px] border border-gold-dark/20 bg-[#0a0e1a]"
                  >
                    {itemId > 0 && (
                      <Image
                        src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/item/${itemId}.png`}
                        alt={`Item ${itemId}`}
                        width={18}
                        height={18}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Flexible middle — party info or champion name */}
              <div className="flex-1 min-w-0 hidden sm:flex items-center gap-2">
                {duoNames.length > 0 ? (
                  <span className="text-[9px] px-1.5 py-px bg-blue-dark/15 border border-blue-dark/30 text-blue-bright flex items-center gap-1 truncate">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span className="truncate">{partyLabel(duoNames.length)} — {duoNames.join(", ")}</span>
                  </span>
                ) : (
                  <span className="text-text-muted/50 text-[10px] truncate">
                    {match.championName}
                  </span>
                )}
              </div>

              {/* Duration + Queue */}
              <div className="flex items-center gap-2 shrink-0 hidden sm:flex">
                <span className="text-text-muted text-[10px]">
                  {formatDuration(match.gameDuration)}
                </span>
                <span className="text-[9px] px-1 py-px bg-text-muted/10 border border-text-muted/20 text-text-muted">
                  {getQueueName(match.queueId)}
                </span>
              </div>

              {/* Time ago */}
              <span className="text-text-muted text-[10px] shrink-0 ml-auto sm:ml-0">
                {timeAgo(match.gameCreation)}
              </span>
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
