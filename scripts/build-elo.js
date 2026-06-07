#!/usr/bin/env node
/*
 * Computes World-Football-style Elo ratings from the last 10 years of
 * international results (data/results-10y.csv) and writes data/elo-ratings.json.
 *
 * Method (standard "World Football Elo"):
 *   - Every team starts at 1500.
 *   - Rn = Ro + K * G * (W - We)
 *       We = 1 / (1 + 10^((Rother - (Rself + HA)) / 400))   (win expectancy)
 *       W  = 1 win / 0.5 draw / 0 loss
 *       HA = home advantage in Elo points (0 for neutral-venue games)
 *       G  = goal-difference multiplier
 *       K  = base weight scaled by match importance (tournament)
 *
 * Run:  node scripts/build-elo.js
 */
const fs = require('fs');
const path = require('path');

const CSV = path.join(__dirname, '..', 'data', 'results-10y.csv');
const OUT = path.join(__dirname, '..', 'data', 'elo-ratings.json');

const HOME_ADVANTAGE = 100; // Elo points for the home (non-neutral) team

// Base K by match importance, keyed on a lowercased substring of the tournament.
function baseK(tournament) {
  const t = (tournament || '').toLowerCase();
  if (t.includes('fifa world cup') && !t.includes('qualification')) return 60;
  if (t.includes('confederations')) return 50;
  if (/(uefa euro|copa am|african cup|afc asian cup|gold cup|nations league)/.test(t) && !t.includes('qualification')) return 50;
  if (t.includes('qualification') || t.includes('qualifier')) return 40;
  if (t.includes('friendly')) return 20;
  return 30; // other competitive games
}

// Goal-difference multiplier.
function goalMultiplier(gd) {
  const a = Math.abs(gd);
  if (a <= 1) return 1;
  if (a === 2) return 1.5;
  return (11 + a) / 8;
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const header = lines[0].split(',');
  const idx = {};
  header.forEach((h, i) => (idx[h] = i));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    // No quoted commas in this dataset's relevant columns, but guard anyway.
    const c = splitCsvLine(lines[i]);
    rows.push({
      date: c[idx.date],
      home: c[idx.home_team],
      away: c[idx.away_team],
      hs: parseInt(c[idx.home_score], 10),
      as: parseInt(c[idx.away_score], 10),
      tournament: c[idx.tournament],
      neutral: (c[idx.neutral] || '').toUpperCase() === 'TRUE',
    });
  }
  return rows;
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function main() {
  const rows = parseCSV(fs.readFileSync(CSV, 'utf8'))
    .filter((r) => Number.isFinite(r.hs) && Number.isFinite(r.as))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const ratings = new Map();
  const games = new Map();
  const get = (t) => (ratings.has(t) ? ratings.get(t) : 1500);

  for (const r of rows) {
    const Rh = get(r.home);
    const Ra = get(r.away);
    const ha = r.neutral ? 0 : HOME_ADVANTAGE;
    const We = 1 / (1 + Math.pow(10, (Ra - (Rh + ha)) / 400));
    let Wh;
    if (r.hs > r.as) Wh = 1;
    else if (r.hs === r.as) Wh = 0.5;
    else Wh = 0;
    const K = baseK(r.tournament) * goalMultiplier(r.hs - r.as);
    const delta = K * (Wh - We);
    ratings.set(r.home, Rh + delta);
    ratings.set(r.away, Ra - delta);
    games.set(r.home, (games.get(r.home) || 0) + 1);
    games.set(r.away, (games.get(r.away) || 0) + 1);
  }

  const table = {};
  for (const [team, r] of ratings) {
    table[team] = { rating: Math.round(r * 10) / 10, games: games.get(team) || 0 };
  }

  const meta = {
    generated: new Date().toISOString(),
    source: 'martj42/international_results, last 10 years',
    matches: rows.length,
    dateRange: { from: rows[0].date, to: rows[rows.length - 1].date },
    method: 'World Football Elo (K by importance, goal-diff multiplier, 100-pt home advantage)',
  };

  fs.writeFileSync(OUT, JSON.stringify({ meta, ratings: table }, null, 2));
  const top = Object.entries(table)
    .sort((a, b) => b[1].rating - a[1].rating)
    .slice(0, 15);
  console.log(`Processed ${rows.length} matches (${meta.dateRange.from} → ${meta.dateRange.to})`);
  console.log('Top 15 by Elo:');
  top.forEach(([t, v], i) => console.log(`  ${String(i + 1).padStart(2)}. ${t.padEnd(24)} ${v.rating}`));
  console.log(`\nWrote ${OUT}`);
}

main();
