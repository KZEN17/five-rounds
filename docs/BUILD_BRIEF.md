# Build brief: Five Rounds → Next.js multi-user competition-prep app

You are working in an existing repo that is deployed to Vercel as a static app (`public/index.html` + `api/*.js` functions + `middleware.js`, data in Upstash Redis). Rebuild it as a **Next.js (App Router) + TypeScript** app where any grappler can sign up, enter their current status and competition details, and get a generated, editable plan covering **conditioning, strength, BJJ load, weight and calories**. The current app is the owner's (Zlatko's) working prototype: keep every feature it has, and generalise it.

**Work in plan mode first.** Read this brief and the current app (`public/index.html`, `api/`, `middleware.js`) completely, then propose the architecture, file tree, schema and milestone order, and wait for approval before writing code. After that, build one milestone at a time. At the end of each milestone, `typecheck`, `lint`, `test` and `build` must all pass. **You run all git commands yourself** (§0.1). Never push to `main` until I say "ship it", and never print secret values.

## 0.1 Git workflow (you run these; show me each command's result briefly)

**Before M0:**
1. Run `git status`. If there are uncommitted changes other than `docs/BUILD_BRIEF.md` and `data/foods.tsv`, stop and ask me.
2. `git fetch origin`, then `git checkout main` and `git pull --ff-only`.
3. Create the work branch: `git checkout -b next-app`. If it already exists, switch to it with `git checkout next-app` and then `git pull --ff-only`.
4. Commit the brief: `git add docs/BUILD_BRIEF.md data/foods.tsv`, then `git commit -m "docs: add Next.js build brief and food database"`.
5. Push the branch: `git push -u origin next-app`.

**In M1:** move the legacy app with `git mv` so its history is kept: `git mv public legacy/public`, `git mv api legacy/api`, `git mv middleware.js legacy/middleware.js`, `git mv vercel.json legacy/vercel.json`. Make sure `.gitignore` contains `node_modules`, `.next`, `.vercel`, `.env*` (but not `.env.example`), `playwright-report`, `test-results`.

**After each milestone:**
1. Run the checks.
2. Stage only the files that belong to the milestone (`git add -A` is fine once `git status` shows nothing unexpected).
3. Commit with a Conventional Commit message, e.g. `feat(engine): phase splits and conditioning progressions`.
4. Run `git push`. This creates a Vercel **Preview** deployment of the branch. Tell me to check it in the Vercel dashboard.

**Rules:**
- Never `git push --force`, never rewrite pushed history, never commit secrets or `.env` files, and never commit directly to `main`.
- If a push or pull fails, show me the error and stop. Don't improvise around it.

**Shipping (only when I say "ship it"):**
1. `git checkout main` and `git pull --ff-only`.
2. `git merge --no-ff next-app -m "feat: Next.js multi-user app (v2)"`.
3. `git push origin main`. Vercel deploys Production.
4. `git tag v2.0.0` and `git push origin v2.0.0`.
5. Tell me the rollback options: promote the previous deployment in Vercel, or `git revert -m 1 <merge-sha>` and push.

---

## 0. Ground rules

- Same Git repo, same Vercel project, branch `next-app` (§0.1). In M1, move the current app into `legacy/` with `git mv` so it stays as a reference. The root `vercel.json` goes with it, because its `outputDirectory: "public"` would break the Next.js build.
- TypeScript `strict: true`. No `any` without a comment explaining why.
- Use the latest stable versions of every dependency, and check versions with `npm view` rather than guessing.
- The plan engine is **pure, deterministic TypeScript** with no database and no network, fully unit-tested. Do not use an LLM to generate plans.
- Every database query is scoped to the signed-in user. Write one helper for this, use it everywhere, and test that user A can never read or write user B's rows.
- Adults only: block signup under 18.
- The app gives training and nutrition guidance, not medical advice. Say so in onboarding and in the nutrition screens.

## 1. Stack

| Concern | Choice |
|---|---|
| Framework | Next.js App Router, React Server Components where natural, Server Actions for mutations |
| Language | TypeScript strict |
| Styling | Tailwind CSS. Keep the current visual identity: purple-belt accent (`#6b3fb0` light / `#a77ee8` dark), Barlow Condensed for display and numbers, Work Sans for body, light and dark themes, phone-first layout with a bottom tab bar |
| Database | Neon Postgres, added from the Vercel Marketplace into the **same** Vercel project |
| ORM | Drizzle ORM + drizzle-kit migrations |
| Auth | Auth.js (NextAuth v5) with the Drizzle adapter. Email magic links via Resend, plus Google sign-in. Sessions in the database. `SIGNUP_MODE=open|invite` env var (invite = only emails in an `invites` table can create accounts) |
| Rate limiting | `@upstash/ratelimit` on the existing Upstash Redis (sign-in, plan generation, write-heavy actions) |
| Validation | zod schemas shared by forms, server actions and the engine input |
| Forms | react-hook-form + zod resolver |
| Charts | Recharts |
| Tests | Vitest (engine + data scoping), Playwright smoke test (sign in → onboarding → plan visible → log a session) |
| PWA | `app/manifest.ts`, Serwist for offline support of the app shell. Reuse the icons in `legacy/public/icons` |

Environment variables (document them in `.env.example`): `DATABASE_URL` (from Neon), the Upstash `KV_REST_API_URL` / `KV_REST_API_TOKEN` (already set; accept any prefix as `legacy/api/login.js` does), `AUTH_SECRET`, `AUTH_RESEND_KEY`, `EMAIL_FROM`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `SIGNUP_MODE`, `OWNER_EMAIL`.

## 2. Features to keep from the legacy app

Port all of these (see `legacy/public/index.html` for the exact behaviour and copy):

1. **Week view:** 1–N week strip with completion counts, a week-complete toggle, and a day list where each day holds one or more sessions. A tappable circle marks the whole day done. Each day can be expanded to swap a session's type, set a time of day (morning/midday/evening), edit minutes/rounds, log it, remove it, add a session, or reset the day to the plan. Edited days are labelled.
2. **Session logging by type:**
   - *Mat sessions* (BJJ, open mat, comp sim): no heart rate. Log minutes, session RPE and hard rounds. Comp sim also gets a per-round RPE plus "gas in last minute" (Attacking / Holding on / Survival).
   - *Machine conditioning* (bike, rower, run, assault bike): minutes, avg/max HR, RPE. Interval sessions also get per-round end HR, HR after rest, and output (metres/calories).
   - *Strength / mobility:* minutes, RPE, and optionally the exercises done (see §4.4).
3. **Daily readiness:** sleep hours, resting HR, HRV, plus an optional soreness score (1–5) and a mood score (1–5). Compare against the user's own trailing 7-day average. Flag when sleep < 7 h, resting HR ≥ baseline + 5, or HRV ≤ 85% of baseline. A flag **suggests** (never forces) swapping that day's hard session for an easy one, as a one-tap action.
4. **Round timer:** work/rest/rounds from the selected session. 3-2-1 beeps, wake lock, skip/reset, and a progress pip per round.
5. **Fuel:** a daily target built from BMR + daily life + that day's sessions ± the goal adjustment, shown as a transparent breakdown. Macro bars. Warnings. A food log with quick add, "add again" chips, and a **meal builder** (ingredients × grams → totals, portions made / portions eaten, saved meals, custom ingredients per 100 g).
6. **Food database:** seed the global foods table from `data/foods.tsv` (the owner's list, columns: name, serving, kcal, protein, carbs, fat, category). Seven rows have calories that don't match their macros (Tavche Gravche, White Wine, Cow cheese Bella Farm, Urda Cheese, GoOn protein, Ajvar, Chadena Shunka). Seed them with an `needs_review` flag and show a small "check label" badge. Also seed raw/dry staples: rice dry 360/7/79/0.6, pasta dry 360/13/72/1.5, beef mince 5% raw 125/21.5/0/5, beef mince 15% raw 215/18.6/0/15, semi-skimmed milk 47/3.4/4.8/1.7, honey 304/0.3/82/0. Users can add private foods.
7. **Bodyweight:** daily weigh-in, a 7-day moving average line, and the actual weekly rate vs the target rate.
8. **Progress:** bike/Zone 2 avg HR trend, comp-sim final-round RPE trend, interval recovery (HR drop in rest), rowing pace fade table, weekly completion, a weight trend against the plan line, and a "copy progress" text summary.
9. **Watch guidance page:** keep the Apple Watch setup content, made generic (Apple Watch, Garmin, or none).
10. **Backup:** export all of the user's data as JSON and import it back (owner also uses this to migrate).

## 3. Onboarding (new users and "regenerate plan")

A short wizard. Every step is skippable where sensible, and has sensible defaults.

1. **You:** age (18+), sex, height (cm), current weight (kg), belt, years training, injuries/limitations (checkboxes: knee, lower back, neck, shoulder, ankle, other + free text).
2. **Competition:** name, date, gi or no-gi, weigh-in timing (*right before first match* / *day before* / *not sure*), target weigh-in weight for the division (kg), match length (min), expected matches in a day (default 4), rest between matches (default 20 min). No competition yet? Then ask for a target date for a "test" (in-house comp sim) and use that.
3. **Current fitness markers:**
   - "How many hard 5-minute rounds with 1-minute rest can you do before you're in survival mode?" (1–8)
   - Average resting HR, average sleep, and optional HRV.
   - An optional 2 km row time or 20-minute bike average HR at RPE 3–4.
4. **Training availability:** which weekdays have BJJ classes (multi-select) and their intensity (hard/technical), open mat day, how many extra conditioning sessions they can do per week (1–4), max minutes per extra session, preferred training time.
5. **Equipment:** stationary bike, rower, assault/air bike, treadmill, outdoor running, swimming pool, barbell gym, kettlebells, bands, nothing.
6. **Strength style:** ATG / knees-over-toes, barbell, kettlebell, bodyweight, or custom. Days per week available (0–3) and session length.
7. **Nutrition:** daily-life activity (desk ×1.2 / some walking ×1.375 / on feet ×1.5), protein preference (1.6–2.2 g/kg, default 2.0), whether to "protect hard days", and dietary notes (vegetarian etc., used only to filter meal-builder suggestions).

Store the raw answers as a versioned `plan_inputs` row, and generate from it. "Regenerate" creates a new plan version. It keeps every logged session (logs belong to dates, not to the old plan) and never deletes user-edited sessions in the past.

## 4. Plan engine (`src/lib/engine/`) — pure functions, fully tested

`generatePlan(input: PlanInput, today: Date): Plan` returns weeks → days → sessions, plus a `nutrition` block and a list of `warnings`. Each session has `{ type, title, minutes?, rounds?, workSec?, restSec?, intensity: 'easy'|'moderate'|'hard', modality, purpose, notes }`.

### 4.1 Timeline and phases
- `weeks = ceil(daysUntil(compDate) / 7)`. Under 3 weeks: build a short "sharpen + taper" plan and warn. Over 16 weeks: start with an extra general block, and treat the last 16 as the main build.
- Split the weeks: **General prep ~40%** (aerobic base, strength), **Specific prep ~35%** (threshold and match-specific intervals), **Peak ~15%** (comp simulations), **Taper = the final 7–10 days** (volume −40 to −60%, intensity kept, nothing new).
- Deload every 4th week in general and specific prep (−30% conditioning volume, no new max work).

### 4.2 Weekly structure rules
- BJJ classes are fixed anchors from onboarding. Count hard BJJ as hard days.
- At most **2 hard conditioning sessions per week**, comp sim included, and at most **1 in the taper**.
- Never schedule hard conditioning the day before the week's hardest BJJ session, or on 3 consecutive hard days.
- Easy aerobic work (Zone 2, RPE 3–4) goes on non-BJJ days, or after technical classes.
- Strength: 2×/week in general prep, 1–2× in specific prep, 1 short session in peak, and the last heavy strength session ≥ 7 days before the comp. Pair strength with BJJ days or easy days, never directly before comp sims.
- Keep one full rest or recovery-walk day per week.
- Respect the extra-sessions-per-week and minutes caps. When the caps can't fit the rules, drop in this order: extra aerobic minutes → second strength session → second hard conditioning session. Add a warning.

### 4.3 Conditioning progressions
- **Comp target:** `matchRounds = expected matches`, `workSec = match length`, `restSec` = 60 s in training (simulating the gaps between exchanges and the referee) for the round format.
- **Aerobic base:** start at max(20, min(cap, 30)) min, +5 min/week, capped by the session-minutes setting, −30% on deload weeks.
- **Specific intervals** (rower / bike / assault bike / run, whatever equipment exists): start rounds = clamp(baseline − 1, 2, target), +1 round every 1–2 weeks until `target = max(baselineRounds + 2, expected matches + 1)`, capped at 6. Work = match length. Rest 60 s.
- **Comp simulations on the mat** (peak, and alternating weeks in specific prep): rounds = progression above, different partners, RPE logged per round.
- **Injury filters:** knee or ankle → prefer bike/rower over running and assault bike; lower back → limit rower volume and suggest the bike; shoulder → limit rower and assault bike arms.
- The output must match the legacy app's shape when given Zlatko's inputs (8 weeks; bike Tue/Thu 30→45 min; Saturday alternating comp sim and rowing 3→5 rounds × 5:00/1:00; week 8 lighter). Write this as a snapshot test.

### 4.4 Strength templates
Each strength style has a template library by phase (exercise, sets × reps or time, notes). Users can swap exercises inside a session.
- **ATG / knees-over-toes:** e.g. tibialis raises, ATG split squat, Nordic hamstring curl progressions, Jefferson curl (light), sled/backwards walking, Copenhagen plank, Poliquin step-up, pull-ups/hangs.
- **Barbell:** squat/hinge/press/pull. General prep 3–5 × 3–6, specific prep 2–4 × 2–5 (more power), peak 2–3 × 2–3 at moderate load, taper: mobility and a light primer only.
- **Kettlebell, bodyweight:** equivalent patterns.
- **Custom:** the user defines their own exercises. The engine only schedules the slot.

### 4.5 Weight and calories
- `bmr` = Mifflin-St Jeor. `base = bmr × activityFactor`. Session burn = `(MET − 1) × kg × hours`, with MET: hard BJJ 10, open mat 8, comp sim 10.5, rower intervals 8.5, assault bike 9, run 9, Zone 2 bike 5.5, swim 7, strength 5, mobility/ATG 4, walk 3.5. Logged minutes replace planned minutes.
- `change = targetWeight − currentWeight`. The weekly rate is spread across all weeks **except the final week**.
- **Cut:** a safe rate ≤ 0.75% of bodyweight/week (warn above it, refuse to plan above 1%/week). Deficit kcal/day = rate × 7700 / 7. With "protect hard days", the deficit is halved on hard days and the rest moved to easy days, so the weekly total stays the same. Daily target never below BMR. Carbs ≥ 3 g/kg on hard days; if that's impossible, take the deficit from fat first (fat floor 0.6 g/kg).
- **Gain:** surplus 250–350 kcal/day, aiming for ≤ 0.25% bodyweight/week. Warn above 0.5%.
- **Maintain:** targets follow training load day to day.
- **Infeasible targets:** if the safe rate can't reach the target by the comp date, show the reachable weight by that date and suggest either the next division up or a later competition. Never plan dehydration or water cutting. For same-day weigh-ins, say plainly that you need to be on weight walking in. In the final week, show "keep food and fluid normal; for any planned weight manipulation beyond this, work with a qualified sports dietitian".
- Protein 1.6–2.2 g/kg (user choice), fat 0.8 g/kg (floor 0.6), carbs = remaining calories.

### 4.6 Readiness adaptation
`adjustDay(plannedDay, readiness, recentLoad)` returns suggested swaps (hard → easy aerobic, intervals → mobility). This is a pure function, the UI shows it as a banner with **Apply** and **Ignore**, and every applied swap is logged.

### 4.7 Tests (Vitest), at least:
- Phase splits for 3, 6, 8, 12 and 20 weeks.
- No week with more than 2 hard conditioning sessions; never hard the day before the hardest BJJ day; taper volume reduction.
- Injury filters.
- Nutrition: cut, gain, maintain and infeasible cases; the BMR floor; hard-day carb floor; the weekly deficit total stays the same with "protect hard days".
- The Zlatko snapshot (§4.3).
- `adjustDay` behaviour.

## 5. Data model (Drizzle, Postgres)

`users` and the Auth.js tables · `profiles` (user_id, age, sex, height_cm, belt, years, injuries jsonb, units) · `competitions` (name, date, gi, weigh_in_timing, target_weight, match_len_sec, matches, rest_min) · `plan_inputs` (versioned jsonb snapshot) · `plans` (input_id, version, generated_at, active) · `plan_sessions` (plan_id, user_id, date, order, type, title, params jsonb, time_of_day, source: generated|user|readiness_swap, deleted_at) · `session_logs` (user_id, session_id nullable, date, done, minutes, avg_hr, max_hr, rpe, hard_rounds, rounds jsonb, exercises jsonb, notes) · `readiness` (user_id, date, sleep, rhr, hrv, soreness, mood) · `weights` (user_id, date, kg) · `foods` (owner_id nullable = global, name, kcal, p, c, f per 100 g, category, needs_review) · `meals` (user_id, name, items jsonb, portions) · `food_logs` (user_id, date, name, kcal, p, c, f, ingredients jsonb) · `invites` (email). Index on (user_id, date) everywhere relevant.

## 6. Screens

Bottom tabs: **Today · Plan · Timer · Fuel · Progress**, with **Settings** behind the avatar.
- **Today:** readiness check-in, today's sessions with log actions, today's fuel summary, any readiness banner.
- **Plan:** the week strip + day list from §2.1, plus a phase indicator (General / Specific / Peak / Taper), a countdown to the comp, and a "Regenerate plan" entry.
- **Settings:** profile, competition, equipment, strength style, nutrition prefs, devices/Watch guide, export/import, delete account (hard delete, with confirmation).
- **Landing page** (signed out): short and honest about what the app does, with a sign-in button.

## 7. Migration of the owner's data

Write `scripts/import-legacy.ts`. It reads the Redis key `five-rounds:state` (the format is `S` in `legacy/public/index.html`: start, sat, logs keyed `w{week}d{day}[-{itemId}]`, custom, weeks, ready, bikeCap, fuel{…}) and writes it into the new tables for the user whose email is `OWNER_EMAIL`, mapping week/day keys to real dates from `start`. It must be idempotent and support a dry-run mode that prints counts. Also accept the JSON from the legacy Backup button as an input file.

## 8. Security and quality

- Server Actions validate input with zod and check ownership.
- Use the Next.js headers config for CSP (allow Google Fonts only), `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `X-Content-Type-Options: nosniff`.
- Rate-limit sign-in emails per email and per IP.
- Avoid N+1 queries on the week view: load a week in one query.
- Accessibility: labelled inputs, visible focus, tap targets ≥ 44 px, `prefers-reduced-motion`.
- Lighthouse PWA and accessibility checks pass on the preview URL.

## 9. Deployment on the existing Vercel project

You handle git (§0.1). The Vercel dashboard steps below are for me, the owner. Write them into `README.md`, and tell me at the right milestone (Neon before M1 needs a database, framework preset before the first Next.js push):
1. Your pushes of `next-app` create **Preview** deployments of the same project automatically.
2. In the Vercel project: **Settings → Build & Deployment → Framework Preset = Next.js**, and clear any Output Directory override. Settings apply to the next build.
3. **Storage → Neon** (Marketplace) → connect to this project for Preview and Production. Run `npx drizzle-kit migrate` against the preview database, then the production database.
4. Add the new env vars from §1. Keep the Upstash vars.
5. Test the preview URL end to end. Run `scripts/import-legacy.ts --dry-run`, then for real against production.
6. When I say "ship it", you run the shipping steps in §0.1 → Production deploys on the same domain.

## 10. Milestones

- **M0 (plan mode):** the git setup from §0.1 (after I approve leaving plan mode for it), then an architecture proposal, file tree, schema and risks. Wait for approval.
- **M1:** move legacy, scaffold Next.js + TS + Tailwind + Drizzle + Auth.js. Sign in works locally. `.env.example`.
- **M2:** plan engine + all tests from §4.7.
- **M3:** onboarding wizard → generate plan → Plan and Today screens with edit/log.
- **M4:** readiness check-in + `adjustDay` banner; round timer.
- **M5:** Fuel: targets from the engine, food DB seed, meal builder, food log, weights.
- **M6:** Progress charts and copy summary; export/import.
- **M7:** legacy import script, PWA/offline, rate limiting, security headers, Playwright smoke test, README deploy steps.

At the end of each milestone, summarise what was built, what's tested, and anything you were unsure about. Don't continue to the next milestone until I say so.
