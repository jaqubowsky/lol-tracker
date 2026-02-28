"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { RankedMatchDetail } from "@/utils/types";

interface ChampionStatsProps {
  matches: RankedMatchDetail[];
  ddVersion: string;
}

interface ChampionAgg {
  championName: string;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  totalDuration: number;
}

const DEFAULT_SHOWN = 6;

export function ChampionStats({ matches, ddVersion }: ChampionStatsProps) {
  const [expanded, setExpanded] = useState(false);

  const champions = useMemo(() => {
    const map = new Map<string, ChampionAgg>();

    for (const m of matches) {
      let agg = map.get(m.championName);
      if (!agg) {
        agg = {
          championName: m.championName,
          games: 0,
          wins: 0,
          kills: 0,
          deaths: 0,
          assists: 0,
          cs: 0,
          totalDuration: 0,
        };
        map.set(m.championName, agg);
      }
      agg.games++;
      if (m.win) agg.wins++;
      agg.kills += m.kills;
      agg.deaths += m.deaths;
      agg.assists += m.assists;
      agg.cs += m.cs;
      agg.totalDuration += m.gameDuration;
    }

    return [...map.values()].sort((a, b) => b.games - a.games);
  }, [matches]);

  const hasMore = champions.length > DEFAULT_SHOWN;
  const visible = expanded ? champions : champions.slice(0, DEFAULT_SHOWN);

  if (champions.length === 0) return null;

  return (
    <div className="mb-6">
      <h3
        className="text-gold-primary text-sm font-semibold uppercase tracking-widest mb-3"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Statystyki bohaterów
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
        {visible.map((c) => {
          const wr = Math.round((c.wins / c.games) * 100);
          const avgK = (c.kills / c.games).toFixed(1);
          const avgD = (c.deaths / c.games).toFixed(1);
          const avgA = (c.assists / c.games).toFixed(1);
          const csMin =
            c.totalDuration > 0
              ? ((c.cs / c.totalDuration) * 60).toFixed(1)
              : "0.0";

          return (
            <div
              key={c.championName}
              className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 bg-bg-secondary/30 border border-gold-dark/10 hover:border-gold-dark/30 transition-colors"
            >
              {/* Champion icon */}
              <div className="w-8 h-8 shrink-0 border border-gold-dark/30">
                <Image
                  src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${c.championName}.png`}
                  alt={c.championName}
                  width={32}
                  height={32}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>

              {/* Name + games */}
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-text-primary text-xs font-medium truncate">
                  {c.championName}
                </span>
                <span className="text-text-muted text-[10px]">
                  {c.games} {c.games === 1 ? "gra" : c.games < 5 ? "gry" : "gier"}
                </span>
              </div>

              {/* Win rate */}
              <div className="flex flex-col items-center shrink-0 w-12">
                <span
                  className={`text-xs font-bold ${
                    wr >= 60
                      ? "text-win"
                      : wr >= 50
                        ? "text-gold-primary"
                        : "text-loss"
                  }`}
                >
                  {wr}%
                </span>
                <span className="text-text-muted text-[9px]">
                  {c.wins}W {c.games - c.wins}L
                </span>
              </div>

              {/* Avg KDA */}
              <div className="flex flex-col items-center shrink-0 w-14 sm:w-16">
                <span className="text-text-primary text-[11px]">
                  {avgK}/{avgD}/{avgA}
                </span>
                <span className="text-text-muted text-[9px]">
                  {csMin} CS/min
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-text-muted hover:text-gold-primary text-[11px] uppercase tracking-widest transition-colors cursor-pointer"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {expanded ? "Zwiń" : `Pokaż wszystkich (${champions.length})`}
        </button>
      )}
    </div>
  );
}
