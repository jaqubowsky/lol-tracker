# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build (use to verify no errors)
npm run lint     # ESLint
```

No test framework is configured.

## Environment

Requires `RIOT_API_KEY` in `.env.local` (dev keys expire every 24h, get at developer.riotgames.com). Optional `NEXT_PUBLIC_URL` for metadata base.

## Architecture

Next.js 16 + React 19 + Tailwind v4 + Zod v4. All UI text is in Polish; code identifiers are in English.

### Data Flow

The main page (`src/app/page.tsx`) is a client component that manages all friend state. Friends are persisted in **localStorage** (not a database). The app polls Riot API via server actions on a 60s interval.

Two refresh modes exist:
- **Full refresh** (on mount + manual): fetches summoner, rank, matches, champions, game status
- **Poll refresh** (every 60s): fetches rank + game status only

Both batch requests using `API_BATCH_SIZE` / `API_BATCH_SIZE_SMALL` from `src/lib/config.ts`.

### Caching Strategy

All Riot API calls go through `riotFetch()` in `src/lib/riot-api.ts`, which uses **Next.js Data Cache** (`fetch` with `next: { revalidate, tags }`). There is no custom cache layer. Revalidation times: profile 30min, rank/mastery/match-list 5min, immutable data 1hr. The spectator endpoint is the only uncached call (`cache: "no-store"`).

DDragon static data (champions, spells, runes, items) is loaded via module-scope Maps in `src/lib/game-checker.ts` with in-flight deduplication. DDragon versions revalidate every 4h, data every 24h.

### Server Actions Pattern

Server actions are colocated with their components in `action.ts` files (e.g., `src/components/add-friend-form/action.ts`). They call into `src/lib/riot-api.ts` and `src/lib/game-checker.ts`. Client components call these actions directly.

### Routing

- `/` — Main dashboard (client component, friend list with infinite scroll)
- `/player/[puuid]?region=eun1` — Player detail page. Server component wraps a client `PlayerDetailPage` in Suspense. Region is passed via query param.

### Regions

Supports EUNE (`eun1`) and EUW (`euw1`). Both use `europe` regional routing. Region is stored per friend. `getPlatformUrl(region)` in `src/lib/config.ts` returns the platform-specific API base URL.

### Styling

Tailwind v4 with CSS-based config — all theme tokens defined via `@theme` in `src/app/globals.css` (no `tailwind.config.ts`). Custom LoL-themed CSS classes (`lol-button`, `lol-input`, `hex-clip`, `card-border-wrap`, `gold-shimmer`, etc.) are defined in the same file. Display font is Cinzel, body font is Fira Sans (loaded via `next/font/google` in layout).

### Rate Limiting

429 responses trigger a single retry using the `Retry-After` header. A pub/sub system (`src/utils/rate-limit-event.ts`) fires events that show a `RateLimitModal` with a 30s countdown.

## Key Conventions

- **Zod v4**: Use `.issues` not `.errors` on ZodError
- **Images**: All DDragon images use `<Image unoptimized>` from `next/image`
- **Spectator**: Uses V5 endpoint with PUUID (not V4/summonerId)
- **Path alias**: `@/*` maps to `./src/*`
- **Storage migration**: Friends without a `region` field default to `"eun1"` on load
