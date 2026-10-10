// Skyrah Impex — website API (admin panel, contact form, generated data scripts, sitemap, robots).
// Runs as a Vercel serverless function (api/[...path].js) and in the local dev server (server.js).
// All content lives in Supabase: Postgres tables + the "uploads" Storage bucket.
'use strict';
const crypto = require('crypto');
const { db: sb, storage } = require('./supabase');
const { render } = require('./data');
const V = require('./validate');
const { HttpError, bad, uid, slugify, str, nextOrder, imagesOf, COLLECTIONS } = V;

const DEFAULT_PASSWORD = 'skyrah@2026';
const IS_CLOUD = !!process.env.VERCEL;
const BASE_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN' };

/* ------------------------------------------------------------------ http helpers */
function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({}, BASE_HEADERS, headers));
  res.end(body);
}
const json = (res, status, obj) => send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });

async function readBody(req, limit) {
  if (req.body !== undefined && req.body !== null) {
    // Vercel has already read and parsed the body
    let b = req.body;
    if (Buffer.isBuffer(b)) b = b.toString('utf8');
    if (typeof b === 'string') { if (b.length > limit) throw new HttpError(413, 'That request is too large.'); try { b = b ? JSON.parse(b) : {}; } catch (e) { throw new HttpError(400, 'Invalid request.'); } }
    return b && typeof b === 'object' ? b : {};
  }
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0, done = false;
    req.on('data', c => {
      if (done) return;
      size += c.length;
      if (size > limit) { done = true; reject(new HttpError(413, 'That request is too large.')); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (done) return;
      if (!size) return resolve({});
      try { const v = JSON.parse(Buffer.concat(chunks).toString('utf8')); resolve(v && typeof v === 'object' ? v : {}); }
      catch (e) { reject(new HttpError(400, 'Invalid request.')); }
    });
    req.on('error', reject);
  });
}
function clientIp(req) {
  const h = req.headers;
  const xff = String(h['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
  return String(h['x-real-ip'] || xff[0] || (req.socket && req.socket.remoteAddress) || 'unknown');
}

/* ------------------------------------------------------------------ content database (one JSON document in Postgres) */
function normalize(d) {
  d = d && typeof d === 'object' ? d : {};
  d.settings = d.settings || {}; d.settings.social = d.settings.social || {};
  ['categories', 'products', 'articles', 'faqs', 'testimonials'].forEach(k => { if (!Array.isArray(d[k])) d[k] = []; });
  return d;
}
async function readDB() {
  const rows = await sb.select('site_db', 'id=eq.1&select=data');
  if (rows && rows[0] && rows[0].data) return normalize(rows[0].data);
  // first run: load the starter content that ships with the project
  const seed = normalize(JSON.parse(JSON.stringify(require('../data/db.json'))));
  await sb.upsert('site_db', [{ id: 1, data: seed, updated_at: new Date().toISOString() }]);
  return seed;
}
async function saveDB(d) {
  const now = new Date().toISOString();
  await sb.upsert('site_db', [{ id: 1, data: d, updated_at: now }]);
  try { // keep the last 30 versions so a mistake can be undone
    await sb.insert('site_db_history', [{ data: d, saved_at: now }]);
    const old = await sb.select('site_db_history', 'select=id&order=id.desc&offset=30&limit=200');
    if (old && old.length) await sb.remove('site_db_history', 'id=in.(' + old.map(r => r.id).join(',') + ')');
  } catch (e) { console.error('History snapshot skipped:', e.message); }
}

/* ------------------------------------------------------------------ admin password + sessions */
const hashPw = (pw, salt) => crypto.scryptSync(String(pw), salt, 64).toString('hex');
async function loadAuth() {
  const rows = await sb.select('admin_auth', 'id=eq.1&select=*');
  if (rows && rows[0]) return rows[0];
  const envPw = process.env.ADMIN_PASSWORD;
  if (!envPw && IS_CLOUD) throw new HttpError(500, 'Admin password is not set. In Vercel add the environment variable ADMIN_PASSWORD and redeploy.');
  const pw = envPw || DEFAULT_PASSWORD, salt = crypto.randomBytes(16).toString('hex');
  const a = { id: 1, salt, hash: hashPw(pw, salt), secret: crypto.randomBytes(32).toString('hex'), is_default: pw === DEFAULT_PASSWORD };
  await sb.upsert('admin_auth', [a]);
  return a;
}
const sign = (v, secret) => crypto.createHmac('sha256', secret).update(v).digest('hex');
const makeToken = a => { const exp = String(Date.now() + 12 * 3600e3); return exp + '.' + sign(exp, a.secret); };
function validToken(t, a) {
  const [exp, sig] = String(t || '').split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const x = Buffer.from(sig), y = Buffer.from(sign(exp, a.secret));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function checkPassword(pw, a) {
  const x = Buffer.from(hashPw(pw, a.salt), 'hex'), y = Buffer.from(a.hash, 'hex');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* rate limiting kept in Postgres, because serverless instances do not share memory */
async function limited(key, max, windowMs) {
  const since = new Date(Date.now() - windowMs).toISOString();
  const rows = await sb.select('rate_limits', 'key=eq.' + encodeURIComponent(key) + '&at=gte.' + encodeURIComponent(since) + '&select=id&limit=' + max);
  return rows.length >= max;
}
const hit = key => sb.insert('rate_limits', [{ key }]);
const clearHits = key => sb.remove('rate_limits', 'key=eq.' + encodeURIComponent(key));
const sweepRateLimits = () => sb.remove('rate_limits', 'at=lt.' + encodeURIComponent(new Date(Date.now() - 24 * 3600e3).toISOString())).catch(() => {});

/* ------------------------------------------------------------------ uploads (Supabase Storage) */
const SIGS = [
  { ext: 'jpg', mime: 'image/jpeg', test: b => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF },
  { ext: 'png', mime: 'image/png', test: b => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) },
  { ext: 'webp', mime: 'image/webp', test: b => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP' },
  { ext: 'gif', mime: 'image/gif', test: b => b.slice(0, 4).toString() === 'GIF8' }
];
async function saveUpload(b) {
  const m = /^data:image\/[a-z+]+;base64,([A-Za-z0-9+/=\s]+)$/.exec(String(b.data || ''));
  if (!m) bad('Please choose a JPG, PNG or WebP image.');
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > 4 * 1024 * 1024) bad('Image is too large (max 4 MB after resizing). Please choose a smaller photo.');
  const sig = SIGS.find(s => buf.length > 12 && s.test(buf));
  if (!sig) bad('That file is not a supported image. Use JPG, PNG or WebP.');
  const base = String(b.name || 'image').replace(/\.[^.]*$/, '');
  const name = Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex') + '-' + slugify(base).slice(0, 40) + '.' + sig.ext;
  await storage.upload(name, buf, sig.mime);
  if (Math.random() < 0.1) sweepUploads().catch(() => {});   // now and then, tidy up images that were never saved
  return storage.publicUrl(name);
}
/* delete uploaded files nothing refers to any more */
async function cleanupUploads(urls, d) {
  const used = JSON.stringify(d);
  const gone = urls.filter(u => u && storage.isOurUrl(u) && !used.includes('"' + u + '"')).map(storage.nameFromUrl);
  try { await storage.remove(gone); } catch (e) { console.error('Upload cleanup skipped:', e.message); }
}
async function sweepUploads() {
  const used = JSON.stringify(await readDB());
  const files = await storage.list();
  const old = (files || []).filter(f => f.name && f.created_at && Date.now() - new Date(f.created_at).getTime() > 24 * 3600e3
    && !used.includes('/' + f.name + '"')).map(f => f.name);
  await storage.remove(old);
}

/* ------------------------------------------------------------------ enquiries */
const fromRow = r => ({ id: r.id, createdAt: r.created_at, status: r.status, name: r.name, phone: r.phone, email: r.email, subject: r.subject, message: r.message, product: r.product || '' });
const listEnquiries = async () => (await sb.select('enquiries', 'select=*&order=created_at.desc&limit=2000')).map(fromRow);

/* ------------------------------------------------------------------ public generated files */
const SITE_FALLBACK = 'https://www.skyrahimpex.com';
function siteUrl(d) {
  const w = String(process.env.SITE_URL || (d && d.settings && d.settings.website) || SITE_FALLBACK).trim();
  return (/^https?:\/\//i.test(w) ? w : 'https://' + w).replace(/\/+$/, '');
}
function sitemapXml(d) {
  const base = siteUrl(d), today = new Date().toISOString().slice(0, 10);
  const urls = [['', 1.0, 'weekly'], ['shop.html', 0.9, 'weekly'], ['about.html', 0.7, 'monthly'], ['journal.html', 0.6, 'weekly'],
    ['contact.html', 0.7, 'monthly'], ['faq.html', 0.5, 'monthly'], ['policies.html', 0.3, 'yearly']].map(([p, pr, cf]) => [base + '/' + p, pr, cf]);
  [...d.categories].sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(c => urls.push([base + '/shop.html?cat=' + encodeURIComponent(c.name), 0.7, 'weekly']));
  d.products.forEach(p => urls.push([base + '/product.html?slug=' + encodeURIComponent(p.slug), 0.8, 'monthly']));
  d.articles.filter(a => a.published !== false).forEach(a => urls.push([base + '/journal-post.html?post=' + encodeURIComponent(a.slug), 0.5, 'monthly']));
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(([u, pr, cf]) => '  <url>\n    <loc>' + esc(u) + '</loc>\n    <lastmod>' + today + '</lastmod>\n    <changefreq>' + cf + '</changefreq>\n    <priority>' + pr.toFixed(1) + '</priority>\n  </url>').join('\n') + '\n</urlset>\n';
}
const robotsTxt = d => 'User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\n\nSitemap: ' + siteUrl(d) + '/sitemap.xml\n';

const CACHE_PUBLIC = 'public, max-age=0, s-maxage=30, stale-while-revalidate=300';
async function servePublic(res, route) {
  let d, cache = CACHE_PUBLIC;
  try { d = await readDB(); }
  catch (e) {   // Supabase unreachable: keep the shop working from the starter content
    console.error('Public data fallback:', e.message);
    d = normalize(JSON.parse(JSON.stringify(require('../data/db.json')))); cache = 'public, max-age=0, s-maxage=10';
  }
  if (route === '/data/products') return send(res, 200, render(d).products, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': cache });
  if (route === '/data/journal') return send(res, 200, render(d).journal, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': cache });
  if (route === '/sitemap') return send(res, 200, sitemapXml(d), { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': cache });
  if (route === '/robots') return send(res, 200, robotsTxt(d), { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': cache });
}

/* ------------------------------------------------------------------ routes */
async function api(req, res, route) {
  const method = req.method, parts = route.split('/').filter(Boolean);
  const ip = clientIp(req);

  if (method === 'GET' && ['/data/products', '/data/journal', '/sitemap', '/robots'].includes(route)) return servePublic(res, route);

  // ---- public endpoints
  if (route === '/login' && method === 'POST') {
    if (await limited('login:' + ip, 8, 15 * 60e3)) throw new HttpError(429, 'Too many attempts. Please wait 15 minutes and try again.');
    const b = await readBody(req, 10e3), auth = await loadAuth();
    if (!checkPassword(String(b.password || ''), auth)) { await hit('login:' + ip); sweepRateLimits(); throw new HttpError(401, 'Wrong password.'); }
    await clearHits('login:' + ip);
    return json(res, 200, { token: makeToken(auth), defaultPassword: !!auth.is_default });
  }
  if (route === '/enquiry' && method === 'POST') {
    if (await limited('enq:' + ip, 5, 10 * 60e3)) throw new HttpError(429, 'You have sent several messages already. Please try again in a few minutes, or reach us on WhatsApp.');
    const b = await readBody(req, 20e3);
    if (b.website) return json(res, 200, { ok: true }); // honeypot: silently drop bots
    const e = V.cleanEnquiry(b);
    await hit('enq:' + ip);
    await sb.insert('enquiries', [{ id: uid('e'), status: 'new', name: e.name, phone: e.phone, email: e.email, subject: e.subject, message: e.message, product: e.product }]);
    return json(res, 200, { ok: true });
  }

  // ---- everything below needs a valid admin session
  const auth = await loadAuth();
  if (!validToken(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''), auth)) throw new HttpError(401, 'Your session has ended. Please log in again.');

  if (route === '/session' && method === 'GET') return json(res, 200, { ok: true, defaultPassword: !!auth.is_default });
  if (route === '/store' && method === 'GET') {
    const [d, fresh] = await Promise.all([readDB(), sb.select('enquiries', 'status=eq.new&select=id')]);
    return json(res, 200, { db: d, newEnquiries: fresh.length, defaultPassword: !!auth.is_default });
  }
  if (route === '/backup' && method === 'GET') {
    const body = JSON.stringify({ db: await readDB(), enquiries: await listEnquiries(), exportedAt: new Date().toISOString() }, null, 2);
    return send(res, 200, body, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'Content-Disposition': 'attachment; filename="skyrah-backup-' + new Date().toISOString().slice(0, 10) + '.json"' });
  }
  if (route === '/upload' && method === 'POST') {
    const b = await readBody(req, 6 * 1024 * 1024);
    return json(res, 200, { path: await saveUpload(b) });
  }
  if (route === '/settings' && method === 'PUT') {
    const b = await readBody(req, 50e3), d = await readDB();
    d.settings = V.cleanSettings(b, d.settings); await saveDB(d);
    return json(res, 200, d.settings);
  }
  if (route === '/password' && method === 'POST') {
    const b = await readBody(req, 10e3);
    if (await limited('pw:' + ip, 8, 15 * 60e3)) throw new HttpError(429, 'Too many attempts. Please wait 15 minutes.');
    if (!checkPassword(String(b.current || ''), auth)) { await hit('pw:' + ip); bad('Your current password is not correct.'); }
    const next = String(b.next || '');
    if (next.length < 8) bad('Choose a new password of at least 8 characters.');
    if (next === DEFAULT_PASSWORD) bad('Please choose a password different from the default one.');
    const salt = crypto.randomBytes(16).toString('hex');
    const a = { id: 1, salt, hash: hashPw(next, salt), secret: crypto.randomBytes(32).toString('hex'), is_default: false };
    await sb.upsert('admin_auth', [a]);
    return json(res, 200, { token: makeToken(a) }); // other sessions are signed out
  }
  if (route === '/reorder' && method === 'POST') {
    const b = await readBody(req, 50e3), d = await readDB();
    if (!COLLECTIONS[b.collection]) bad('Unknown list.');
    const ids = Array.isArray(b.ids) ? b.ids.map(String) : [];
    const list = d[b.collection];
    if (ids.length !== list.length || !list.every(x => ids.includes(x.id))) bad('The list changed — please refresh and try again.');
    list.forEach(x => { x.order = ids.indexOf(x.id); });
    await saveDB(d); return json(res, 200, { ok: true });
  }

  // enquiries inbox
  if (parts[0] === 'enquiries') {
    if (method === 'GET' && parts.length === 1) return json(res, 200, await listEnquiries());
    const id = encodeURIComponent(parts[1] || '');
    if (method === 'PATCH') {
      const b = await readBody(req, 5e3);
      if (!['new', 'read', 'replied'].includes(b.status)) bad('Unknown status.');
      const rows = await sb.update('enquiries', 'id=eq.' + id, { status: b.status });
      if (!rows || !rows[0]) throw new HttpError(404, 'Message not found.');
      return json(res, 200, fromRow(rows[0]));
    }
    if (method === 'DELETE') { await sb.remove('enquiries', 'id=eq.' + id); return json(res, 200, { ok: true }); }
  }

  // generic collections: categories, products, articles, faqs, testimonials
  const col = COLLECTIONS[parts[0]];
  if (col) {
    const d = await readDB(), list = d[parts[0]];
    if (method === 'POST' && parts.length === 1) {
      const b = await readBody(req, 200e3);
      const now = new Date().toISOString();
      const item = Object.assign({ id: uid(col.prefix) }, col.clean(b, d, null), { order: nextOrder(list) });
      if (parts[0] === 'products') Object.assign(item, { createdAt: now, updatedAt: now });
      list.push(item); await saveDB(d); return json(res, 200, item);
    }
    const i = list.findIndex(x => x.id === parts[1]);
    if (parts.length !== 2 || i < 0) throw new HttpError(404, col.label + ' not found. It may have been deleted — please refresh.');
    const cur = list[i];
    if (method === 'PUT') {
      const b = await readBody(req, 200e3);
      const before = imagesOf(cur);
      list[i] = Object.assign({}, cur, col.clean(b, d, cur), parts[0] === 'products' ? { updatedAt: new Date().toISOString() } : {});
      await saveDB(d); await cleanupUploads(before, d); return json(res, 200, list[i]);
    }
    if (method === 'PATCH' && parts[0] === 'products') { // quick toggles from the product list
      const b = await readBody(req, 5e3);
      if ('inStock' in b) cur.inStock = !!b.inStock;
      if ('featured' in b) cur.featured = !!b.featured;
      cur.updatedAt = new Date().toISOString();
      await saveDB(d); return json(res, 200, cur);
    }
    if (method === 'DELETE') {
      if (parts[0] === 'categories') {
        const n = d.products.filter(p => p.categoryId === cur.id).length;
        if (n) bad('This category still has ' + n + ' product' + (n > 1 ? 's' : '') + '. Move or delete them first.');
      }
      list.splice(i, 1); await saveDB(d); await cleanupUploads(imagesOf(cur), d); return json(res, 200, { ok: true });
    }
  }
  throw new HttpError(404, 'Not found.');
}

/* ------------------------------------------------------------------ entry point (Vercel + local) */
async function handle(req, res) {
  let url;
  try { url = new URL(String(req.url || '/').replace(/^\/{2,}/, '/'), 'http://localhost'); } catch (e) { return send(res, 400, 'Bad request'); }
  let route = url.pathname;
  if (route === '/sitemap.xml') route = '/api/sitemap';
  if (route === '/robots.txt') route = '/api/robots';
  route = route.replace(/^\/api/, '').replace(/\/+$/, '') || '/';
  try { await api(req, res, route); }
  catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(new Date().toISOString(), req.method, url.pathname, e.message);
    if (!res.headersSent) json(res, status, { error: status === 500 ? (e.config || /Admin password is not set/.test(e.message) ? e.message : 'Something went wrong on the server. Please try again.') : e.message });
  }
}

module.exports = { handle };
