
# World Cup Predictions 2026 - Haikus for Codespaces

This is a quick node project template for demoing Codespaces. It is based on the [Azure node sample](https://github.com/Azure-Samples/nodejs-docs-hello-world). It's great!!!

Point your browser to [Quickstart for GitHub Codespaces](https://docs.github.com/en/codespaces/getting-started/quickstart) for a tour of using Codespaces with this repo.

## ⚽ World Cup 2026 predictions (`/worldcup`)

An Elo-based predictor for the 2026 FIFA World Cup, served at `/worldcup`.

- **Predictions** — every group-stage match, predicted group tables, the eight
  best third-placed qualifiers, and a fully simulated knockout bracket through
  to a predicted champion.
- **Model** — World-Football-style **Elo ratings** computed from the last 10
  years of international results (`data/results-10y.csv`,
  ~9.5k matches). The Elo edge is translated into win/draw/loss probabilities
  and a most-likely scoreline via a Poisson model.
- **Live scoring** — the page polls `/api/live` every 30s and merges live
  scores into the predicted rows, with a running change feed and **in-browser
  Web Notifications** for kickoffs, goals and full-time.

### Live scores setup

Live scores use the **free tier** of [football-data.org](https://www.football-data.org/)
(World Cup competition). Without a key the page still shows all predictions and
degrades gracefully. To enable live data:

```bash
# get a free key at https://www.football-data.org/client/register
FOOTBALL_DATA_API_KEY=your_key_here npm start
```

### Deploy it to the web (Render.com)

The repo ships a `render.yaml` Blueprint, so getting a permanent public URL
(openable on iPhone/iPad) takes a few minutes:

1. Go to **[render.com](https://render.com)** and sign up / log in **with GitHub**.
2. Click **New +** → **Blueprint**.
3. Connect this repository (`tec102/haikus-for-codespaces`) and pick the branch
   you want to deploy.
4. Render reads `render.yaml`, shows a **world-cup-2026** web service on the
   free plan → click **Apply**.
5. Wait for the first build/deploy, then open the generated
   `https://world-cup-2026-xxxx.onrender.com/worldcup` URL.

> The free plan sleeps after inactivity and wakes on the next visit (~30s cold start).

**Turn on live scores later:** in Render open the service → **Environment** →
add `FOOTBALL_DATA_API_KEY` = your free key from
[football-data.org](https://www.football-data.org/client/register) → save (it
redeploys automatically). Until then, predictions and the bracket work; only
the live feed stays off.

### Recomputing the ratings

```bash
npm run build:elo   # rebuilds data/elo-ratings.json from data/results-10y.csv
```

The group draw and bracket structure live in `data/wc2026.json` and can be
edited if the official fixtures change.
