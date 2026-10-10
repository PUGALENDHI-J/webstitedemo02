// Vercel serverless entry: every /api/* request (plus /sitemap.xml and /robots.txt via vercel.json rewrites).
const { handle } = require('../lib/api');
module.exports = (req, res) => handle(req, res);
