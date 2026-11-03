# Five Rounds v2 — architecture

_The plan approved before M0 (2026-11-03). Where the code has since diverged, the code wins; update this file with it._

## Context

Five Rounds is now a single-user static app: `public/index.html` (one 1,977-line page; the file holds the whole document twice, and the two copies are identical), `api/{login,logout,state}.js`, and `middleware.js`. It stores one JSON blob (`five-rounds:state`) in Upstash Redis behind a passcode/TOTP. The brief (`docs/BUILD_BRIEF.md`) rebuilds it as a Next.js App Router + TypeScript app. In the new app, any adult grappler can sign up, enter their status and competition, and get a generated, editable plan for conditioning, strength, BJJ load, weight and calories. Every legacy feature stays, and Zlatko's data migrates over.

Repo: `five-rounds/` (git, `main` clean, remote `KZEN17/five-rounds`). Work happens on branch `next-app`. Nothing is pushed to `main` until you say "ship it".

## Decisions

| Topic | Decision | Whose call |
|---|---|---|
| Engine vs snapshot conflict | **Legacy shape wins.** "Short camp" mode for plans ≤ 8 weeks: comp sim and intervals alternate from week 1, no deload week, and the taper returns to week-1 volume. In all plans, interval rounds start at the baseline (not baseline−1). Zlatko's inputs reproduce legacy `BIKE`/`SIM`/`ROW` exactly. Plans over 8 weeks follow §4 as written. | Yours |
| Auth | **Better Auth 1.7.x** (not Auth.js v5 beta). Drizzle adapter, magic link plugin (sent via Resend), Google, sessions in the DB. The auth tables are `user`, `session`, `account`, `verification`. Env names stay as briefed (`AUTH_SECRET` is passed as `secret`). | Yours |
| Offline | App shell only, as briefed. Offline, you can view the last pages you opened and use the timer, with a clear "You're offline. This won't save" state. | Yours |
| TypeScript | **6.0.x, not 7.0.** `typescript-eslint` 8.72 requires TS `<6.1`, so TS 7 would break linting. | Mine (forced) |
| Next 16 gate file | `proxy.ts` (Next 16 renamed middleware to proxy). It does an optimistic cookie check. Each page and action validates the session for real. | Mine |
| Vercel framework | Root `vercel.json` on `next-app` = `{ "framework": "nextjs" }` (I checked the key against Vercel's schema). The branch then builds as Next.js without flipping the project-wide preset, so a redeploy of `main` keeps working until ship. The dashboard preset flip becomes optional, at ship time. | Mine |
| Test/local DB | PGlite (in-process Postgres) for Vitest, and as an optional local/E2E DB via `DATABASE_URL=pglite://.pglite`. Neon (`@neondatabase/serverless`, WebSocket pool, so transactions work) for preview and production. | Mine |
| Regenerate | Sessions dated before today are never touched. Sessions dated today or later that have a log are kept. All other future sessions are soft-deleted and replaced from the new plan. | Mine |
| Under-18 block | The sign-in page requires an "I'm 18 or older" confirmation. Onboarding step 1 enforces age ≥ 18. If the age is under 18, the account is hard-deleted and the user is signed out with an explanation. | Mine |
| Meal-builder draft | Kept per device in `localStorage` (legacy synced it). It isn't worth a table. | Mine |
| Fonts | `next/font/google` (Barlow Condensed + Work Sans) is self-hosted at build time, so there are no runtime Google requests. | Mine |

## Stack (pinned exact; I re-check with `npm view` at install time)

next 16.4.4 · react/react-dom 19.3.1 · typescript 6.0.3 · tailwindcss 4.3.4 (+ `@tailwindcss/postcss`) · zod 4.6.7 · drizzle-orm 0.45.4 / drizzle-kit 0.31.11 · @neondatabase/serverless 1.2.0 · @electric-sql/pglite 0.5.15 · better-auth 1.7.15 · resend 6.37.0 · @upstash/ratelimit 2.2.0 / @upstash/redis 1.41.0 · react-hook-form 7.91.0 + @hookform/resolvers 7.0.1 (supports zod 4) · recharts 3.10.1 · vitest 5.1.0 · @playwright/test 1.64.1 · serwist + @serwist/turbopack 9.5.13 (Next 16 builds with Turbopack) · eslint 10.14 + eslint-config-next 16.4.4 + typescript-eslint 8.72.1.

Scripts: `dev`, `build`, `start`, `typecheck` (`tsc --noEmit`), `lint`, `test` (vitest run), `test:e2e`, `db:generate`, `db:migrate`, `db:seed`, `import:legacy`.

## File tree (target)

```
five-rounds/
  legacy/{public,api,middleware.js,vercel.json}   # git mv in M1, reference only
  docs/BUILD_BRIEF.md  docs/ARCHITECTURE.md       # this plan, committed in M1
  data/foods.tsv
  drizzle/                                        # generated SQL migrations
  public/icons/                                   # copied from legacy/public/icons
  scripts/import-legacy.ts  scripts/seed-foods.ts
  tests/e2e/smoke.spec.ts
  next.config.ts  vercel.json  drizzle.config.ts
  vitest.config.ts  playwright.config.ts  eslint.config.mjs  tsconfig.json  .env.example  README.md
  src/
    proxy.ts                         # Next 16 "proxy" (was middleware); lives next to app/ because we use src/
    app/
      layout.tsx  globals.css (Tailwind v4 @theme: legacy tokens, light/dark)  manifest.ts  sw.ts
      page.tsx                       # landing (signed out) → /today when signed in
      signin/page.tsx  signin/check-email/page.tsx
      onboarding/page.tsx            # 7-step client wizard, one zod schema per step
      (app)/layout.tsx               # requires session + finished onboarding; bottom tabs; avatar → settings
      (app)/today/page.tsx  plan/page.tsx  timer/page.tsx  fuel/page.tsx  progress/page.tsx
      (app)/settings/{page,profile,competition,training,nutrition,devices,data,account}/…
      api/auth/[...all]/route.ts     # Better Auth handler
      api/export/route.ts            # JSON download
      offline/page.tsx
    lib/
      engine/      # PURE: no db, no network, no Date.now()
        types.ts input.ts(zod PlanInput) dates.ts phases.ts conditioning.ts strength.ts
        strength-templates.ts schedule.ts nutrition.ts readiness.ts generate.ts index.ts
        __tests__/…  __fixtures__/zlatko.ts
      db/
        schema.ts  client.ts (neon | pglite by URL)  scoped.ts (THE user-scoping helper)
        queries/{week,logs,fuel,progress,export}.ts
      auth.ts  auth-client.ts  session.ts (requireUser → { user, db: scoped })
      actions.ts   # userAction(schema, handler, {limit}) wrapper: auth + zod + rate limit
      ratelimit.ts  upstash-env.ts (port of legacy findEnv: any KV_/UPSTASH_ prefix)
      legacy/{types.ts,map.ts}   # legacy S → v2 rows; used by import UI and the script
      foods/tsv.ts  validation/*.ts
    actions/{onboarding,plan,logs,readiness,fuel,settings,data}.ts
    components/{ui,week,log-forms,timer,fuel,charts}/…
```

## Data model (Drizzle, Postgres)

Every user-owned table has a `user_id` FK to `user.id` with `ON DELETE CASCADE`, so deleting an account removes all of its data. Each also has an index on `(user_id, date)` where it has a date. Ids are `uuid defaultRandom`.

- **Better Auth:** `user` (+ `onboarded_at`), `session`, `account`, `verification`.
- **profiles** (PK user_id): age, sex, height_cm, belt, years_training, injuries jsonb, units, timezone (IANA, from the browser), z2_ceiling_bpm (legacy `bikeCap`), device (`apple|garmin|none`).
- **competitions**: name, date, gi, weigh_in_timing, target_weight_kg, match_len_sec, matches, rest_min, is_test.
- **plan_inputs**: version (unique per user), data jsonb (validated `PlanInput`), created_at.
- **plans**: input_id, version, generated_at, start_date, comp_date, active (partial unique index: one active per user), **output jsonb** (engine output; this is the source for "reset day").
- **plan_sessions**: plan_id, date, order, type, title, params jsonb (minutes, rounds, workSec, restSec, intensity, modality, purpose, notes, exercises), time_of_day, source (`generated|user|readiness_swap`), deleted_at, external_id.
- **session_logs**: session_id (nullable, one log per session), date, done, minutes, avg_hr, max_hr, rpe, hard_rounds, rounds jsonb (`{rpe,gas}` / `{endHr,recHr,output,unit}`), exercises jsonb, notes, external_id.
- **readiness** (PK user_id+date): sleep_h, rhr, hrv, soreness 1–5, mood 1–5.
- **readiness_adjustments** (new): date, session_id, action (`applied|ignored`), reasons text[], before/after jsonb. This is the log of applied swaps, and an ignored banner stays dismissed.
- **week_marks** (new; PK user_id+week_start): done. This is the legacy week-complete toggle, keyed by date so it survives a regenerate.
- **weights** (PK user_id+date): kg.
- **foods**: owner_id (null = global), name, kcal/p/c/f per 100 g, category, needs_review, source. Unique on lower(name) per owner (partial index for global rows).
- **meals**: name, items jsonb, portions. **food_logs**: date, name, kcal/p/c/f, ingredients jsonb, external_id.
- **invites**: email PK, created_at, used_at.

**Isolation, in three layers.** (1) `scoped(db, userId)` in `src/lib/db/scoped.ts` is the only way app code touches user tables. Every select, update and delete gets `user_id = $me`, every insert has `user_id` forced, and foods reads are `owner_id IS NULL OR owner_id = $me`. (2) ESLint `no-restricted-imports` blocks importing the raw client outside `src/lib/db/**`, `src/lib/auth.ts` and `scripts/`. (3) Composite FKs `(session_id,user_id) → plan_sessions(id,user_id)`, `(plan_id,user_id) → plans`, `(input_id,user_id) → plan_inputs` mean the database itself rejects cross-user references. A Vitest suite on PGlite (migrations applied) checks, for every table, that B can't read, update or delete A's rows, or attach rows to A's ids.

The week view loads in one query: `plan_sessions LEFT JOIN session_logs` for `user_id` and the week's date range, `deleted_at IS NULL`. It doesn't filter by plan, because past sessions stay on old plans after a regenerate.

## Plan engine (`src/lib/engine`)

Inputs and outputs are plain data. Dates are ISO `yyyy-mm-dd` strings inside the engine. `generatePlan(input, today: Date)` reads `today` as a calendar date (UTC fields), so tests don't depend on the machine's time zone. `plan.start` = the Monday of today's week, and `weeks = ceil(daysUntil(comp)/7)`.

**Phases.** R = W−1 non-taper weeks. If W > 16, the first W−16 weeks are an extra general block and R = 15. Peak = max(1, round(R·15/90)), SP = max(1, round(R·35/90)), GP = R−Peak−SP. If W < 3, the plan is sharpen + taper and carries a warning. The taper is the final week, extended to 10 days when W ≥ 10. Deloads (−30% conditioning, no max work) fall on plan weeks 4, 8, 12… inside GP/SP, but only when W > 8.

| W | Extra | GP | SP | Peak | Taper | Mode |
|---|---|---|---|---|---|---|
| 3 | – | 0 | 1 | 1 | 1 | short camp |
| 6 | – | 2 | 2 | 1 | 1 | short camp |
| 8 | – | 3 | 3 | 1 | 1 | short camp (Zlatko) |
| 12 | – | 5 | 4 | 2 | 1 (10 d) | deloads wk 4, 8 |
| 20 | 4 | 6 | 6 | 3 | 1 (10 d) | deloads wk 4, 8, 12, 16 (those in GP/SP) |

**Weekly placement** (deterministic greedy, `schedule.ts`):
1. Anchor the BJJ classes and the open mat.
2. Hard conditioning goes on legal days only: not the day before the hardest BJJ session (if several are equally hard, all count), never making 3 hard days in a row, at most 2 per week, at most 1 in the taper. Comp sims prefer the open-mat day because they need partners.
3. Easy aerobic work goes on non-BJJ days, or after technical classes.
4. Strength goes with BJJ days or easy days, never the day before a comp sim, and the last heavy session is ≥ 7 days before the comp.
5. One rest or recovery-walk day per week, plus mobility.
6. If the caps don't fit, drop extra aerobic minutes first, then the 2nd strength session, then the 2nd hard session, and add a warning for each drop.

**Progressions.**
- Aerobic: per session, start = max(20, min(cap, 30)). The weekly total rises 5 min/week, with the extra going to the earlier session first. Each session is capped at the minutes cap. Deload weeks are −30%.
- Intervals: start = clamp(baseline, 2, target), target = min(6, max(baseline+2, matches+1)). Rounds climb as `start + floor((k+1)(Δ+1)/(B+1))` over the build weeks (in long plans, GP holds at the start value). Work = match length, rest = 60 s.
- Injury filters: knee or ankle → bike/rower instead of run and assault bike. Lower back → less rower, more bike. Shoulder → less rower and assault-bike arm work.
- Zlatko fixture: start on a Monday, comp the Monday after week 8. BJJ Mon/Wed/Fri hard, open mat Sat, 3 extras of up to 45 min, bike + rower, ATG 2×/wk, baseline 3, 4 matches × 5:00. The result is Tue/Thu ATG + bike 30/30 → 45/45, Sat sim/row 3,3,4,4,4,5,5 then 3 in week 8, Sun mobility + walk. The test asserts these values and also keeps a Vitest snapshot of the full output.

**Strength templates**: ATG, barbell, kettlebell and bodyweight, each by phase (exercise, sets × reps/time, notes). With the custom style, the engine only schedules the slot. Exercises can be swapped per session.

**Nutrition.** Per-day targets can't be stored, because logged minutes change them. So:
- `generatePlan` returns `nutrition`: goal (cut/gain/maintain), weekly rate, daily adjustment, protein g/kg, warnings, reachable weight and a suggestion (next division up or a later comp). The final week is maintenance, with the dietitian line.
- The pure function `dayTarget(...)` returns the full breakdown: BMR (Mifflin), × activity, + session burn `(MET−1)·kg·h` (logged minutes win), ± adjustment. It applies the BMR floor and the 3 g/kg hard-day carb floor (taking fat from 0.8 down to 0.6 g/kg first).
- The pure function `weekAdjustments(days, dailyDeficit, protect)` halves the deficit on hard days and moves the rest to easy days, so the weekly total stays the same.
- Rate limits: a cut warns above 0.75%/wk and refuses to plan above 1% (it plans the safe rate and shows the reachable weight). A gain uses a 250–350 kcal surplus, aims for ≤ 0.25%/wk, and warns above 0.5%. The engine never plans water cuts. A same-day weigh-in gets a plain warning.

**Readiness.** `readinessFlags(day, history)`: the baseline is the previous 7 calendar days, with at least 3 entries. It flags sleep < 7 h, RHR ≥ baseline + 5 and HRV ≤ 85% of baseline. `adjustDay(plannedDay, readiness, recentLoad)` returns suggested swaps (hard → easy aerobic, intervals → mobility, hard BJJ → "drill/technical only"). The UI shows these as Apply / Ignore, and both choices are logged.

**Tests (M2):**
- Phase splits for 3/6/8/12/20 weeks.
- Never more than 2 hard sessions in a week; never hard the day before the hardest BJJ day; never 3 hard days in a row; the taper cut.
- Injury filters.
- Cut, gain, maintain and infeasible goals; the BMR floor; the carb floor; the weekly total unchanged with "protect hard days".
- The Zlatko snapshot.
- `adjustDay`.

## Milestones

After each milestone: `typecheck`, `lint`, `test` and `build` must pass. Then I stage, make a Conventional Commit, push `next-app`, and you check the Preview build. I stop and wait for your go before each next milestone.

- **M0 (on approval):**
  1. Write `docs/BUILD_BRIEF.md` and `data/foods.tsv` verbatim from your pastes, then check that every TSV row has 7 tab-separated fields.
  2. Run §0.1: `git status` → fetch → checkout main → `pull --ff-only` → `checkout -b next-app` → commit exactly those 2 files with the given message → `push -u origin next-app`. I show each result and stop on any error.
  3. Save a project memory.
  4. **Your steps before M1:** add **Neon** from the Vercel Marketplace to this project (Development, Preview and Production). No framework-preset change is needed (see `vercel.json`).
- **M1:**
  - `git mv` legacy into `legacy/`, and fix `.gitignore` (`.next`, `playwright-report`, `test-results`, `.pglite`, `!.env.example`).
  - Scaffold Next 16 + TS 6 + Tailwind 4 (legacy tokens and fonts, light/dark) + Drizzle + Better Auth + `proxy.ts` + `.env.example` + `docs/ARCHITECTURE.md`.
  - Sign-in works locally: in development, magic links print to the terminal when there's no Resend key.
  - **Your steps:** set `AUTH_SECRET` for Preview. Set the Resend key + `EMAIL_FROM` (needs a verified domain) and the Google OAuth client. Google can't take wildcard redirect URIs, so register the stable branch alias `…-git-next-app-….vercel.app`.
- **M2:** the engine + every §4.7 test (pure; no UI).
- **M3:**
  - Onboarding wizard (7 steps, sensible defaults, steps skippable where it makes sense, 18+ check, a not-medical-advice note) → `plan_inputs` → generate → materialise `plan_sessions`.
  - Plan screen: week strip, day list, edit/swap/time-of-day/add/remove/reset, day-done circle, week toggle, phase indicator, countdown, regenerate.
  - Today screen.
  - Per-type log forms.
  - **Your step:** run `db:migrate` on the preview DB (or I run it from `vercel env pull`).
- **M4:** readiness check-in + baseline flags + `adjustDay` banner (Apply/Ignore, logged); round timer (3-2-1 beeps, wake lock, skip/reset, pips, phases from the selected session).
- **M5:** foods seed (TSV, with `needs_review` set on the 7 named rows, plus the 6 raw/dry staples), private foods, meal builder, saved meals, quick add, "add again", Fuel targets with the breakdown, macro bars, warnings, weights with a 7-day moving average and actual vs target rate.
- **M6:** Progress (Recharts): Zone 2 HR trend, comp-sim final-round RPE, interval recovery, rowing fade table, weekly completion, weight vs plan line, "copy progress". JSON export/import (v2 format plus legacy backup via `lib/legacy/map.ts`).
- **M7:** `scripts/import-legacy.ts` (Redis key or backup file, `--dry-run` counts, idempotent via `external_id` upserts), Serwist app shell + offline page, Upstash rate limits (sign-in per email and per IP, generate, writes), security headers, Playwright smoke test, README deploy steps.

## Risks and notes

- **Offline logging regresses** compared with legacy (accepted). The timer stays fully offline.
- **CSP:** `next.config` headers can't use nonces, so `script-src` needs `'unsafe-inline'` for Next's hydration scripts. The real external origins are Google sign-in (navigation) and Google avatars; I'll show initials instead of avatars so `img-src` stays `'self'`. I'll settle the details in M7.
- **Resend without a verified domain** only sends to your own address. That's fine for testing as owner, but not for other users.
- **Short-camp exceptions** are a deliberate departure from §4. They're documented in code and tests so they don't read as bugs.
- **Food data:** Rakija (alcohol kcal, zero macros) also fails a macro check, but it isn't in your list of 7. I'll seed it unflagged and mention it in the M5 summary.
- **Production:** run `db:migrate` against the production DB **before** "ship it". The legacy Redis data stays untouched (the import only reads it).

## Verification

- Every milestone: `npm run typecheck && npm run lint && npm run test && npm run build`, all passing, with the output shown.
- Engine: Vitest unit and snapshot tests (M2). Scoping: Vitest on PGlite with real migrations.
- E2E (M7): Playwright against `next start` with a PGlite DB and a dev mail sink. Flow: sign in → onboarding → plan visible → log a session.
- Each push: you check the Vercel Preview. M7: legacy import `--dry-run` on preview, then for real on production. Lighthouse PWA and accessibility checks on the preview URL.
