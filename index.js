let express = require('express');
let path = require('path');
let app = express();
let ejs = require('ejs');
const haikus = require('./haikus.json');
const { fullPrediction } = require('./src/wc/predict');
const { fetchLive } = require('./src/wc/live');
const port = process.env.PORT || 3000;

// Absolute paths so static/EJS work both locally and on Vercel's serverless
// runtime (where the process cwd is not the project root).
app.use(express.static(path.join(__dirname, 'public')))
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', (req, res) => {
  res.render('index', {haikus: haikus});
});

// World Cup 2026 predictions page (Elo-based, with live scoring).
app.get('/worldcup', (req, res) => {
  res.render('worldcup', { prediction: fullPrediction() });
});

// JSON of the predictions (handy for debugging / reuse).
app.get('/api/predictions', (req, res) => {
  res.json(fullPrediction());
});

// Live scores proxy (free-tier football-data.org when a key is configured).
app.get('/api/live', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await fetchLive());
});

// Run a normal server locally / on container hosts; on Vercel the app is
// imported as a serverless handler instead (see api/index.js), so only
// listen when this file is executed directly.
if (require.main === module) {
  app.listen(port);
}

module.exports = app;
