/*
 * Elo-based prediction engine for the 2026 World Cup.
 *
 * Core is the Elo win-expectancy from data/elo-ratings.json. For presentation
 * we translate the Elo edge into a goal supremacy and run a Poisson model to
 * get win/draw/loss probabilities and a most-likely scoreline. Group standings
 * are predicted from expected points; the knockout bracket is simulated by
 * always advancing the Elo favourite.
 */
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', '..', 'data');
const eloData = JSON.parse(fs.readFileSync(path.join(DATA, 'elo-ratings.json'), 'utf8'));
const wc = JSON.parse(fs.readFileSync(path.join(DATA, 'wc2026.json'), 'utf8'));

const HOSTS = new Set(wc.hosts);
const HOST_ADV = 70; // small Elo bump when a host plays (mostly home crowd)
const AVG_GOALS = 2.7; // average total goals in a WC match
const GOALS_PER_400 = 1.45; // goal supremacy produced by a 400-Elo edge

function rating(team) {
  const r = eloData.ratings[team];
  return r ? r.rating : 1500;
}

function poisson(lambda, k) {
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}
const _fact = [1];
function factorial(n) {
  for (let i = _fact.length; i <= n; i++) _fact[i] = _fact[i - 1] * i;
  return _fact[n];
}

/**
 * Predict a single match between two teams.
 * `host` optionally names a team that gets home advantage (group host games).
 */
function predictMatch(home, away, host) {
  let rh = rating(home);
  let ra = rating(away);
  if (host === home || (host === undefined && HOSTS.has(home) && !HOSTS.has(away))) rh += HOST_ADV;
  if (host === away) ra += HOST_ADV;

  const dr = rh - ra;
  const winExp = 1 / (1 + Math.pow(10, -dr / 400)); // Elo expected points share

  // Translate Elo edge into goal supremacy, then Poisson scoreline grid.
  const sup = (dr / 400) * GOALS_PER_400;
  const lh = Math.max(0.15, (AVG_GOALS + sup) / 2);
  const la = Math.max(0.15, (AVG_GOALS - sup) / 2);

  const MAX = 9;
  let pH = 0, pD = 0, pA = 0, best = { p: -1, h: 0, a: 0 };
  for (let i = 0; i <= MAX; i++) {
    for (let j = 0; j <= MAX; j++) {
      const p = poisson(lh, i) * poisson(la, j);
      if (i > j) pH += p; else if (i === j) pD += p; else pA += p;
      if (p > best.p) best = { p, h: i, a: j };
    }
  }
  return {
    home, away,
    eloHome: Math.round(rh), eloAway: Math.round(ra),
    winExp,
    pHome: pH, pDraw: pD, pAway: pA,
    expGoalsHome: Math.round(lh * 100) / 100,
    expGoalsAway: Math.round(la * 100) / 100,
    scoreline: `${best.h}-${best.a}`,
    pick: pH >= pD && pH >= pA ? home : pA >= pD && pA >= pH ? away : 'Draw',
  };
}

// All 6 round-robin pairings of a 4-team group.
const PAIRS = [[0, 1], [2, 3], [0, 2], [1, 3], [3, 0], [1, 2]];

function predictGroup(letter, teams) {
  const matches = PAIRS.map(([i, j]) => predictMatch(teams[i], teams[j]));
  const stats = {};
  teams.forEach((t) => (stats[t] = { team: t, xPts: 0, elo: rating(t) }));
  for (const m of matches) {
    stats[m.home].xPts += 3 * m.pHome + 1 * m.pDraw;
    stats[m.away].xPts += 3 * m.pAway + 1 * m.pDraw;
  }
  const table = Object.values(stats).sort(
    (a, b) => b.xPts - a.xPts || b.elo - a.elo
  );
  table.forEach((r, i) => {
    r.xPts = Math.round(r.xPts * 100) / 100;
    r.rank = i + 1;
  });
  return { letter, table, matches };
}

function predictGroups() {
  const out = {};
  for (const [letter, teams] of Object.entries(wc.groups)) {
    out[letter] = predictGroup(letter, teams);
  }
  return out;
}

// Determine the 8 best third-placed teams (by expected points, Elo tiebreak).
function bestThirds(groups) {
  const thirds = Object.values(groups).map((g) => ({
    letter: g.letter,
    ...g.table[2],
  }));
  return thirds
    .sort((a, b) => b.xPts - a.xPts || b.elo - a.elo)
    .slice(0, 8);
}

function resolveSlot(slot, groups, thirdsQueue) {
  if (slot === '3RD') return thirdsQueue.shift();
  const [kind, letter] = slot.split(':');
  const t = groups[letter].table;
  if (kind === 'W') return { ...t[0] };
  if (kind === '2') return { ...t[1] };
  return null;
}

// Simulate a knockout tie: advance the Elo favourite (no draws).
function predictTie(a, b) {
  const m = predictMatch(a.team, b.team);
  const pa = m.pHome + m.pDraw * (m.winExp); // split draw mass by win expectancy
  const total = m.pHome + m.pAway + m.pDraw;
  const probA = (m.pHome + m.pDraw * m.winExp) / total;
  const winner = probA >= 0.5 ? a : b;
  return {
    home: a, away: b,
    advance: winner,
    probHome: Math.round(probA * 1000) / 10,
    probAway: Math.round((1 - probA) * 1000) / 10,
    elo: m,
  };
}

const ROUND_NAMES = ['Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'];

function predictKnockout(groups) {
  const thirds = bestThirds(groups);
  const queue = thirds.slice(); // strongest thirds fill the winner slots in order
  // Round of 32
  let ties = wc.knockoutR32.map((m) => {
    const home = resolveSlot(m.home, groups, queue);
    const away = resolveSlot(m.away, groups, queue);
    return { matchNo: m.match, ...predictTie(home, away) };
  });
  const rounds = [{ name: ROUND_NAMES[0], ties }];

  let advancers = ties.map((t) => t.advance);
  for (let r = 1; r < ROUND_NAMES.length; r++) {
    const next = [];
    for (let i = 0; i < advancers.length; i += 2) {
      next.push(predictTie(advancers[i], advancers[i + 1]));
    }
    rounds.push({ name: ROUND_NAMES[r], ties: next });
    advancers = next.map((t) => t.advance);
  }
  const champion = advancers[0];
  return { rounds, thirds, champion };
}

function fullPrediction() {
  const groups = predictGroups();
  const knockout = predictKnockout(groups);
  return { meta: eloData.meta, wcMeta: { tournament: wc.tournament, hosts: wc.hosts, window: wc.window, source: wc.source }, groups, knockout };
}

module.exports = { fullPrediction, predictMatch, rating };
