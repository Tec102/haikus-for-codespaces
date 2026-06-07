
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

### Recomputing the ratings

```bash
npm run build:elo   # rebuilds data/elo-ratings.json from data/results-10y.csv
```

The group draw and bracket structure live in `data/wc2026.json` and can be
edited if the official fixtures change.
