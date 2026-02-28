"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { resolveAccountNames } from "@/app/player/[puuid]/action";
import { checkRateLimit } from "@/utils/rate-limit-event";
import type { RankedMatchDetail } from "@/utils/types";

interface FrequentTeammatesProps {
  matches: RankedMatchDetail[];
  playerPuuid: string;
  ddVersion: string;
}

interface TeammateAgg {
  puuid: string;
  games: number;
  wins: number;
  champions: Map<string, number>;
}

type ResolvedAccount = { gameName: string; tagLine: string; profileIconId: number };

const MAX_SHOWN = 3;
const MAX_CHAMPS = 3;

export function FrequentTeammates({ matches, playerPuuid, ddVersion }: FrequentTeammatesProps) {
  const [names, setNames] = useState<Record<string, ResolvedAccount>>({});
  const [resolving, setResolving] = useState(false);

  const teammates = useMemo(() => {
    const map = new Map<string, TeammateAgg>();

    for (const m of matches) {
      for (const puuid of m.teammatePuuids) {
        if (puuid === playerPuuid) continue;
        let agg = map.get(puuid);
        if (!agg) {
          agg = { puuid, games: 0, wins: 0, champions: new Map() };
          map.set(puuid, agg);
        }
        agg.games++;
        if (m.win) agg.wins++;

        const champ = m.teammateChampions?.[puuid];
        if (champ) {
          agg.champions.set(champ, (agg.champions.get(champ) || 0) + 1);
        }
      }
    }

    return [...map.values()]
      .filter((t) => t.games >= 2)
      .sort((a, b) => b.games - a.games)
      .slice(0, MAX_SHOWN);
  }, [matches, playerPuuid]);

  useEffect(() => {
    if (teammates.length === 0) return;

    const toResolve = teammates
      .map((t) => t.puuid)
      .filter((p) => !names[p]);

    if (toResolve.length === 0) return;

    let cancelled = false;
    setResolving(true);

    resolveAccountNames(toResolve)
      .then((resolved) => {
        if (!cancelled) setNames((prev) => ({ ...prev, ...resolved }));
      })
      .catch((err) => {
        checkRateLimit(err);
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });

    return () => { cancelled = true; };
  }, [teammates]); // eslint-disable-line react-hooks/exhaustive-deps

  if (teammates.length === 0) return null;

  return (
    <div className="mb-6">
      <h3
        className="text-gold-primary text-sm font-semibold uppercase tracking-widest mb-3"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Najczęstsi współgrający
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
        {teammates.map((t) => {
          const acct = names[t.puuid];
          const wr = Math.round((t.wins / t.games) * 100);
          const topChamps = [...t.champions.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, MAX_CHAMPS);

          return (
            <Link
              key={t.puuid}
              href={`/player/${t.puuid}`}
              className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2.5 bg-bg-secondary/30 border border-gold-dark/10 hover:border-gold-dark/30 hover:bg-bg-secondary/50 transition-colors"
            >
              {/* Avatar */}
              <div className="w-8 h-8 shrink-0 border border-gold-dark/30 bg-bg-secondary overflow-hidden">
                {acct ? (
                  <Image
                    src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/profileicon/${acct.profileIconId}.png`}
                    alt={acct.gameName}
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-muted text-[10px]">
                    {resolving ? "..." : "?"}
                  </div>
                )}
              </div>

              {/* Name + games */}
              <div className="flex flex-col min-w-0 flex-1">
                {acct ? (
                  <span className="text-text-primary text-xs font-medium truncate">
                    {acct.gameName}
                    <span className="text-text-muted">#{acct.tagLine}</span>
                  </span>
                ) : (
                  <span className="text-text-muted text-xs truncate">
                    {resolving ? "..." : t.puuid.slice(0, 8)}
                  </span>
                )}
                <span className="text-text-muted text-[10px]">
                  {t.games} {t.games === 1 ? "gra" : t.games < 5 ? "gry" : "gier"} razem
                </span>
              </div>

              {/* Champion icons */}
              <div className="flex -space-x-1 shrink-0">
                {topChamps.map(([champ, count]) => (
                  <div
                    key={champ}
                    className="w-6 h-6 border border-gold-dark/30 rounded-full overflow-hidden"
                    title={`${champ} (${count})`}
                  >
                    <Image
                      src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${champ}.png`}
                      alt={champ}
                      width={24}
                      height={24}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </div>
                ))}
              </div>

              {/* Win rate */}
              <div className="flex flex-col items-center shrink-0 w-12">
                <span
                  className={`text-xs font-bold ${
                    wr >= 60 ? "text-win" : wr >= 50 ? "text-gold-primary" : "text-loss"
                  }`}
                >
                  {wr}%
                </span>
                <span className="text-text-muted text-[9px]">
                  {t.wins}W {t.games - t.wins}L
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
