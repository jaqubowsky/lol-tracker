export interface PostScoreInput {
  puuid: string;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  totalDamageDealtToChampions: number;
  goldEarned: number;
  visionScore: number;
  totalDamageDealtToObjectives: number;
  timeCCingOthers: number;
  teamPosition: string;
  individualPosition: string;
  teamId: number;
  win: boolean;
}

export interface PostScoreResult {
  puuid: string;
  postScore: number;
  postScoreRank: number;
  isMvp: boolean;
  isAce: boolean;
}

// Module-scope cache: matchId → results. Match data is immutable so scores never change.
const MAX_CACHE_SIZE = 200;
const scoreCache = new Map<string, PostScoreResult[]>();

type Role = "farming" | "jungle" | "support";

// Kills matter more than assists: KDA uses (K + 0.5*A) / max(D, 1)
// Support weights reduce vision/KP (naturally high for supports) and emphasize KDA + dmgShare
const FARMING_WEIGHTS = { kda: 0.30, dmgShare: 0.25, csPerMin: 0.20, kp: 0.15, vision: 0.10 };
const JUNGLE_WEIGHTS  = { kda: 0.25, kp: 0.20, objDmg: 0.20, vision: 0.15, csPerMin: 0.10, dmgShare: 0.10 };
const SUPPORT_WEIGHTS = { kda: 0.30, dmgShare: 0.20, cc: 0.20, kp: 0.15, vision: 0.15 };

function detectRole(teamPosition: string, individualPosition: string): Role {
  const pos = (teamPosition || individualPosition).toUpperCase();
  if (pos === "JUNGLE") return "jungle";
  if (pos === "UTILITY") return "support";
  return "farming";
}

function minMaxNormalize(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0.5);
  return values.map((v) => (v - min) / (max - min));
}

export function computePostScores(
  participants: PostScoreInput[],
  gameDurationSeconds: number,
  matchId?: string
): PostScoreResult[] {
  // Return cached results if available
  if (matchId) {
    const cached = scoreCache.get(matchId);
    if (cached) return cached;
  }

  // Short game — everyone gets 0
  if (gameDurationSeconds < 300) {
    return participants.map((p) => ({
      puuid: p.puuid,
      postScore: 0,
      postScoreRank: 0,
      isMvp: false,
      isAce: false,
    }));
  }

  const durationMin = gameDurationSeconds / 60;

  // AFK detection
  const isAfk = participants.map(
    (p) => p.kills + p.deaths + p.assists === 0
  );

  // Team totals
  const teamKills = new Map<number, number>();
  const teamDmg = new Map<number, number>();
  for (const p of participants) {
    teamKills.set(p.teamId, (teamKills.get(p.teamId) ?? 0) + p.kills);
    teamDmg.set(
      p.teamId,
      (teamDmg.get(p.teamId) ?? 0) + p.totalDamageDealtToChampions
    );
  }

  // Per-player raw metrics
  const metrics = participants.map((p, i) => {
    if (isAfk[i]) {
      return { kda: 0, csPerMin: 0, kp: 0, dmgShare: 0, vision: 0, objDmg: 0, cc: 0 };
    }
    const tk = Math.max(teamKills.get(p.teamId) ?? 1, 1);
    const td = Math.max(teamDmg.get(p.teamId) ?? 1, 1);
    return {
      // Adjusted KDA: kills count full, assists count half — prevents assist-inflated supports
      kda: Math.min((p.kills + 0.5 * p.assists) / Math.max(p.deaths, 1), 10),
      csPerMin: (p.totalMinionsKilled + p.neutralMinionsKilled) / durationMin,
      kp: (p.kills + p.assists) / tk,
      dmgShare: p.totalDamageDealtToChampions / td,
      // Sqrt-compress vision to reduce outlier advantage (support with 120 vision vs 15)
      vision: Math.sqrt(p.visionScore),
      objDmg: p.totalDamageDealtToObjectives,
      cc: p.timeCCingOthers,
    };
  });

  // Collect non-AFK indices for normalization
  const activeIndices = participants
    .map((_, i) => i)
    .filter((i) => !isAfk[i]);

  if (activeIndices.length === 0) {
    return participants.map((p) => ({
      puuid: p.puuid,
      postScore: 0,
      postScoreRank: 0,
      isMvp: false,
      isAce: false,
    }));
  }

  // Min-max normalize each metric across active players
  const metricKeys = ["kda", "csPerMin", "kp", "dmgShare", "vision", "objDmg", "cc"] as const;
  const normalized: Record<string, number[]> = {};

  for (const key of metricKeys) {
    const activeValues = activeIndices.map((i) => metrics[i][key]);
    const normalizedActive = minMaxNormalize(activeValues);

    const full = new Array(participants.length).fill(0);
    for (let j = 0; j < activeIndices.length; j++) {
      full[activeIndices[j]] = normalizedActive[j];
    }
    normalized[key] = full;
  }

  // Weighted sum per role
  const rawScores = participants.map((p, i) => {
    if (isAfk[i]) return 0;

    const role = detectRole(p.teamPosition, p.individualPosition);

    if (role === "support") {
      return (
        SUPPORT_WEIGHTS.kda * normalized.kda[i] +
        SUPPORT_WEIGHTS.dmgShare * normalized.dmgShare[i] +
        SUPPORT_WEIGHTS.cc * normalized.cc[i] +
        SUPPORT_WEIGHTS.kp * normalized.kp[i] +
        SUPPORT_WEIGHTS.vision * normalized.vision[i]
      );
    }

    if (role === "jungle") {
      return (
        JUNGLE_WEIGHTS.kda * normalized.kda[i] +
        JUNGLE_WEIGHTS.kp * normalized.kp[i] +
        JUNGLE_WEIGHTS.objDmg * normalized.objDmg[i] +
        JUNGLE_WEIGHTS.vision * normalized.vision[i] +
        JUNGLE_WEIGHTS.csPerMin * normalized.csPerMin[i] +
        JUNGLE_WEIGHTS.dmgShare * normalized.dmgShare[i]
      );
    }

    // farming (TOP/MID/ADC)
    return (
      FARMING_WEIGHTS.kda * normalized.kda[i] +
      FARMING_WEIGHTS.dmgShare * normalized.dmgShare[i] +
      FARMING_WEIGHTS.csPerMin * normalized.csPerMin[i] +
      FARMING_WEIGHTS.kp * normalized.kp[i] +
      FARMING_WEIGHTS.vision * normalized.vision[i]
    );
  });

  // Scale to 0–10, round to 1 decimal
  const scores = rawScores.map((s) => Math.round(s * 100) / 10);

  // Rank 1–10 descending by score
  const indexed = scores.map((s, i) => ({ score: s, index: i }));
  indexed.sort((a, b) => b.score - a.score);
  const ranks = new Array(participants.length).fill(0);
  for (let r = 0; r < indexed.length; r++) {
    ranks[indexed[r].index] = r + 1;
  }

  // MVP: rank 1 among winners. ACE: rank 1 among losers.
  let mvpIdx = -1;
  let aceIdx = -1;
  let bestWinScore = -1;
  let bestLossScore = -1;
  for (let i = 0; i < participants.length; i++) {
    if (isAfk[i]) continue;
    if (participants[i].win && scores[i] > bestWinScore) {
      bestWinScore = scores[i];
      mvpIdx = i;
    }
    if (!participants[i].win && scores[i] > bestLossScore) {
      bestLossScore = scores[i];
      aceIdx = i;
    }
  }

  const results = participants.map((p, i) => ({
    puuid: p.puuid,
    postScore: scores[i],
    postScoreRank: ranks[i],
    isMvp: i === mvpIdx,
    isAce: i === aceIdx,
  }));

  // Cache results keyed by matchId
  if (matchId) {
    if (scoreCache.size >= MAX_CACHE_SIZE) {
      const firstKey = scoreCache.keys().next().value;
      if (firstKey) scoreCache.delete(firstKey);
    }
    scoreCache.set(matchId, results);
  }

  return results;
}
