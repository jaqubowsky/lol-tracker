export type Region = "eun1" | "euw1";

export type Tier =
  | "IRON"
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "PLATINUM"
  | "EMERALD"
  | "DIAMOND"
  | "MASTER"
  | "GRANDMASTER"
  | "CHALLENGER";

export type Division = "I" | "II" | "III" | "IV";

export type QueueType = "RANKED_SOLO_5x5" | "RANKED_FLEX_SR";

export interface RankInfo {
  tier: Tier;
  division: Division;
  lp: number;
  queueType: QueueType;
}

export interface GameInfo {
  gameId: number;
  championId: number;
  championName: string;
  gameMode: string;
  gameStartTime: number;
  spell1Id: number;
  spell2Id: number;
  teamId: number;
}

export interface RecentMatch {
  win: boolean;
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  gameEndTimestamp: number;
}

export interface ParticipantPerks {
  primaryStyleId: number;
  subStyleId: number;
  primarySelections: number[];  // 4 rune IDs
  subSelections: number[];      // 2 rune IDs
  statOffense: number;
  statFlex: number;
  statDefense: number;
}

export interface ScoreboardParticipant {
  puuid: string;
  championName: string;
  champLevel: number;
  summonerName: string;
  riotIdGameName: string;
  riotIdTagline: string;
  teamId: number;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  totalDamageDealtToChampions: number;
  goldEarned: number;
  visionScore: number;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  win: boolean;
  rank: RankInfo | null;
  spell1Name: string;
  spell2Name: string;
  perks: ParticipantPerks | null;
}

export interface ScoreboardData {
  matchId: string;
  gameDuration: number;
  gameMode: string;
  participants: ScoreboardParticipant[];
}

export interface ChampionMastery {
  championId: number;
  championName: string;
  championLevel: number;
  championPoints: number;
}

export interface Friend {
  puuid: string;
  gameName: string;
  tagLine: string;
  region: Region;
  profileIconId: number;
  summonerLevel: number;
  rank: RankInfo | null;
  inGame: boolean;
  gameInfo: GameInfo | null;
  recentMatches: RecentMatch[];
  topChampions: ChampionMastery[];
  playingWith: string[];
  lastSeen: number | null;
  rateLimited?: boolean;
}

export interface RankedMatchDetail {
  matchId: string;
  win: boolean;
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  queueId: number;
  gameCreation: number;
  gameDuration: number;
  teammatePuuids: string[];
  teammateChampions: Record<string, string>;
  items: number[];
  spell1Name: string;
  spell2Name: string;
  primaryStyleIcon: string;
  subStyleIcon: string;
}

export interface RankDataPoint {
  matchIndex: number;
  value: number;
  tier: string;
  division: string;
  lp: number;
  match: RankedMatchDetail;
}

export interface PlayerDetail {
  puuid: string;
  gameName: string;
  tagLine: string;
  profileIconId: number;
  summonerLevel: number;
  soloRank: RankInfo | null;
  flexRank: RankInfo | null;
  ddVersion: string;
}

export interface LiveGameParticipant {
  puuid: string;
  gameName: string;
  tagLine: string;
  championName: string;
  teamId: number;
  spell1Name: string;
  spell2Name: string;
  rank: RankInfo | null;
  perks: ParticipantPerks | null;
}

export interface LiveGameData {
  gameId: number;
  gameMode: string;
  gameStartTime: number;
  participants: LiveGameParticipant[];
}

export interface RuneSlotRune {
  id: number;
  name: string;
  icon: string;
  shortDesc: string;
}

export interface RuneTreeInfo {
  id: number;
  name: string;
  icon: string;
  slots: { runes: RuneSlotRune[] }[];
}

export type QueueFilter = "all" | "solo" | "flex";
export type TimeRangeFilter = "7d" | "14d" | "30d" | "all" | "custom";
export interface CustomDateRange {
  startDate: string; // ISO date string (YYYY-MM-DD)
  endDate: string;   // ISO date string (YYYY-MM-DD)
}
