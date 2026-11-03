# Five Rounds

Competition prep for grapplers. You sign up, enter your current fitness and your competition, and get a generated, editable plan for conditioning, strength, BJJ load, weight and calories. Then you log sessions, readiness, food and weigh-ins, and watch the trends.

Next.js 16 (App Router, TypeScript) on Vercel · Neon Postgres via Drizzle · Better Auth (email magic links via Resend, plus Google) · Upstash Redis for rate limits · Serwist for the offline app shell. The original single-user app is kept in [`legacy/`](legacy/) for reference.

- What we're building: [docs/BUILD_BRIEF.md](docs/BUILD_BRIEF.md)
- How it's built: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Local development

```bash
npm install
cp .env.example .env.local      # the defaults work as-is
npm run db:migrate              # local Postgres in ./.pglite (PGlite, no server), shared foods included
npm run dev                     # http://localhost:3000
```

Sign in with any email and tick 18+. Without `AUTH_RESEND_KEY`, the sign-in link is printed in the terminal running `npm run dev`. To use a Neon database instead, put its `DATABASE_URL` in `.env.local` (or `vercel env pull .env.local`). Every `drizzle-kit` command prints which database it's about to touch.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` | `tsc --noEmit` / ESLint (also blocks raw DB access outside `src/lib/db`) |
| `npm test` | Vitest: plan engine, nutrition, readiness, per-user data isolation, imports (in-memory Postgres) |
| `npm run test:e2e` | Playwright smoke test: sign in → onboarding → plan → log → readiness → timer → fuel → import → progress. `PW_CHROMIUM=/usr/bin/chromium` uses a local Chromium. |
| `npm run db:generate` | New SQL migration from `src/lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations (and the shared food list) to `DATABASE_URL` |
| `npm run db:seed:foods` | Rebuild the food-seed migration after editing `data/foods.tsv` |
| `npm run import:legacy` | Bring the owner's data over from the old app (see below) |

## Environment variables

| Name | Where | Notes |
|---|---|---|
| `DATABASE_URL` | all | Added by the Neon integration. Locally `pglite://.pglite` works. |
| `AUTH_SECRET` | all | Long random string: `openssl rand -base64 32`. Required in production. |
| `AUTH_RESEND_KEY`, `EMAIL_FROM` | Preview, Production | Resend API key and a sender on a domain verified in Resend, e.g. `Five Rounds <signin@yourdomain.com>`. |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | optional | Google OAuth client. Redirect URI: `<app URL>/api/auth/callback/google`. |
| `SIGNUP_MODE` | all | `open` or `invite` (only emails in the `invites` table, plus `OWNER_EMAIL`, can create accounts). |
| `OWNER_EMAIL` | all | The owner's email: always allowed to sign up; target of the legacy import. |
| `AUTH_URL` | optional | Overrides the app URL. Defaults to the Vercel branch URL on previews and the production URL in production. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | already set | Upstash Redis, used for rate limits. Any Vercel prefix works. Without them rate limiting is off. |

## Deploying on the existing Vercel project

Pushes to `next-app` create **Preview** deployments. `vercel.json` declares `"framework": "nextjs"`, so the project's Framework Preset doesn't need changing.

1. **Database.** Vercel → the project → **Storage → Neon** (Marketplace) → connect it to this project for Development, Preview and Production.
2. **Environment variables.** Settings → Environment Variables: add the ones above for Preview and Production. Keep the existing Upstash variables. Suggested until launch: `SIGNUP_MODE=invite` with your `OWNER_EMAIL`.
3. **Migrate.** For each database (Preview first, then Production):
   ```bash
   vercel env pull .env.local --environment=preview   # or production
   npm run db:migrate
   ```
4. **Redeploy** the preview so it picks up the new variables (Deployments → ⋯ → Redeploy), then test it end to end on the stable branch URL (`…-git-next-app-….vercel.app`). Sign-in links and Google redirects point there.
5. **Google sign-in (optional).** In Google Cloud Console add the redirect URIs for the branch URL and the production domain. Google doesn't accept wildcards.
6. **Import your old data** (needs your account to exist, so sign in once first):
   ```bash
   vercel env pull .env.local --environment=production
   npm run import:legacy -- --dry-run     # prints counts, writes nothing
   npm run import:legacy                  # for real; safe to run again
   ```
   Or paste the old app's **Backup → Copy backup** into Settings → Your data → Import.
7. **Ship:** merge `next-app` into `main` (`git merge --no-ff`), push, tag `v2.0.0`. Production deploys on the same domain.

**Rollback:** in Vercel, promote the previous production deployment (instant), or `git revert -m 1 <merge-sha>` and push. The old app's Redis data is never modified by the new app or the import.

## Known limits

- **Offline is the app shell only.** Pages you've opened work offline, and so does the timer, but logging needs a connection. The app says so when you're offline.
- **CSP allows inline scripts**, which Next needs for hydration without per-request nonces.
- The ESLint plugins bundled with `eslint-config-next` declare ESLint ≤ 9 as a peer; they run fine on ESLint 10. Expect npm peer warnings on install.
