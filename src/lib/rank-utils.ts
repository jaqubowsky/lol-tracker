import type { RankInfo, RankedMatchDetail, RankDataPoint } from "@/utils/types";

const TIERS = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
] as const;

const DIVISIONS = ["IV", "III", "II", "I"] as const;
const LP_PER_DIVISION = 100;
const DIVISIONS_PER_TIER = 4;
// Master+ tiers have no divisions, treat as single division with up to 500 LP
const MASTER_TIER_INDEX = 7;

export function rankToValue(tier: string, division: string, lp: number): number {
  const tierIndex = TIERS.indexOf(tier as (typeof TIERS)[number]);
  if (tierIndex === -1) return 0;

  if (tierIndex >= MASTER_TIER_INDEX) {
    // Master+ : base value of all lower tiers + LP
    const baseDivisions = MASTER_TIER_INDEX * DIVISIONS_PER_TIER;
    const extraTiers = tierIndex - MASTER_TIER_INDEX;
    return (baseDivisions + extraTiers) * LP_PER_DIVISION + lp;
  }

  const divisionIndex = DIVISIONS.indexOf(division as (typeof DIVISIONS)[number]);
  if (divisionIndex === -1) return 0;

  return (tierIndex * DIVISIONS_PER_TIER + divisionIndex) * LP_PER_DIVISION + lp;
}

export function valueToRank(value: number): { tier: string; division: string; lp: number } {
  if (value < 0) return { tier: "IRON", division: "IV", lp: 0 };

  const masterBase = MASTER_TIER_INDEX * DIVISIONS_PER_TIER * LP_PER_DIVISION;

  if (value >= masterBase) {
    const remaining = value - masterBase;
    // Determine which master+ tier
    const extraTierUnits = Math.floor(remaining / LP_PER_DIVISION);
    const tierOffset = Math.min(extraTierUnits, TIERS.length - 1 - MASTER_TIER_INDEX);
    const lp = remaining - tierOffset * LP_PER_DIVISION;
    return {
      tier: TIERS[MASTER_TIER_INDEX + tierOffset],
      division: "I",
      lp: Math.max(0, Math.round(lp)),
    };
  }

  const totalDivisions = Math.floor(value / LP_PER_DIVISION);
  const lp = Math.round(value % LP_PER_DIVISION);
  const tierIndex = Math.min(Math.floor(totalDivisions / DIVISIONS_PER_TIER), MASTER_TIER_INDEX - 1);
  const divisionIndex = Math.min(totalDivisions % DIVISIONS_PER_TIER, DIVISIONS_PER_TIER - 1);

  return {
    tier: TIERS[tierIndex],
    division: DIVISIONS[divisionIndex],
    lp: Math.max(0, lp),
  };
}

const WIN_LP = 20;
const LOSS_LP = 16;

export function estimateRankProgression(
  currentRank: RankInfo | null,
  matches: RankedMatchDetail[]
): RankDataPoint[] {
  if (!currentRank || matches.length === 0) return [];

  const currentValue = rankToValue(currentRank.tier, currentRank.division, currentRank.lp);

  // Matches should be sorted newest-first (as Riot API returns them)
  // Walk backwards from current rank to estimate starting point
  let estimatedValue = currentValue;
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    // Undo the LP change: if they won, subtract WIN_LP; if they lost, add LOSS_LP
    if (match.win) {
      estimatedValue -= WIN_LP;
    } else {
      estimatedValue += LOSS_LP;
    }
  }
  // Clamp to minimum
  if (estimatedValue < 0) estimatedValue = 0;

  // Now walk forward from estimated start, recording each data point
  const points: RankDataPoint[] = [];
  let runningValue = estimatedValue;

  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    if (match.win) {
      runningValue += WIN_LP;
    } else {
      runningValue -= LOSS_LP;
    }
    if (runningValue < 0) runningValue = 0;

    const rank = valueToRank(runningValue);
    points.push({
      matchIndex: matches.length - i,
      value: runningValue,
      tier: rank.tier,
      division: rank.division,
      lp: rank.lp,
      match,
    });
  }

  return points;
}

export function getTierLabel(tier: string): string {
  const labels: Record<string, string> = {
    IRON: "Iron",
    BRONZE: "Bronze",
    SILVER: "Silver",
    GOLD: "Gold",
    PLATINUM: "Platinum",
    EMERALD: "Emerald",
    DIAMOND: "Diamond",
    MASTER: "Master",
    GRANDMASTER: "GM",
    CHALLENGER: "Chall",
  };
  return labels[tier] ?? tier;
}

export function getTierLabelShort(tier: string): string {
  const labels: Record<string, string> = {
    IRON: "I",
    BRONZE: "B",
    SILVER: "S",
    GOLD: "G",
    PLATINUM: "P",
    EMERALD: "E",
    DIAMOND: "D",
    MASTER: "M",
    GRANDMASTER: "GM",
    CHALLENGER: "C",
  };
  return labels[tier] ?? tier;
}

export function getTierColor(tier: string): string {
  const colors: Record<string, string> = {
    IRON: "#6b6561",
    BRONZE: "#a3765a",
    SILVER: "#8a9aab",
    GOLD: "#c8aa6e",
    PLATINUM: "#4e9996",
    EMERALD: "#2d9171",
    DIAMOND: "#576ace",
    MASTER: "#9d48e0",
    GRANDMASTER: "#e84057",
    CHALLENGER: "#f4c874",
  };
  return colors[tier] ?? "#c8aa6e";
}

/** Tailwind color class for rank tier text — use for JSX className. */
export function getTierColorClass(tier: string | undefined): string {
  if (!tier) return "text-text-muted";
  const classes: Record<string, string> = {
    IRON: "text-[#848484]",
    BRONZE: "text-[#cd8837]",
    SILVER: "text-[#8899aa]",
    GOLD: "text-[#ffb928]",
    PLATINUM: "text-[#55ccbb]",
    EMERALD: "text-[#00cc66]",
    DIAMOND: "text-[#88aaff]",
    MASTER: "text-[#cc66ff]",
    GRANDMASTER: "text-[#ff5555]",
    CHALLENGER: "text-[#f4c874]",
  };
  return classes[tier] ?? "text-text-secondary";
}

export { TIERS };
