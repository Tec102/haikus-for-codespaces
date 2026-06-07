let express = require('express');
let app = express();
let ejs = require('ejs');
const haikus = require('./haikus.json');
const { fullPrediction } = require('./src/wc/predict');
const { fetchLive } = require('./src/wc/live');
const port = process.env.PORT || 3000;

app.use(express.static('public'))
app.set('view engine', 'ejs');

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

app.listen(port);
