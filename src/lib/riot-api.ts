import { z } from "zod";
import type { Region } from "@/utils/types";
import {
  RIOT_API_KEY,
  REGIONAL_URL,
  getPlatformUrl,
} from "./config";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_429_RETRIES = 1;

/**
 * Fetch from Riot API with:
 * - next.revalidate for Next.js Data Cache (persists across requests & deployments)
 * - next.tags for on-demand revalidation
 * - 429 retry with Retry-After header
 */
async function riotFetch(
  path: string,
  baseUrl: string,
  options: { revalidate?: number; tags?: string[] } = {},
  retryCount: number = 0
): Promise<Response> {
  if (!RIOT_API_KEY) {
    throw new Error("Brak klucza API — ustaw RIOT_API_KEY w pliku .env.local");
  }

  const url = `${baseUrl}${path}`;

  const fetchInit: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {
    headers: { "X-Riot-Token": RIOT_API_KEY },
  };

  if (options.revalidate !== undefined) {
    fetchInit.next = { revalidate: options.revalidate };
    if (options.tags) {
      fetchInit.next.tags = options.tags;
    }
  } else {
    fetchInit.cache = "no-store";
  }

  const res = await fetch(url, fetchInit);

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "2", 10);
    if (retryCount >= MAX_429_RETRIES) {
      throw new Error("Zbyt wiele zapytań — odczekaj chwilę i spróbuj ponownie");
    }
    await sleep(retryAfter * 1000);
    return riotFetch(path, baseUrl, options, retryCount + 1);
  }

  if (res.status === 401) {
    throw new Error("Nieprawidłowy klucz API Riot");
  }

  if (res.status === 403) {
    throw new Error("Klucz API wygasł lub nie ma dostępu — odśwież na developer.riotgames.com");
  }

  return res;
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const accountSchema = z.object({
  puuid: z.string(),
  gameName: z.string(),
  tagLine: z.string(),
});

const summonerSchema = z.object({
  puuid: z.string(),
  profileIconId: z.number(),
  summonerLevel: z.number(),
});

const spectatorParticipantSchema = z.object({
  puuid: z.string(),
  championId: z.number(),
  spell1Id: z.number(),
  spell2Id: z.number(),
  teamId: z.number(),
});

const spectatorSchema = z.object({
  gameId: z.number(),
  gameMode: z.string(),
  gameStartTime: z.number(),
  participants: z.array(spectatorParticipantSchema),
});

const leagueEntrySchema = z.object({
  queueType: z.string(),
  tier: z.string(),
  rank: z.string(),
  leaguePoints: z.number(),
});

const matchParticipantSchema = z.object({
  puuid: z.string(),
  win: z.boolean(),
  championName: z.string(),
  kills: z.number(),
  deaths: z.number(),
  assists: z.number(),
  totalMinionsKilled: z.number().nullable().optional().transform((v) => v ?? 0),
  neutralMinionsKilled: z.number().nullable().optional().transform((v) => v ?? 0),
});

const matchInfoSchema = z.object({
  gameEndTimestamp: z.number(),
  queueId: z.number().default(0),
  gameCreation: z.number().default(0),
  gameDuration: z.number().default(0),
  participants: z.array(matchParticipantSchema),
});

const matchSchema = z.object({
  info: matchInfoSchema,
});

const scoreboardParticipantSchema = z.object({
  puuid: z.string(),
  championName: z.string(),
  champLevel: z.number().default(0),
  summonerName: z.string().default(""),
  riotIdGameName: z.string().default(""),
  riotIdTagline: z.string().default(""),
  teamId: z.number(),
  kills: z.number().default(0),
  deaths: z.number().default(0),
  assists: z.number().default(0),
  totalMinionsKilled: z.number().default(0),
  neutralMinionsKilled: z.number().default(0),
  totalDamageDealtToChampions: z.number().default(0),
  goldEarned: z.number().default(0),
  visionScore: z.number().default(0),
  item0: z.number().default(0),
  item1: z.number().default(0),
  item2: z.number().default(0),
  item3: z.number().default(0),
  item4: z.number().default(0),
  item5: z.number().default(0),
  item6: z.number().default(0),
  win: z.boolean(),
});

const scoreboardMatchSchema = z.object({
  info: z.object({
    gameDuration: z.number(),
    gameMode: z.string(),
    participants: z.array(scoreboardParticipantSchema),
  }),
});

const championMasterySchema = z.object({
  championId: z.number(),
  championLevel: z.number(),
  championPoints: z.number(),
});

// ---------------------------------------------------------------------------
// Revalidation durations (seconds) for Next.js Data Cache
// ---------------------------------------------------------------------------
const REVALIDATE_IMMUTABLE = 3600;  // 1h — match details never change
const REVALIDATE_PROFILE = 600;     // 10min — account/summoner data
const REVALIDATE_RANK = 120;        // 2min — rank changes after games
const REVALIDATE_MASTERY = 300;     // 5min — mastery changes slowly
const REVALIDATE_MATCH_LIST = 60;   // 1min — new games appear
// Spectator: no cache (must be real-time)

// ---------------------------------------------------------------------------
// API functions — all use Next.js Data Cache via fetch next.revalidate
// ---------------------------------------------------------------------------

export async function getAccountByRiotId(gameName: string, tagLine: string) {
  const res = await riotFetch(
    `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    REGIONAL_URL,
    { revalidate: REVALIDATE_PROFILE, tags: [`account:${gameName.toLowerCase()}#${tagLine.toLowerCase()}`] }
  );
  if (res.status === 404) throw new Error("Nie znaleziono gracza");
  if (!res.ok) throw new Error("Błąd serwera");
  return accountSchema.parse(await res.json());
}

export async function getAccountByPuuid(puuid: string) {
  const res = await riotFetch(
    `/riot/account/v1/accounts/by-puuid/${puuid}`,
    REGIONAL_URL,
    { revalidate: REVALIDATE_PROFILE, tags: [`account:${puuid}`] }
  );
  if (!res.ok) throw new Error("Błąd serwera");
  return accountSchema.parse(await res.json());
}

export async function getSummonerByPuuid(puuid: string, region: Region = "eun1") {
  const res = await riotFetch(
    `/lol/summoner/v4/summoners/by-puuid/${puuid}`,
    getPlatformUrl(region),
    { revalidate: REVALIDATE_PROFILE, tags: [`summoner:${puuid}`] }
  );
  if (!res.ok) throw new Error("Błąd serwera");
  return summonerSchema.parse(await res.json());
}

export async function getActiveGame(puuid: string, region: Region = "eun1") {
  // No cache — spectator must be real-time
  const res = await riotFetch(
    `/lol/spectator/v5/active-games/by-summoner/${puuid}`,
    getPlatformUrl(region)
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Błąd serwera");
  return spectatorSchema.parse(await res.json());
}

export async function getRankedEntries(puuid: string, region: Region = "eun1") {
  const res = await riotFetch(
    `/lol/league/v4/entries/by-puuid/${puuid}`,
    getPlatformUrl(region),
    { revalidate: REVALIDATE_RANK, tags: [`rank:${puuid}`] }
  );
  if (!res.ok) throw new Error("Błąd serwera");
  return z.array(leagueEntrySchema).parse(await res.json());
}

export async function getMatchHistory(puuid: string, count: number = 5) {
  const res = await riotFetch(
    `/lol/match/v5/matches/by-puuid/${puuid}/ids?count=${count}`,
    REGIONAL_URL,
    { revalidate: REVALIDATE_MATCH_LIST, tags: [`match-list:${puuid}`] }
  );
  if (!res.ok) throw new Error("Błąd serwera");
  return z.array(z.string()).parse(await res.json());
}

export async function getMatch(matchId: string) {
  const res = await riotFetch(
    `/lol/match/v5/matches/${matchId}`,
    REGIONAL_URL,
    { revalidate: REVALIDATE_IMMUTABLE, tags: [`match:${matchId}`] }
  );
  if (!res.ok) throw new Error("Błąd serwera");
  return matchSchema.parse(await res.json());
}

export async function getMatchScoreboard(matchId: string) {
  const res = await riotFetch(
    `/lol/match/v5/matches/${matchId}`,
    REGIONAL_URL,
    { revalidate: REVALIDATE_IMMUTABLE, tags: [`match:${matchId}`] }
  );
  if (!res.ok) throw new Error("Błąd serwera");
  return scoreboardMatchSchema.parse(await res.json());
}

export async function getChampionMastery(puuid: string, count: number = 3, region: Region = "eun1") {
  const res = await riotFetch(
    `/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}/top?count=${count}`,
    getPlatformUrl(region),
    { revalidate: REVALIDATE_MASTERY, tags: [`mastery:${puuid}`] }
  );
  if (!res.ok) throw new Error("Błąd serwera");
  return z.array(championMasterySchema).parse(await res.json());
}

export async function getMatchHistoryFiltered(
  puuid: string,
  options: {
    queue?: number;
    startTime?: number;
    endTime?: number;
    start?: number;
    count?: number;
    type?: string;
  } = {}
) {
  const params = new URLSearchParams();
  if (options.queue !== undefined) params.set("queue", String(options.queue));
  if (options.startTime !== undefined) params.set("startTime", String(options.startTime));
  if (options.endTime !== undefined) params.set("endTime", String(options.endTime));
  if (options.start !== undefined && options.start > 0) params.set("start", String(options.start));
  params.set("count", String(options.count ?? 50));
  if (options.type) params.set("type", options.type);

  const res = await riotFetch(
    `/lol/match/v5/matches/by-puuid/${puuid}/ids?${params.toString()}`,
    REGIONAL_URL,
    { revalidate: REVALIDATE_MATCH_LIST, tags: [`match-list:${puuid}`] }
  );
  if (!res.ok) throw new Error("Błąd serwera");
  return z.array(z.string()).parse(await res.json());
}
