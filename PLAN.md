# LoL "Who's Online" Live Tracker — Implementation Plan

## Context

Build a web dashboard for a friend group playing League of Legends on EUNE. The app shows which friends are currently in-game, what champion they're playing, game mode, and a live game timer. Friends are added by Riot ID (`GameName#TAG`). The page auto-refreshes every 30 seconds.

**Important API note:** Riot deactivated Spectator V5. We use **Spectator V4** instead, which requires `encryptedSummonerId` (not PUUID).

**Architecture:** Single Next.js 16 app with Server Actions. TypeScript throughout. Kebab-case file naming. Colocated logic. Deploys to Vercel out of the box.

**Language:** All UI text in Polish (labels, buttons, status messages, errors). Code (variables, comments) stays in English.

---

## Project Structure

```
lol-project/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout (fonts, metadata)
│   │   ├── page.tsx                      # Main dashboard page
│   │   └── globals.css                   # @import "tailwindcss" + @theme (LoL colors)
│   ├── components/
│   │   ├── header.tsx
│   │   ├── add-friend-form/
│   │   │   ├── add-friend-form.tsx       # Form component
│   │   │   ├── schema.ts                # Zod: GameName#TAG input validation
│   │   │   └── action.ts                # "use server" — resolveFriend
│   │   ├── friend-list/
│   │   │   ├── friend-list.tsx           # List container + sorting
│   │   │   └── action.ts                # "use server" — checkFriendsStatus
│   │   ├── friend-card/
│   │   │   ├── friend-card.tsx         # Card with splash bg, rank, status
│   │   │   ├── recent-matches.tsx      # W/L indicators for last 5 games
│   │   │   ├── top-champions.tsx       # Top 3 champion mastery badges
│   │   │   └── party-badge.tsx         # "Playing with X" indicator
│   │   └── game-timer.tsx
│   ├── lib/
│   │   ├── riot-api.ts                   # Riot API client (native fetch) + rate limiter
│   │   ├── game-checker.ts               # Spectator checks + Data Dragon maps
│   │   └── config.ts                     # Region URLs, constants
│   └── utils/
│       ├── storage.ts                    # localStorage helpers
│       └── types.ts                      # Shared types (Friend, RankInfo, etc.)
├── public/
│   └── favicon.ico
├── postcss.config.mjs                    # @tailwindcss/postcss plugin
├── .env.local                            # RIOT_API_KEY=RGAPI-xxxxx
├── .gitignore
├── next.config.ts
├── tsconfig.json
└── package.json
```

**Colocation principle:** Server actions and Zod schemas live next to the component that uses them. Only project-wide utilities (types, storage, Riot API client) live in `lib/` or `utils/`.

---

## Tailwind v4 Setup

No `tailwind.config.ts` — Tailwind v4 is configured entirely in CSS via `@theme`:

**`globals.css`:**
```css
@import "tailwindcss";

@theme {
  --color-bg-primary: #0a0a0f;
  --color-bg-card: #13131a;
  --color-bg-hover: #1a1a2e;
  --color-accent-gold: #c89b3c;
  --color-accent-teal: #0ac8b9;
  --color-text-primary: #f0e6d3;
  --color-text-muted: #a09b8c;
  --color-status-online: #1db954;
  --color-status-offline: #5a5a5a;
  --color-danger: #e84057;
}
```

Usage: `bg-bg-primary`, `text-accent-gold`, `border-status-online`, etc.

**`postcss.config.mjs`:**
```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

---

## Server Actions (colocated)

### `components/add-friend-form/action.ts`

```typescript
"use server"
export async function resolveFriend(gameName: string, tagLine: string): Promise<Friend>
```

- Calls `getAccountByRiotId` -> `getSummonerByPuuid` -> `getRankedEntries` -> `getChampionMastery` -> `getMatchHistory` + `getMatch` (last 5)
- Returns a full `Friend` object with rank, top champions, and recent matches (without live game status)
- Input validated with Zod schema from sibling `schema.ts`
- Throws on invalid Riot ID (404), etc.

### `components/friend-list/action.ts`

```typescript
"use server"
export async function checkFriendsStatus(friends: Friend[]): Promise<{ friends: Friend[]; ddVersion: string }>
```

- Takes the friend list from localStorage (sent by the client)
- Calls `getActiveGame` for each friend via `game-checker.ts`
- Returns the same list enriched with `inGame`, `gameInfo`, `playingWith`, and `ddVersion` (Data Dragon version for image URLs)
- **Party detection:** cross-references `gameId` across all friends — if two friends share the same `gameId`, populates `playingWith` array on both

---

## Riot API Calls (via `lib/riot-api.ts`)

| Function | Riot Endpoint | Route |
|----------|--------------|-------|
| `getAccountByRiotId(name, tag)` | `/riot/account/v1/accounts/by-riot-id/{name}/{tag}` | `europe` regional |
| `getSummonerByPuuid(puuid)` | `/lol/summoner/v4/summoners/by-puuid/{puuid}` | `eun1` platform |
| `getActiveGame(summonerId)` | `/lol/spectator/v4/active-games/by-summoner/{summonerId}` | `eun1` platform |
| `getRankedEntries(summonerId)` | `/lol/league/v4/entries/by-summoner/{summonerId}` | `eun1` platform |
| `getMatchHistory(puuid, count)` | `/lol/match/v5/matches/by-puuid/{puuid}/ids` | `europe` regional |
| `getMatch(matchId)` | `/lol/match/v5/matches/{matchId}` | `europe` regional |
| `getChampionMastery(puuid, top)` | `/lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}/top` | `eun1` platform |

Riot API response payloads are validated with Zod schemas colocated in `lib/riot-api.ts`.

### Rate Limiting

- Dev key limits: 20 req/sec, 100 req/2min
- Self-throttle to 15/sec, 80/2min (headroom)
- Simple token bucket in `riot-api.ts` with retry on 429

---

## Game Status Checking (`lib/game-checker.ts`)

- Called by `checkFriendsStatus` server action
- Checks each friend sequentially (1 spectator call per friend)
- Loads champion + summoner spell maps from Data Dragon and caches in module scope
- Champion names validated at runtime against the Data Dragon map (170+ champs, updated every patch — not practical as a static union type)
- Budget per poll: 20 friends × 1 spectator call = 20 req (well within limits)
- Adding a friend: ~9 calls (account + summoner + ranked + mastery + 5 match details)

---

## TypeScript Types (`utils/types.ts`)

```typescript
type Tier = "IRON" | "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "EMERALD" | "DIAMOND" | "MASTER" | "GRANDMASTER" | "CHALLENGER";

type Division = "I" | "II" | "III" | "IV";

type QueueType = "RANKED_SOLO_5x5" | "RANKED_FLEX_SR";

interface RankInfo {
  tier: Tier;
  division: Division;
  lp: number;
  queueType: QueueType;
}

interface GameInfo {
  gameId: number;
  championId: number;
  championName: string;   // validated at runtime against Data Dragon champion map
  gameMode: string;
  gameStartTime: number;
  spell1Id: number;
  spell2Id: number;
  teamId: number;
}

interface RecentMatch {
  win: boolean;
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
}

interface ChampionMastery {
  championId: number;
  championName: string;
  championLevel: number;
  championPoints: number;
}

interface Friend {
  puuid: string;
  gameName: string;
  tagLine: string;
  summonerId: string;
  profileIconId: number;
  summonerLevel: number;
  rank: RankInfo | null;
  inGame: boolean;
  gameInfo: GameInfo | null;
  recentMatches: RecentMatch[];     // last 5 games
  topChampions: ChampionMastery[];  // top 3 most played
  playingWith: string[];            // puuids of friends in the same game
}
```

---

## Frontend Design

### Component Hierarchy

```
page.tsx (state + localStorage + 30s auto-refresh)
├── Header (title)
├── AddFriendForm (input GameName#TAG → calls colocated resolveFriend action)
└── FriendList (polls via colocated checkFriendsStatus action, sorts: in-game first)
    └── FriendCard (champion splash bg when in-game, profile icon, name, rank)
        ├── GameTimer (live ticking timer, client-side)
        ├── PartyBadge ("Playing with Player2")
        ├── RecentMatches (last 5: W/L/W/W/L indicators)
        └── TopChampions (top 3 mastery badges with icons)
```

All components are client components (`"use client"`) since they rely on localStorage and frequent state updates. They call server actions directly — no fetch/API layer needed.

### Storage (`utils/storage.ts`)

- `getFriends()` — read friend list from localStorage
- `saveFriends(friends)` — write friend list to localStorage
- `addFriend(friend)` — append to list and save
- `removeFriend(puuid)` — filter out and save
- Key: `lol-tracker-friends`
- Static data (puuid, summonerId, name, rank, icon) is persisted
- Game status (inGame, gameInfo) is ephemeral — fetched on each poll cycle

### Images (Data Dragon CDN, no downloads)

- Profile icon: `https://ddragon.leagueoflegends.com/cdn/{ver}/img/profileicon/{id}.png`
- Champion icon: `https://ddragon.leagueoflegends.com/cdn/{ver}/img/champion/{Name}.png`
- Champion splash (card bg): `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/{Name}_0.jpg` — used as blurred, low-opacity background on FriendCard when in-game

---

## Build Order (13 Steps)

### Phase 1: Project Setup + Server Logic

| Step | Task | Files |
|------|------|-------|
| 1 | Next.js 16 init + Tailwind v4 + PostCSS + `.env.local` + `.gitignore` | `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `globals.css` |
| 2 | Config + shared types | `src/lib/config.ts`, `src/utils/types.ts` |
| 3 | Riot API client with rate limiter + Zod response schemas | `src/lib/riot-api.ts` |
| 4 | Game checker + Data Dragon loader | `src/lib/game-checker.ts` |
| 5 | Server actions (colocated with components) | `src/components/add-friend-form/action.ts`, `src/components/friend-list/action.ts` |

### Phase 2: Frontend (core)

| Step | Task | Files |
|------|------|-------|
| 6 | localStorage utility | `src/utils/storage.ts` |
| 7 | Main page with state + auto-refresh | `src/app/page.tsx`, `src/app/layout.tsx` |
| 8 | AddFriendForm + input schema | `src/components/add-friend-form/*` |
| 9 | FriendCard with champion splash bg + FriendList | `src/components/friend-card/*`, `src/components/friend-list/*` |
| 10 | GameTimer + Header | `src/components/game-timer.tsx`, `src/components/header.tsx` |

### Phase 3: Enhanced features

| Step | Task | Files |
|------|------|-------|
| 11 | RecentMatches component (last 5 W/L) | `src/components/friend-card/recent-matches.tsx` |
| 12 | TopChampions mastery badges | `src/components/friend-card/top-champions.tsx` |
| 13 | PartyBadge (playing with detection) | `src/components/friend-card/party-badge.tsx` |

### Phase 4: Polish

| Step | Task |
|------|------|
| 14 | Error states, loading skeletons, refresh button, animations, responsive layout |

---

## Verification

1. **Server action test:** Add a friend via the form with a real Riot ID -> confirm card appears
2. **Spectator test:** Add a friend who is in-game -> shows champion, game mode, live timer
3. **Frontend test:** Open `localhost:3000`, see the dashboard, add/remove friends
4. **Auto-refresh:** Wait 30s, confirm statuses update
5. **Persistence:** Reload page -> friends still there (localStorage)
6. **Remove:** Click remove -> card disappears
7. **Vercel deploy:** `vercel deploy` -> confirm it works with `RIOT_API_KEY` env var in Vercel dashboard

---

## Caveats

- **Dev API key expires every 24h** — regenerate at developer.riotgames.com during development
- **Spectator V4 may also be deprecated** in the future — `riot-api.ts` is isolated for easy swapping
- **Champion name edge cases** — some Data Dragon names differ from display (e.g., `MonkeyKing` for Wukong)
- **Vercel serverless cold starts** — first server action call may be slightly slower; Data Dragon cache reloads per cold start
