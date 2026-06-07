/*
 * Live-score provider for the 2026 World Cup.
 *
 * Uses the free tier of football-data.org when a FOOTBALL_DATA_API_KEY
 * environment variable is present. The free tier covers the FIFA World Cup
 * (competition code "WC"). Without a key — or before any match kicks off —
 * it returns an empty, well-formed payload so the UI degrades gracefully.
 *
 * Get a free key at https://www.football-data.org/client/register
 * Set it in the environment:  FOOTBALL_DATA_API_KEY=xxxxx npm start
 */
const API = 'https://api.football-data.org/v4/competitions/WC/matches';
const TTL_MS = 30 * 1000; // respect free-tier rate limits

let cache = { at: 0, payload: null };

// football-data.org team names sometimes differ from our dataset names.
const NAME_FIX = {
  'Korea Republic': 'South Korea',
  'IR Iran': 'Iran',
  'USA': 'United States',
  'Côte d’Ivoire': 'Ivory Coast',
  'Türkiye': 'Turkey',
  'Czechia': 'Czech Republic',
  'DR Congo': 'DR Congo',
};
function fixName(n) {
  return NAME_FIX[n] || n;
}

function normalizeStatus(s) {
  switch (s) {
    case 'IN_PLAY':
    case 'PAUSED':
      return 'LIVE';
    case 'FINISHED':
    case 'AWARDED':
      return 'FINISHED';
    case 'SCHEDULED':
    case 'TIMED':
      return 'SCHEDULED';
    default:
      return s || 'SCHEDULED';
  }
}

async function fetchLive() {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  if (!key) {
    return { live: false, configured: false, matches: [], message: 'Live scores are off. Set FOOTBALL_DATA_API_KEY to enable them.' };
  }
  const now = Date.now();
  if (cache.payload && now - cache.at < TTL_MS) return cache.payload;

  try {
    const res = await fetch(API, { headers: { 'X-Auth-Token': key } });
    if (!res.ok) {
      return { live: false, configured: true, matches: [], message: `Live feed error (HTTP ${res.status}).` };
    }
    const data = await res.json();
    const matches = (data.matches || []).map((m) => ({
      id: m.id,
      utcDate: m.utcDate,
      stage: m.stage,
      group: m.group || null,
      status: normalizeStatus(m.status),
      minute: m.minute || null,
      home: fixName(m.homeTeam && m.homeTeam.name),
      away: fixName(m.awayTeam && m.awayTeam.name),
      homeScore: m.score && m.score.fullTime ? m.score.fullTime.home : null,
      awayScore: m.score && m.score.fullTime ? m.score.fullTime.away : null,
    }));
    const payload = { live: true, configured: true, matches, fetchedAt: new Date().toISOString() };
    cache = { at: now, payload };
    return payload;
  } catch (err) {
    return { live: false, configured: true, matches: [], message: `Live feed unavailable: ${err.message}` };
  }
}

module.exports = { fetchLive };
