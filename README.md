# Five Rounds

The 8-week BJJ conditioning app: week plan with editable days, round timer, fuel tracker with a meal builder, and progress charts. One static page plus one API route, no build step.

```
public/index.html          the whole app
public/sw.js               offline support
public/manifest.webmanifest + icons/   Add to Home Screen
api/state.js               GET/PUT your data, stored in Upstash Redis, protected by a passcode
vercel.json                serves /public, cache headers
```

## Deploy (about 5 minutes)

1. **Push to GitHub.** Create a new repo and push this folder.
2. **Import in Vercel.** Go to vercel.com → Add New → Project, pick the repo, and keep Framework Preset = *Other*. Don't set a build command. Deploy.
3. **Add storage.** In the project, go to **Storage → Create Database → Upstash for Redis** (the free tier is plenty) and connect it to the project. It adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you.
4. **Set your passcode.** Go to **Settings → Environment Variables** and add `APP_KEY` with a long random value. One way to make one is `openssl rand -base64 24`.
5. **Redeploy** (Deployments → ⋯ → Redeploy) so the function picks up the new variables.

Open the site, enter the passcode once, and you're synced. On the iPhone, open it in Safari → Share → **Add to Home Screen**. It opens full-screen with its own icon and works offline. Changes sync when you're back online.

**CLI instead of GitHub:** `npm i -g vercel`, then `vercel` in this folder, then steps 3–5, then `vercel --prod`.

## Moving your data from the Claude version

In the Claude version: Watch tab → **Backup → Copy backup**. In the Vercel app: Watch tab → paste into the backup box → **Restore from pasted backup** (tap twice).

## How sync works

- Every change is saved on the device straight away, then sent to `/api/state` after a short pause.
- When the app opens or comes back to the foreground, it pulls the server copy. The newer copy wins, using a timestamp saved with your data.
- The server keeps the previous version under `five-rounds:state:previous` as a one-step undo. You can read it in the Upstash console.
- Without storage or `APP_KEY` set, the app still works and saves on the device only.

## Local development

```
npm i -g vercel
vercel link
vercel env pull .env.local
vercel dev
```
# five-rounds
