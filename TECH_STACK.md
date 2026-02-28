# Tech Stack

## Framework

| Technology | Purpose | Version |
|-----------|---------|---------|
| **Next.js** | Full-stack React framework (frontend + server actions) | 16.x |
| **React** | UI library | 19.x |
| **TypeScript** | Type-safe JavaScript | 5.x |
| **Tailwind CSS** | Utility-first CSS framework (v4: CSS-based config via `@theme`, no config file) | 4.x |
| **@tailwindcss/postcss** | PostCSS plugin for Tailwind v4 | 4.x |

## Backend (Next.js Server Actions)

| Technology | Purpose | Version |
|-----------|---------|---------|
| **Next.js Server Actions** | Server-side functions called directly from client components | built-in |
| **Zod** | Schema validation for API responses and form input | 3.x |
| **Native fetch** | HTTP client for Riot API calls (extended by Next.js with caching support) | built-in |

## External APIs

| Service | Purpose | Docs |
|---------|---------|------|
| **Riot Games API** | Summoner data, live game status, ranked info | [developer.riotgames.com](https://developer.riotgames.com) |
| **Data Dragon CDN** | Champion icons, profile icons, spell images | [ddragon.leagueoflegends.com](https://ddragon.leagueoflegends.com) |

### Riot API Endpoints Used

| Endpoint | Version | Route Type |
|----------|---------|------------|
| Account V1 (`/riot/account/v1`) | V1 | Regional (`europe`) |
| Summoner V4 (`/lol/summoner/v4`) | V4 | Platform (`eun1`) |
| Spectator V4 (`/lol/spectator/v4`) | V4 | Platform (`eun1`) |
| League V4 (`/lol/league/v4`) | V4 | Platform (`eun1`) |
| Match V5 (`/lol/match/v5`) | V5 | Regional (`europe`) |
| Champion Mastery V4 (`/lol/champion-mastery/v4`) | V4 | Platform (`eun1`) |

## Storage

| Technology | Purpose |
|-----------|---------|
| **localStorage** (browser) | Persisted friend list per user — survives page reloads, deployment-friendly |

## Deployment

| Platform | Why |
|----------|-----|
| **Vercel** | Native Next.js hosting, zero-config deployment, serverless functions |

## Development Tools

| Tool | Purpose |
|------|---------|
| **npm** | Package manager |
| **ESLint** | Linting (included with Next.js) |

## Region Configuration

| Setting | Value |
|---------|-------|
| Platform route | `eun1.api.riotgames.com` |
| Regional route | `europe.api.riotgames.com` |
| Target region | EUNE (Europe Nordic & East) |
