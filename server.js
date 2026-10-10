// Skyrah Impex — LOCAL development server (the live site runs on Vercel + Supabase).
//   1. copy .env.example to .env and fill in your Supabase values
//   2. node server.js        → http://localhost:3000  (admin at /admin/)
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');

// tiny .env loader (no packages needed)
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(l => {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l);
    if (m && !l.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) { /* no .env file */ }

const { handle } = require('./lib/api');
const PUBLIC = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 3000;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8' };

http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(String(req.url).replace(/^\/{2,}/, '/'), 'http://x').pathname); } catch (e) { res.writeHead(400); return res.end('Bad request'); }
  if (p.startsWith('/api/') || p === '/sitemap.xml' || p === '/robots.txt') return handle(req, res);
  if (p === '/admin') { res.writeHead(301, { Location: '/admin/' }); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  let file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  const serve = f => fs.stat(f, (err, st) => {
    if (err || !st.isFile()) {
      return fs.readFile(path.join(PUBLIC, '404.html'), (e, buf) => { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(e ? 'Not found' : buf); });
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(f).pipe(res);
  });
  if (!path.extname(file) && fs.existsSync(file + '.html')) file += '.html';
  serve(file);
}).listen(PORT, () => console.log('Skyrah Impex (dev) on http://localhost:' + PORT + '   admin: http://localhost:' + PORT + '/admin/'));
