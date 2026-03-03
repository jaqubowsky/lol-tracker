import type { RecentMatch } from "@/utils/types";
import { getPostScoreColor } from "@/utils/format";

interface RecentMatchesProps {
  matches: RecentMatch[];
}

export function RecentMatches({ matches }: RecentMatchesProps) {
  if (matches.length === 0) {
    return (
      <div>
        <p className="text-text-muted text-[10px] uppercase tracking-wider">Brak danych</p>
      </div>
    );
  }

  const wins = matches.filter((m) => m.win).length;
  const losses = matches.length - wins;
  return (
    <div>
      <p className="text-text-secondary text-[10px] mb-1.5 uppercase tracking-wider font-medium leading-[15px]">
        Ostatnie mecze
        <span className="ml-1.5 text-text-muted">
          {wins}W {losses}L
        </span>
      </p>
      <div className="flex gap-[3px]">
        {matches.map((match, i) => (
          <div
            key={i}
            className={`
              w-[22px] h-[22px] text-[9px] font-bold flex items-center justify-center
              border
              ${match.win
                ? "bg-win/10 border-win/30 text-win"
                : "bg-loss/10 border-loss/30 text-loss"
              }
            `}
            style={{
              clipPath: "polygon(0% 0%, calc(100% - 4px) 0%, 100% 4px, 100% 100%, 4px 100%, 0% calc(100% - 4px))",
            }}
          >
            {match.win ? "W" : "L"}
          </div>
        ))}
      </div>
      {/* POST Score values */}
      <div className="flex items-center mt-1 gap-[3px]">
        {matches.map((match, i) => (
          <div
            key={i}
            className={`w-[22px] text-center text-[8px] font-bold ${getPostScoreColor(match.postScore)}`}
          >
            {match.postScore.toFixed(1)}
          </div>
        ))}
      </div>
    </div>
  );
}
