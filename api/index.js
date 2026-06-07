// Vercel serverless entry point. Vercel imports this handler instead of
// running a long-lived server, so we just re-export the Express app.
// All routing/static/EJS rendering is handled inside ../index.js.
module.exports = require('../index.js');
