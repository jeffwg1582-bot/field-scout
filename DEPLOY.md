# Field Scout Network — deploy guide

This is the **shareable** version: scouts (wife, kids, rep) just snap + note — no keys, no setup. Everything lands in **your** inbox to approve. Your AI key lives only on **your** phone; the server never sees it.

Because it has a backend (functions + a dependency), it can't be drag-dropped like the single file. It deploys from **GitHub** (one-time, ~20 min, guided). Your current single-file app (`jeffg-fieldscout.netlify.app`) stays live as your trip fallback the whole time.

## What's in `network-app/`
- `index.html` — the app (Scout mode + Owner mode)
- `netlify/functions/` — `process` (scout upload), `pending` (owner inbox), `approve`/`discard` (clear)
- `package.json`, `netlify.toml` — build config

## One-time deploy
1. **GitHub:** create a free account at github.com → **New repository** (name it `field-scout`, Public or Private).
2. **Upload:** in the repo, **Add file → Upload files** → drag in everything inside `network-app/` (keep the `netlify/functions/` folder structure). Commit.
3. **Netlify:** app.netlify.com → **Add new site → Import an existing project → GitHub** → authorize → pick `field-scout`. Leave build settings default → **Deploy**. Netlify installs the dependency and publishes the functions automatically.
4. **Set the passcode:** Netlify site → **Site configuration → Environment variables → Add** → key `OWNER_PASSCODE`, value = a password you choose (protects your inbox). Redeploy once.
5. You get a URL like `field-scout.netlify.app`. Rename it (Site settings → Change site name) to something clean.

## First run
- **You (owner):** open the URL → "I'm the owner" → Setup → enter your **passcode** (same as the Netlify env var), your **Anthropic key**, and sender info → Save.
- **A scout (wife/kid/rep):** open the same URL → "I'm scouting" → type their name once → snap + note + Send. That's their whole world.

## Daily flow
Scouts snap+note all day → you open **Snap → Pull team inbox** → it reads + researches + drafts on your device → **Review** → edit/approve → it sends via OT, credited to the scout (the `scout`/`source` field) for commission.

## To use the scout's source for commission in OT
The lead already carries `scout` / `source`. To tag/attribute it in OT, add one step to your "Field Scout Intake" workflow later (e.g., Add Tag `src-{{inboundWebhookRequest.scout}}` or map it to a field). Small add — current workflow still works without it.
