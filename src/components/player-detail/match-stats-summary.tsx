import type { RankedMatchDetail } from "@/utils/types";
import { getPostScoreColor } from "@/utils/format";

interface MatchStatsSummaryProps {
  matches: RankedMatchDetail[];
  ddVersion: string;
}

export function MatchStatsSummary({ matches, ddVersion }: MatchStatsSummaryProps) {
  if (matches.length === 0) {
    return null;
  }

  const wins = matches.filter((m) => m.win).length;
  const winRate = Math.round((wins / matches.length) * 100);

  const totalKills = matches.reduce((s, m) => s + m.kills, 0);
  const totalDeaths = matches.reduce((s, m) => s + m.deaths, 0);
  const totalAssists = matches.reduce((s, m) => s + m.assists, 0);
  const avgKDA = totalDeaths === 0
    ? "Perfect"
    : ((totalKills + totalAssists) / totalDeaths).toFixed(2);

  // Most played champion
  const champCounts: Record<string, number> = {};
  const champWins: Record<string, number> = {};
  const champGames: Record<string, number> = {};
  for (const m of matches) {
    champCounts[m.championName] = (champCounts[m.championName] ?? 0) + 1;
    champGames[m.championName] = (champGames[m.championName] ?? 0) + 1;
    if (m.win) champWins[m.championName] = (champWins[m.championName] ?? 0) + 1;
  }

  const mostPlayed = Object.entries(champCounts)
    .sort((a, b) => b[1] - a[1])[0];

  // Best win rate champion (min 2 games)
  const bestWinRate = Object.entries(champGames)
    .filter(([, games]) => games >= 2)
    .map(([name, games]) => ({
      name,
      games,
      winRate: Math.round(((champWins[name] ?? 0) / games) * 100),
    }))
    .sort((a, b) => b.winRate - a.winRate)[0];

  const statBoxes = [
    {
      label: "Win Rate",
      value: `${winRate}%`,
      sub: `${wins}W ${matches.length - wins}L`,
      color: winRate >= 50 ? "text-win" : "text-loss",
    },
    {
      label: "Średnie KDA",
      value: avgKDA,
      sub: `${(totalKills / matches.length).toFixed(1)} / ${(totalDeaths / matches.length).toFixed(1)} / ${(totalAssists / matches.length).toFixed(1)}`,
      color: Number(avgKDA) >= 3 ? "text-win" : Number(avgKDA) >= 2 ? "text-gold-primary" : "text-loss",
    },
    ...(mostPlayed
      ? [{
          label: "Najczęściej",
          value: mostPlayed[0],
          sub: `${mostPlayed[1]} gier`,
          color: "text-gold-bright",
          iconUrl: `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/champion/${mostPlayed[0]}.png`,
        }]
      : []),
    ...(bestWinRate
      ? [{
          label: "Najlepszy WR",
          value: `${bestWinRate.winRate}%`,
          sub: `${bestWinRate.name} (${bestWinRate.games} gier)`,
          color: "text-win",
        }]
      : []),
  ];

  // POST Score stats
  const avgOpScore = matches.reduce((s, m) => s + m.postScore, 0) / matches.length;
  const mvpCount = matches.filter((m) => m.isMvp).length;
  const aceCount = matches.filter((m) => m.isAce).length;
  const opScoreSub = [
    mvpCount > 0 ? `${mvpCount} MVP` : null,
    aceCount > 0 ? `${aceCount} ACE` : null,
  ].filter(Boolean).join(" \u00b7 ") || "Brak MVP/ACE";

  statBoxes.push({
    label: "POST Score",
    value: avgOpScore.toFixed(1),
    sub: opScoreSub,
    color: getPostScoreColor(avgOpScore),
  });

  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3 mb-6">
      {statBoxes.map((stat) => (
        <div
          key={stat.label}
          className="flex flex-col items-center gap-1 p-2 sm:p-3 bg-bg-secondary/50 border border-gold-dark/20"
          style={{ clipPath: "polygon(0% 0%, calc(100% - 8px) 0%, 100% 8px, 100% 100%, 8px 100%, 0% calc(100% - 8px))" }}
        >
          <span className="text-text-muted text-[10px] uppercase tracking-widest">{stat.label}</span>
          <span className={`text-base sm:text-lg font-bold ${stat.color}`} style={{ fontFamily: "var(--font-display)" }}>
            {stat.value}
          </span>
          <span className="text-text-secondary text-[10px]">{stat.sub}</span>
        </div>
      ))}
    </div>
  );
}
