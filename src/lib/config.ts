export const RIOT_API_KEY = process.env.RIOT_API_KEY ?? "";

if (!RIOT_API_KEY && process.env.NODE_ENV === "production") {
  throw new Error(
    "RIOT_API_KEY is not set — add it to your environment variables before deploying"
  );
}
if (!RIOT_API_KEY) {
  console.warn("[config] RIOT_API_KEY is not set in environment variables");
}

import type { Region } from "@/utils/types";

export const REGIONAL_URL = "https://europe.api.riotgames.com";
export const DDRAGON_URL = "https://ddragon.leagueoflegends.com";

export function getPlatformUrl(region: Region): string {
  return `https://${region}.api.riotgames.com`;
}

export const POLL_INTERVAL = 30000;

export const RATE_LIMIT_PER_SECOND = 15;
export const RATE_LIMIT_PER_TWO_MINUTES = 80;

export const API_BATCH_SIZE = 5;
export const API_BATCH_SIZE_SMALL = 3;
