# Tasks

## Phase 1: Project Setup + Server Logic

### Task 1.1 — Initialize Next.js 16 project
- [ ] Run `npx create-next-app@latest . --typescript --app`
- [ ] Install additional deps: `npm install zod`
- [ ] Install Tailwind v4: `npm install tailwindcss @tailwindcss/postcss postcss`
- [ ] Create `postcss.config.mjs` with `@tailwindcss/postcss` plugin
- [ ] Set up `src/app/globals.css` with `@import "tailwindcss"` and `@theme` block containing all LoL custom colors (`bg-primary`, `bg-card`, `bg-hover`, `accent-gold`, `accent-teal`, `text-primary`, `text-muted`, `status-online`, `status-offline`, `danger`)
- [ ] Create `.env.local` with `RIOT_API_KEY=RGAPI-xxxxx` placeholder
- [ ] Update `.gitignore` to include `.env.local`, `node_modules`, `.next`
- [ ] Verify `npm run dev` starts without errors and Tailwind classes render
- **Files:** `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `src/app/globals.css`, `.env.local`, `.gitignore`

### Task 1.2 — Config and shared types
- [ ] Create `src/lib/config.ts`:
  - Export `RIOT_API_KEY` from `process.env.RIOT_API_KEY`
  - Export `REGIONAL_URL` = `https://europe.api.riotgames.com`
  - Export `PLATFORM_URL` = `https://eun1.api.riotgames.com`
  - Export `DDRAGON_URL` = `https://ddragon.leagueoflegends.com`
  - Export `POLL_INTERVAL` = `30000`
  - Export `RATE_LIMIT_PER_SECOND` = `15`
  - Export `RATE_LIMIT_PER_TWO_MINUTES` = `80`
- [ ] Create `src/utils/types.ts`:
  - `Tier` type — union of all 10 LoL tiers (IRON through CHALLENGER)
  - `Division` type — `"I" | "II" | "III" | "IV"`
  - `QueueType` type — `"RANKED_SOLO_5x5" | "RANKED_FLEX_SR"`
  - `RankInfo` interface — `tier`, `division`, `lp`, `queueType`
  - `GameInfo` interface — `gameId`, `championId`, `championName`, `gameMode` (string), `gameStartTime`, `spell1Id`, `spell2Id`, `teamId`
  - `RecentMatch` interface — `win`, `championName`, `kills`, `deaths`, `assists`
  - `ChampionMastery` interface — `championId`, `championName`, `championLevel`, `championPoints`
  - `Friend` interface — `puuid`, `gameName`, `tagLine`, `summonerId`, `profileIconId`, `summonerLevel`, `rank`, `inGame`, `gameInfo`, `recentMatches`, `topChampions`, `playingWith`
  - Export all types
- **Files:** `src/lib/config.ts`, `src/utils/types.ts`

### Task 1.3 — Riot API client with rate limiter
- [ ] Create `src/lib/riot-api.ts`
- [ ] Implement token bucket rate limiter:
  - Track `requestsThisSecond` and `requestsThisTwoMinutes`
  - `sleep()` helper
  - Wait if at limit, reset counters on timers
  - Handle 429 responses: read `Retry-After` header, wait, retry
- [ ] Implement `rateLimitedFetch(url, baseUrl)` — core function wrapping native `fetch` with rate limiting + `X-Riot-Token` header
- [ ] Define Zod schemas for each Riot API response payload:
  - `accountSchema` — validates account-v1 response
  - `summonerSchema` — validates summoner-v4 response
  - `spectatorSchema` — validates spectator-v4 response (handle 404 = not in game)
  - `leagueEntrySchema` — validates league-v4 response (array of entries)
  - `matchSchema` — validates match-v5 response
  - `championMasterySchema` — validates champion-mastery-v4 response
- [ ] Implement exported functions (each validates response with Zod):
  - `getAccountByRiotId(gameName, tagLine)` — `GET {REGIONAL}/riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}`
  - `getSummonerByPuuid(puuid)` — `GET {PLATFORM}/lol/summoner/v4/summoners/by-puuid/{puuid}`
  - `getActiveGame(summonerId)` — `GET {PLATFORM}/lol/spectator/v4/active-games/by-summoner/{summonerId}` → returns `null` on 404
  - `getRankedEntries(summonerId)` — `GET {PLATFORM}/lol/league/v4/entries/by-summoner/{summonerId}`
  - `getMatchHistory(puuid, count)` — `GET {REGIONAL}/lol/match/v5/matches/by-puuid/{puuid}/ids?count={count}`
  - `getMatch(matchId)` — `GET {REGIONAL}/lol/match/v5/matches/{matchId}`
  - `getChampionMastery(puuid, count)` — `GET {PLATFORM}/lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}/top?count={count}`
- **Files:** `src/lib/riot-api.ts`

### Task 1.4 — Game checker + Data Dragon loader
- [ ] Create `src/lib/game-checker.ts`
- [ ] Implement `loadStaticData()`:
  - Fetch latest version from `{DDRAGON}/api/versions.json`
  - Fetch champion data from `{DDRAGON}/cdn/{version}/data/en_US/champion.json`
  - Build `championMap`: `Record<number, string>` mapping champion key (number) to champion name
  - Fetch summoner spell data from `{DDRAGON}/cdn/{version}/data/en_US/summoner.json`
  - Build `spellMap`: `Record<number, string>` mapping spell key to spell name
  - Cache all in module-scope variables
  - Return `ddVersion`
- [ ] Implement `getChampionName(championId)` — lookup from cached map
- [ ] Implement `checkFriendGameStatus(friend)`:
  - Call `getActiveGame(friend.summonerId)`
  - If in game: find participant by `summonerId`, extract `championId`, resolve champion name, build `GameInfo`
  - If not in game (null): return `{ inGame: false, gameInfo: null }`
- [ ] Implement `detectParties(friends)`:
  - Group friends by `gameInfo.gameId`
  - For each group with 2+ friends, populate `playingWith` arrays with the other friends' puuids
- [ ] Export `loadStaticData`, `checkFriendGameStatus`, `detectParties`, `getChampionName`
- **Files:** `src/lib/game-checker.ts`

### Task 1.5 — Server actions (colocated)
- [ ] Create `src/components/add-friend-form/action.ts`:
  - `"use server"` directive
  - `resolveFriend(gameName: string, tagLine: string): Promise<Friend>`
  - Call chain: `getAccountByRiotId` → `getSummonerByPuuid` → `getRankedEntries` → `getChampionMastery(puuid, 3)` → `getMatchHistory(puuid, 5)` → `getMatch` for each match ID
  - Build and return `Friend` object with `inGame: false`, `gameInfo: null`, `playingWith: []`
  - Handle errors: 404 → throw "Nie znaleziono gracza" (player not found), other errors → throw "Błąd serwera" (server error)
- [ ] Create `src/components/friend-list/action.ts`:
  - `"use server"` directive
  - `checkFriendsStatus(friends: Friend[]): Promise<{ friends: Friend[]; ddVersion: string }>`
  - Call `loadStaticData()` to get/refresh Data Dragon version
  - For each friend, call `checkFriendGameStatus(friend)` and merge result
  - Call `detectParties(friends)` to populate `playingWith` arrays
  - Return `{ friends, ddVersion }`
- **Files:** `src/components/add-friend-form/action.ts`, `src/components/friend-list/action.ts`

---

## Phase 2: Frontend (core)

### Task 2.1 — localStorage utility
- [ ] Create `src/utils/storage.ts`
- [ ] Define storage key constant: `LOL_TRACKER_FRIENDS`
- [ ] Implement `getFriends(): Friend[]` — parse from localStorage, return `[]` if empty/invalid
- [ ] Implement `saveFriends(friends: Friend[]): void` — stringify and save to localStorage
- [ ] Implement `addFriend(friend: Friend): Friend[]` — append, save, return updated list. Throw if puuid already exists ("Gracz już dodany")
- [ ] Implement `removeFriend(puuid: string): Friend[]` — filter out, save, return updated list
- [ ] Handle SSR safety: guard all `localStorage` calls with `typeof window !== "undefined"` check
- **Files:** `src/utils/storage.ts`

### Task 2.2 — Main page + layout
- [ ] Update `src/app/layout.tsx`:
  - Set `<html lang="pl">` for Polish
  - Import `globals.css`
  - Set metadata: title "LoL Tracker", description in Polish
  - Apply dark background via Tailwind: `bg-bg-primary text-text-primary min-h-screen`
- [ ] Create `src/app/page.tsx`:
  - `"use client"` directive
  - State: `friends` (Friend[]), `loading` (boolean), `ddVersion` (string), `error` (string | null)
  - On mount: load friends from localStorage via `getFriends()`
  - On mount + every 30s: call `checkFriendsStatus(friends)` server action, update state with enriched friends and `ddVersion`
  - `handleAddFriend(friend)`: add to state + localStorage
  - `handleRemoveFriend(puuid)`: remove from state + localStorage
  - Render: `<Header />`, `<AddFriendForm onAdd={handleAddFriend} />`, `<FriendList friends={friends} ddVersion={ddVersion} onRemove={handleRemoveFriend} loading={loading} />`
  - Show "Ostatnia aktualizacja: {time}" (last updated) at bottom
- **Files:** `src/app/layout.tsx`, `src/app/page.tsx`

### Task 2.3 — AddFriendForm component
- [ ] Create `src/components/add-friend-form/schema.ts`:
  - Zod schema validating input string matches `GameName#TAG` format
  - `gameName`: non-empty string after trim
  - `tagLine`: non-empty string after trim, typically 3-5 chars
- [ ] Create `src/components/add-friend-form/add-friend-form.tsx`:
  - `"use client"` directive
  - Props: `onAdd: (friend: Friend) => void`
  - State: `input` (string), `loading` (boolean), `error` (string | null)
  - On submit: validate with Zod schema, split on `#`, call `resolveFriend` server action
  - On success: call `onAdd(friend)`, clear input
  - On error: display error message in Polish ("Nieprawidłowy format — wpisz Nazwa#TAG", "Nie znaleziono gracza", "Gracz już dodany")
  - UI: single text input with placeholder "Nazwa#TAG", "Dodaj" (Add) button
  - Loading state: spinner/disabled button while resolving
  - Tailwind styling: dark input with gold border on focus, rounded, consistent with LoL theme
- **Files:** `src/components/add-friend-form/schema.ts`, `src/components/add-friend-form/add-friend-form.tsx`

### Task 2.4 — FriendCard + FriendList
- [ ] Create `src/components/friend-list/friend-list.tsx`:
  - `"use client"` directive
  - Props: `friends: Friend[]`, `ddVersion: string`, `onRemove: (puuid: string) => void`, `loading: boolean`
  - Sort friends: in-game first, then alphabetically by `gameName`
  - Empty state: "Nie dodano jeszcze znajomych" (No friends added yet) with subtle icon
  - Loading state: skeleton cards while initial load
  - Render grid/flex layout of `<FriendCard />` components
  - Responsive: 1 column mobile, 2 columns tablet, 3 columns desktop
- [ ] Create `src/components/friend-card/friend-card.tsx`:
  - `"use client"` directive
  - Props: `friend: Friend`, `ddVersion: string`, `allFriends: Friend[]` (for party name resolution), `onRemove: (puuid: string) => void`
  - When in-game: show champion splash art as blurred, low-opacity background image (`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/{Name}_0.jpg`)
  - Profile icon from Data Dragon
  - Display: `gameName#tagLine`, summoner level
  - Rank display: tier icon + "GOLD II — 45 LP" (or "Brak rangi" if null)
  - Status indicator: green pulsing dot + "W grze" (In Game) or gray dot + "Poza grą" (Not in Game)
  - When in-game: show champion icon + champion name, game mode, `<GameTimer />`
  - Remove button: "Usuń" with confirmation or simple click, styled with `text-danger`
  - Render `<RecentMatches />`, `<TopChampions />`, `<PartyBadge />` sub-components
- **Files:** `src/components/friend-list/friend-list.tsx`, `src/components/friend-card/friend-card.tsx`

### Task 2.5 — GameTimer + Header
- [ ] Create `src/components/game-timer.tsx`:
  - `"use client"` directive
  - Props: `gameStartTime: number` (Unix epoch in ms)
  - `useEffect` with `setInterval` every 1 second
  - Calculate elapsed: `Math.floor((Date.now() - gameStartTime) / 1000)`
  - Format as `mm:ss`
  - Cleanup interval on unmount
  - Styled with monospace font, accent-teal color
- [ ] Create `src/components/header.tsx`:
  - App title: "LoL Tracker" with accent-gold color
  - Subtitle: "Sprawdź kto gra" (Check who's playing) in text-muted
  - Simple, clean layout — centered or left-aligned
- **Files:** `src/components/game-timer.tsx`, `src/components/header.tsx`

---

## Phase 3: Enhanced Features

### Task 3.1 — RecentMatches component
- [ ] Create `src/components/friend-card/recent-matches.tsx`:
  - `"use client"` directive
  - Props: `matches: RecentMatch[]`
  - Render 5 small indicators in a row:
    - Win: green circle/square
    - Loss: red circle/square
  - Tooltip or hover: show champion name + KDA (e.g., "Yasuo 8/3/5")
  - Label: "Ostatnie mecze" (Recent matches)
  - Handle empty array: show "Brak danych" (No data) in muted text
- **Files:** `src/components/friend-card/recent-matches.tsx`

### Task 3.2 — TopChampions mastery badges
- [ ] Create `src/components/friend-card/top-champions.tsx`:
  - `"use client"` directive
  - Props: `champions: ChampionMastery[]`, `ddVersion: string`
  - Render up to 3 small champion icons from Data Dragon
  - Below each: mastery level badge (number) and abbreviated points (e.g., "125k")
  - Label: "Najlepsi bohaterowie" (Top champions)
  - Handle empty array gracefully
- **Files:** `src/components/friend-card/top-champions.tsx`

### Task 3.3 — PartyBadge component
- [ ] Create `src/components/friend-card/party-badge.tsx`:
  - `"use client"` directive
  - Props: `playingWith: string[]`, `allFriends: Friend[]`
  - Only render if `playingWith.length > 0`
  - Resolve puuids to `gameName` by looking up in `allFriends`
  - Display: "Gra z: Player2, Player3" (Playing with: ...)
  - Styled: accent-teal background pill/badge
- **Files:** `src/components/friend-card/party-badge.tsx`

---

## Phase 4: Polish

### Task 4.1 — Error handling + loading states
- [ ] Global error boundary or error display for server action failures
- [ ] API key expired/invalid: show clear message "Nieprawidłowy klucz API" (Invalid API key)
- [ ] Network errors: show "Błąd połączenia" (Connection error) with retry option
- [ ] Loading skeletons for FriendCard while data is being fetched (pulsing placeholder cards)
- [ ] Loading spinner on AddFriendForm button while resolving

### Task 4.2 — Refresh button + UX improvements
- [ ] Add "Odśwież" (Refresh) button next to "Ostatnia aktualizacja" timestamp
- [ ] Clicking it triggers immediate `checkFriendsStatus` call
- [ ] Disable button + show spinner while refreshing
- [ ] Confirm dialog or undo toast when removing a friend

### Task 4.3 — Animations + responsive polish
- [ ] Card entrance animation: subtle fade-in / slide-up when cards appear
- [ ] Status change transition: smooth color transition when friend goes in-game/offline
- [ ] Green pulsing animation on in-game status dot (CSS keyframes via Tailwind)
- [ ] Responsive layout verification: test on mobile (375px), tablet (768px), desktop (1280px)
- [ ] Ensure Data Dragon images have proper `alt` text in Polish
- [ ] Add `next/image` for optimized image loading where applicable

### Task 4.4 — Vercel deployment prep
- [ ] Verify `next.config.ts` allows Data Dragon image domains in `images.remotePatterns`
- [ ] Test production build: `npm run build` passes without errors
- [ ] Set up Vercel project + add `RIOT_API_KEY` environment variable
- [ ] Deploy and verify all features work in production
- [ ] Test with real Riot IDs on EUNE
