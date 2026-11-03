# Five Rounds

Competition prep for grapplers. You sign up, enter your current fitness and your competition, and get a generated, editable plan for conditioning, strength, BJJ load, weight and calories.

Version 2 is a Next.js app (App Router, TypeScript) on Vercel, with Neon Postgres via Drizzle and Better Auth (email magic links via Resend, plus Google). The original single-user static app is kept in [`legacy/`](legacy/) for reference.

- What we're building: [docs/BUILD_BRIEF.md](docs/BUILD_BRIEF.md)
- How it's built: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Local development

```bash
npm install
cp .env.example .env.local          # the defaults work as-is for local dev
npm run db:migrate                  # creates a local Postgres in ./.pglite (PGlite, no server needed)
npm run dev                         # http://localhost:3000
```

To sign in locally, enter any email and tick 18+. Without `AUTH_RESEND_KEY`, the sign-in link is printed in the terminal running `npm run dev`. Open it in the browser.

To work against a Neon database instead, put its `DATABASE_URL` in `.env.local` (or run `vercel env pull .env.local`). Every `drizzle-kit` command prints which database it's about to use.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (blocks the raw DB client outside `src/lib/db`) |
| `npm test` | Vitest: auth flow, signup rules and per-user data isolation, on an in-memory Postgres |
| `npm run db:generate` | New SQL migration from `src/lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |

## Vercel setup so far

1. `vercel.json` declares `"framework": "nextjs"`, so this branch builds as Next.js without changing the project's Framework Preset.
2. **Storage → Neon** (Marketplace): connect it to this project for Development, Preview and Production. This adds `DATABASE_URL`.
3. Environment variables (see `.env.example`): `AUTH_SECRET` (required), `AUTH_RESEND_KEY` + `EMAIL_FROM` (email sign-in on deployed builds), and optionally `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`, `SIGNUP_MODE`, `OWNER_EMAIL`. Keep the existing Upstash variables.
4. Run `npm run db:migrate` against each database before using that deployment.

The full deploy and migration runbook arrives with the last milestone.
