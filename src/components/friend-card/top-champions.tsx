"use client";

import Image from "next/image";
import type { ChampionMastery } from "@/utils/types";

interface TopChampionsProps {
  champions: ChampionMastery[];
  ddVersion: string;
}

function formatPoints(points: number): string {
  if (points >= 1000000) return `${(points / 1000000).toFixed(1)}M`;
  if (points >= 1000) return `${Math.floor(points / 1000)}k`;
  return String(points);
}

export function TopChampions({ champions, ddVersion }: TopChampionsProps) {
  if (champions.length === 0 || !ddVersion) return null;

  return (
    <div>
      <p className="text-text-secondary text-[10px] mb-1.5 text-right uppercase tracking-wider font-medium leading-[15px]">
        Top bohaterowie
      </p>
      <div className="flex gap-[3px] justify-end">
        {champions.map((champ) => (
          <div key={champ.championId} className="w-[22px] group/champ">
            <div className="w-[22px] h-[22px] border border-gold-dark group-hover/champ:border-gold-secondary transition-colors">
              <Image
                src={`https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${champ.championName}.png`}
                alt={champ.championName}
                width={22}
                height={22}
                className="w-full h-full object-cover"
                unoptimized
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-[3px] justify-end mt-1">
        {champions.map((champ) => (
          <span key={champ.championId} className="w-[22px] text-center text-text-muted text-[10px] font-medium leading-[10px]">
            {formatPoints(champ.championPoints)}
          </span>
        ))}
      </div>
    </div>
  );
}
