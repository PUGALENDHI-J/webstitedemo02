// Skyrah Impex — website + admin panel server.
// Zero dependencies: needs only Node.js 18 or newer.
//   node server.js                      → http://localhost:3000  (admin at /admin)
//   PORT=8080 node server.js            → choose another port
//   ADMIN_PASSWORD="…" node server.js   → initial admin password (first start only, see README)
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { build } = require('./lib/data');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const DATA = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA, 'db.json');
const ENQ_FILE = path.join(DATA, 'enquiries.json');
const AUTH_FILE = path.join(DATA, 'auth.json');
const BACKUPS = path.join(DATA, 'backups');
const UPLOADS = path.join(ROOT, 'assets', 'uploads');
const DEFAULT_PASSWORD = 'skyrah@2026';
[DATA, BACKUPS, UPLOADS].forEach(d => fs.mkdirSync(d, { recursive: true }));

/* ------------------------------------------------------------------ storage */
const readJSON = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return fallback; } };
function writeJSON(f, data) {
  const tmp = f + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, f);
}
function readDB() {
  const d = readJSON(DB_FILE, null);
  if (!d) throw new Error('data/db.json is missing or damaged. Restore it from data/backups.');
  d.settings = d.settings || {}; d.settings.social = d.settings.social || {};
  ['categories', 'products', 'articles', 'faqs', 'testimonials'].forEach(k => { if (!Array.isArray(d[k])) d[k] = []; });
  return d;
}
function backup() {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(DB_FILE, path.join(BACKUPS, 'db-' + stamp + '.json'));
    const old = fs.readdirSync(BACKUPS).filter(f => /^db-.*\.json$/.test(f)).sort();
    old.slice(0, Math.max(0, old.length - 30)).forEach(f => fs.unlinkSync(path.join(BACKUPS, f)));
  } catch (e) { /* first write — nothing to back up */ }
}
function saveDB(d) { backup(); writeJSON(DB_FILE, d); build(d); }

/* ------------------------------------------------------------------ auth */
const hashPw = (pw, salt) => crypto.scryptSync(String(pw), salt, 64).toString('hex');
function loadAuth() {
  let a = readJSON(AUTH_FILE, null);
  if (!a || process.env.RESET_ADMIN_PASSWORD === '1') {
    const pw = process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD, salt = crypto.randomBytes(16).toString('hex');
    a = { salt, hash: hashPw(pw, salt), secret: crypto.randomBytes(32).toString('hex'), isDefault: pw === DEFAULT_PASSWORD };
    writeJSON(AUTH_FILE, a);
  }
  return a;
}
let auth = loadAuth();
const sign = v => crypto.createHmac('sha256', auth.secret).update(v).digest('hex');
const makeToken = () => { const exp = String(Date.now() + 12 * 3600e3); return exp + '.' + sign(exp); };
function validToken(t) {
  const [exp, sig] = String(t || '').split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function checkPassword(pw) {
  const a = Buffer.from(hashPw(pw, auth.salt), 'hex'), b = Buffer.from(auth.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* simple in-memory rate limiter */
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now(), list = (hits.get(key) || []).filter(t => now - t < windowMs);
  hits.set(key, list);
  return list.length >= max;
}
const hit = key => { const l = hits.get(key) || []; l.push(Date.now()); hits.set(key, l); };
setInterval(() => { const now = Date.now(); for (const [k, l] of hits) if (!l.some(t => now - t < 3600e3)) hits.delete(k); }, 600e3).unref();
function clientIp(req) {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
  return xff.length ? xff[xff.length - 1] : (req.socket.remoteAddress || '');
}

/* ------------------------------------------------------------------ helpers */
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const bad = msg => { throw new HttpError(400, msg); };
const uid = p => p + '-' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
const slugify = s => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'item';
const uniqueSlug = (list, base, selfId) => { let s = base, i = 2; while (list.some(x => x.slug === s && x.id !== selfId)) s = base + '-' + i++; return s; };
const str = (v, max, label, required) => {
  const s = String(v == null ? '' : v).replace(/\r\n/g, '\n').trim();
  if (required && !s) bad(label + ' is required.');
  if (s.length > max) bad(label + ' is too long (max ' + max + ' characters).');
  return s;
};
const num = (v, label) => {
  if (v === '' || v == null) return 0;
  const n = Number(v);
  if (!isFinite(n) || n < 0) bad(label + ' must be a positive number.');
  if (n > 10000000) bad(label + ' is too large.');
  return Math.round(n * 100) / 100;
};
const IMG_RE = /^assets\/[a-z0-9_\-./]+\.(jpe?g|png|webp|gif|svg)$/i;
function imgPath(v, label, required) {
  const s = String(v || '').trim();
  if (!s) { if (required) bad(label + ' is required — please upload an image.'); return ''; }
  if (!IMG_RE.test(s) || s.includes('..')) bad(label + ' is not a valid image path.');
  if (!fs.existsSync(path.join(ROOT, s))) bad(label + ' was not found on the server — please upload it again.');
  return s;
}
const tagList = v => (Array.isArray(v) ? v : String(v || '').split(','))
  .map(t => String(t).trim().toLowerCase()).filter(Boolean).filter((t, i, a) => a.indexOf(t) === i).slice(0, 20).map(t => t.slice(0, 40));
const nextOrder = list => list.reduce((m, x) => Math.max(m, Number(x.order) || 0), -1) + 1;
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;

/* remove uploaded files that nothing references any more */
function cleanupUploads(paths, d) {
  const json = JSON.stringify(d);
  paths.filter(p => p && p.startsWith('assets/uploads/') && !json.includes('"' + p + '"'))
    .forEach(p => { try { fs.unlinkSync(path.join(ROOT, p)); } catch (e) { /* already gone */ } });
}
const imagesOf = x => [x.img, ...(x.gallery || [])].filter(Boolean);

/* ------------------------------------------------------------------ validators */
function cleanCategory(b, d, self) {
  const name = str(b.name, 60, 'Category name', true);
  if (d.categories.some(c => c.name.toLowerCase() === name.toLowerCase() && (!self || c.id !== self.id))) bad('A category with this name already exists.');
  return {
    name, slug: uniqueSlug(d.categories, slugify(name), self && self.id),
    description: str(b.description, 200, 'Description'),
    img: imgPath(b.img, 'Category image', false) || 'assets/img/logo.png'
  };
}
function cleanProduct(b, d, self) {
  const name = str(b.name, 80, 'Product name', true);
  if (!d.categories.some(c => c.id === b.categoryId)) bad('Choose a category for this product.');
  const price = num(b.price, 'Selling price'), mrp = num(b.mrp, 'MRP');
  if (mrp && price && mrp < price) bad('MRP cannot be lower than the selling price.');
  const gallery = (Array.isArray(b.gallery) ? b.gallery : []).slice(0, 8).map((g, i) => imgPath(g, 'Gallery image ' + (i + 1), true));
  return {
    name, slug: uniqueSlug(d.products, slugify(b.slug || (self ? self.slug : name)), self && self.id), categoryId: b.categoryId,
    desc: str(b.desc, 160, 'Short description', true), long: str(b.long, 3000, 'Full description'),
    usage: str(b.usage, 2000, 'How to use'), storage: str(b.storage, 500, 'Storage'), ingredients: str(b.ingredients, 500, 'Ingredients'),
    shelfLife: str(b.shelfLife, 60, 'Shelf life'), origin: str(b.origin, 60, 'Origin'), weight: str(b.weight, 60, 'Pack size'),
    price, mrp, img: imgPath(b.img, 'Main product image', true), gallery, tags: tagList(b.tags),
    inStock: b.inStock !== false, featured: !!b.featured
  };
}
function cleanArticle(b, d, self) {
  const title = str(b.title, 140, 'Title', true);
  const date = str(b.date, 10, 'Date', true);
  if (!isDate(date)) bad('Enter the date as YYYY-MM-DD.');
  return {
    title, slug: uniqueSlug(d.articles, slugify(b.slug || (self ? self.slug : title)), self && self.id), cat: str(b.cat, 40, 'Category', true),
    img: imgPath(b.img, 'Cover image', true), excerpt: str(b.excerpt, 300, 'Summary', true), author: str(b.author, 80, 'Author') || 'Skyrah Impex Team',
    date, readTime: str(b.readTime, 30, 'Read time'), tags: tagList(b.tags), body: str(b.body, 30000, 'Article text', true), published: b.published !== false
  };
}
const cleanFaq = b => ({ cat: str(b.cat, 40, 'Topic', true), q: str(b.q, 200, 'Question', true), a: str(b.a, 2000, 'Answer', true) });
function cleanTestimonial(b) {
  const rating = Number(b.rating);
  return { quote: str(b.quote, 400, 'Quote', true), name: str(b.name, 60, 'Customer name', true), place: str(b.place, 60, 'City / country'),
    rating: [0, 1, 2, 3, 4, 5].includes(rating) ? rating : 5 };
}
const COLLECTIONS = {
  categories: { clean: cleanCategory, prefix: 'c', label: 'Category' },
  products: { clean: cleanProduct, prefix: 'p', label: 'Product' },
  articles: { clean: cleanArticle, prefix: 'a', label: 'Article' },
  faqs: { clean: cleanFaq, prefix: 'f', label: 'FAQ' },
  testimonials: { clean: cleanTestimonial, prefix: 't', label: 'Testimonial' }
};

function cleanSettings(b, cur) {
  const wa = String(b.whatsapp || '').replace(/\D/g, '');
  if (wa.length < 10 || wa.length > 15) bad('WhatsApp number: enter country code + number, e.g. 919566348350.');
  const email = str(b.email, 120, 'Email', true);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bad('Enter a valid email address.');
  const url = (v, label) => { const s = str(v, 300, label); if (s && !/^https:\/\/[^\s]+$/i.test(s)) bad(label + ' must be a full link starting with https://'); return s; };
  const social = b.social || {};
  return Object.assign({}, cur, {
    legalName: str(b.legalName, 120, 'Registered company name', true), brand: str(b.brand, 60, 'Brand name', true),
    tagline: str(b.tagline, 120, 'Tagline'), businessLine: str(b.businessLine, 80, 'Business line'),
    director: str(b.director, 80, 'Director name'), directorTitle: str(b.directorTitle, 60, 'Director title'),
    phone1: str(b.phone1, 30, 'Primary phone', true), phone2: str(b.phone2, 30, 'Second phone'), whatsapp: wa, email,
    website: str(b.website, 120, 'Website'), address: str(b.address, 300, 'Address', true), mapQuery: str(b.mapQuery, 300, 'Map search text'),
    hours: str(b.hours, 120, 'Business hours'), fssai: str(b.fssai, 40, 'FSSAI number'), gstin: str(b.gstin, 30, 'GSTIN'), iec: str(b.iec, 30, 'IEC'),
    shippingNote: str(b.shippingNote, 1000, 'Shipping note'),
    social: { instagram: url(social.instagram, 'Instagram link'), facebook: url(social.facebook, 'Facebook link'),
      youtube: url(social.youtube, 'YouTube link'), linkedin: url(social.linkedin, 'LinkedIn link') }
  });
}

/* ------------------------------------------------------------------ uploads */
const SIGS = [
  { ext: 'jpg', test: b => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF },
  { ext: 'png', test: b => b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) },
  { ext: 'webp', test: b => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP' },
  { ext: 'gif', test: b => b.slice(0, 4).toString() === 'GIF8' }
];
function saveUpload(b) {
  const m = /^data:image\/[a-z+]+;base64,([A-Za-z0-9+/=\s]+)$/.exec(String(b.data || ''));
  if (!m) bad('Please choose a JPG, PNG or WebP image.');
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > 8 * 1024 * 1024) bad('Image is too large (max 8 MB).');
  const sig = SIGS.find(s => buf.length > 12 && s.test(buf));
  if (!sig) bad('That file is not a supported image. Use JPG, PNG or WebP.');
  const name = Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex') + '-' + slugify(path.parse(String(b.name || 'image')).name).slice(0, 40) + '.' + sig.ext;
  fs.writeFileSync(path.join(UPLOADS, name), buf);
  return 'assets/uploads/' + name;
}

/* ------------------------------------------------------------------ enquiries */
const SUBJECTS = ['Product Enquiry', 'Bulk / Wholesale Order', 'Export Enquiry', 'Order Support', 'Feedback', 'Other'];
function cleanEnquiry(b) {
  const name = str(b.name, 80, 'Name', true);
  if (name.length < 2) bad('Please enter your name.');
  const phone = str(b.phone, 20, 'Phone', true), digits = phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) bad('Please enter a valid phone number.');
  const email = str(b.email, 120, 'Email', true);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bad('Please enter a valid email address.');
  const subject = str(b.subject, 60, 'Subject', true);
  if (!SUBJECTS.includes(subject)) bad('Please choose a subject.');
  const message = str(b.message, 3000, 'Message', true);
  if (message.length < 10) bad('Please write a little more in your message.');
  return { name, phone, email, subject, message, product: str(b.product, 80, 'Product') };
}

/* ------------------------------------------------------------------ http plumbing */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8' };
const BASE_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN' };

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({}, BASE_HEADERS, headers));
  res.end(body);
}
const json = (res, status, obj) => send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'That is too large to upload.')); req.resume(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (size > limit) return;
      if (!size) return resolve({});
      try { const v = JSON.parse(Buffer.concat(chunks).toString('utf8')); resolve(v && typeof v === 'object' ? v : {}); }
      catch (e) { reject(new HttpError(400, 'Invalid request.')); }
    });
    req.on('error', reject);
  });
}

/* static files: only the public site, assets and admin are ever served */
const PUBLIC_RE = /^\/(assets\/.+|admin\/([a-z0-9-]+\.(html|css|js))?|[a-z0-9-]+\.html|favicon\.ico|robots\.txt)?$/i;
function serveStatic(req, res, urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath); } catch (e) { return send(res, 400, 'Bad request'); }
  if (p === '/admin') return send(res, 301, '', { Location: '/admin/' });
  if (!/\.[a-z0-9]+$/i.test(p) && !p.endsWith('/') && fs.existsSync(path.join(ROOT, p + '.html'))) p += '.html';
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT + path.sep) || !PUBLIC_RE.test(p) || p.includes('\0') || /\.tmp$/.test(p)) return notFound(res);
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return notFound(res);
    const ext = path.extname(file).toLowerCase();
    const etag = 'W/"' + st.size.toString(16) + '-' + Math.floor(st.mtimeMs).toString(16) + '"';
    const isImg = /^image\//.test(MIME[ext] || '') || ext === '.woff2';
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', ETag: etag,
      'Cache-Control': p.startsWith('/admin') ? 'no-store' : isImg ? 'public, max-age=604800' : 'no-cache' };
    if (ext === '.svg') headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'";
    if (req.headers['if-none-match'] === etag) return send(res, 304, '', headers);
    headers['Content-Length'] = st.size;
    res.writeHead(200, Object.assign({}, BASE_HEADERS, headers));
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}
function notFound(res) {
  const f = path.join(ROOT, '404.html');
  fs.readFile(f, (e, buf) => send(res, 404, e ? 'Not found' : buf, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }));
}

/* ------------------------------------------------------------------ API */
async function api(req, res, route) {
  const method = req.method, parts = route.split('/').filter(Boolean); // e.g. ['products','p-1']
  const ip = clientIp(req);

  // ---- public endpoints
  if (route === '/login' && method === 'POST') {
    if (limited('login:' + ip, 8, 15 * 60e3)) throw new HttpError(429, 'Too many attempts. Please wait 15 minutes and try again.');
    const b = await readBody(req, 10e3);
    if (!checkPassword(String(b.password || ''))) { hit('login:' + ip); throw new HttpError(401, 'Wrong password.'); }
    hits.delete('login:' + ip);
    return json(res, 200, { token: makeToken(), defaultPassword: !!auth.isDefault });
  }
  if (route === '/enquiry' && method === 'POST') {
    if (limited('enq:' + ip, 5, 10 * 60e3)) throw new HttpError(429, 'You have sent several messages already. Please try again in a few minutes, or reach us on WhatsApp.');
    const b = await readBody(req, 20e3);
    if (b.website) return json(res, 200, { ok: true }); // honeypot: silently drop bots
    const e = cleanEnquiry(b);
    hit('enq:' + ip);
    const list = readJSON(ENQ_FILE, []);
    list.unshift(Object.assign({ id: uid('e'), createdAt: new Date().toISOString(), status: 'new' }, e));
    writeJSON(ENQ_FILE, list.slice(0, 2000));
    return json(res, 200, { ok: true });
  }

  // ---- everything below needs a valid admin session
  if (!validToken(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''))) throw new HttpError(401, 'Your session has ended. Please log in again.');

  if (route === '/session' && method === 'GET') return json(res, 200, { ok: true, defaultPassword: !!auth.isDefault });
  if (route === '/store' && method === 'GET') {
    const enq = readJSON(ENQ_FILE, []);
    return json(res, 200, { db: readDB(), newEnquiries: enq.filter(e => e.status === 'new').length, defaultPassword: !!auth.isDefault });
  }
  if (route === '/backup' && method === 'GET') {
    const body = JSON.stringify({ db: readDB(), enquiries: readJSON(ENQ_FILE, []), exportedAt: new Date().toISOString() }, null, 2);
    return send(res, 200, body, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'Content-Disposition': 'attachment; filename="skyrah-backup-' + new Date().toISOString().slice(0, 10) + '.json"' });
  }
  if (route === '/upload' && method === 'POST') {
    const b = await readBody(req, 12 * 1024 * 1024);
    return json(res, 200, { path: saveUpload(b) });
  }
  if (route === '/settings' && method === 'PUT') {
    const b = await readBody(req, 50e3), d = readDB();
    d.settings = cleanSettings(b, d.settings); saveDB(d);
    return json(res, 200, d.settings);
  }
  if (route === '/password' && method === 'POST') {
    const b = await readBody(req, 10e3);
    if (limited('pw:' + ip, 8, 15 * 60e3)) throw new HttpError(429, 'Too many attempts. Please wait 15 minutes.');
    if (!checkPassword(String(b.current || ''))) { hit('pw:' + ip); bad('Your current password is not correct.'); }
    const next = String(b.next || '');
    if (next.length < 8) bad('Choose a new password of at least 8 characters.');
    if (next === DEFAULT_PASSWORD) bad('Please choose a password different from the default one.');
    const salt = crypto.randomBytes(16).toString('hex');
    auth = { salt, hash: hashPw(next, salt), secret: crypto.randomBytes(32).toString('hex'), isDefault: false };
    writeJSON(AUTH_FILE, auth);
    return json(res, 200, { token: makeToken() }); // other sessions are signed out
  }
  if (route === '/reorder' && method === 'POST') {
    const b = await readBody(req, 50e3), d = readDB();
    if (!COLLECTIONS[b.collection]) bad('Unknown list.');
    const ids = Array.isArray(b.ids) ? b.ids.map(String) : [];
    const list = d[b.collection];
    if (ids.length !== list.length || !list.every(x => ids.includes(x.id))) bad('The list changed — please refresh and try again.');
    list.forEach(x => { x.order = ids.indexOf(x.id); });
    saveDB(d); return json(res, 200, { ok: true });
  }

  // enquiries inbox
  if (parts[0] === 'enquiries') {
    const list = readJSON(ENQ_FILE, []);
    if (method === 'GET' && parts.length === 1) return json(res, 200, list);
    const i = list.findIndex(e => e.id === parts[1]);
    if (i < 0) throw new HttpError(404, 'Message not found.');
    if (method === 'PATCH') {
      const b = await readBody(req, 5e3);
      if (!['new', 'read', 'replied'].includes(b.status)) bad('Unknown status.');
      list[i].status = b.status; writeJSON(ENQ_FILE, list); return json(res, 200, list[i]);
    }
    if (method === 'DELETE') { list.splice(i, 1); writeJSON(ENQ_FILE, list); return json(res, 200, { ok: true }); }
  }

  // generic collections: categories, products, articles, faqs, testimonials
  const col = COLLECTIONS[parts[0]];
  if (col) {
    const d = readDB(), list = d[parts[0]];
    if (method === 'POST' && parts.length === 1) {
      const b = await readBody(req, 200e3);
      const now = new Date().toISOString();
      const item = Object.assign({ id: uid(col.prefix) }, col.clean(b, d, null), { order: nextOrder(list) });
      if (parts[0] === 'products') Object.assign(item, { createdAt: now, updatedAt: now });
      list.push(item); saveDB(d); return json(res, 200, item);
    }
    const i = list.findIndex(x => x.id === parts[1]);
    if (parts.length !== 2 || i < 0) throw new HttpError(404, col.label + ' not found. It may have been deleted — please refresh.');
    const cur = list[i];
    if (method === 'PUT') {
      const b = await readBody(req, 200e3);
      const before = imagesOf(cur);
      list[i] = Object.assign({}, cur, col.clean(b, d, cur), parts[0] === 'products' ? { updatedAt: new Date().toISOString() } : {});
      saveDB(d); cleanupUploads(before, d); return json(res, 200, list[i]);
    }
    if (method === 'PATCH' && parts[0] === 'products') { // quick toggles from the product list
      const b = await readBody(req, 5e3);
      if ('inStock' in b) cur.inStock = !!b.inStock;
      if ('featured' in b) cur.featured = !!b.featured;
      cur.updatedAt = new Date().toISOString();
      saveDB(d); return json(res, 200, cur);
    }
    if (method === 'DELETE') {
      if (parts[0] === 'categories') {
        const n = d.products.filter(p => p.categoryId === cur.id).length;
        if (n) bad('This category still has ' + n + ' product' + (n > 1 ? 's' : '') + '. Move or delete them first.');
      }
      list.splice(i, 1); saveDB(d); cleanupUploads(imagesOf(cur), d); return json(res, 200, { ok: true });
    }
  }
  throw new HttpError(404, 'Not found.');
}

/* ------------------------------------------------------------------ server */
const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(String(req.url || '/').replace(/^\/{2,}/, '/'), 'http://localhost'); } catch (e) { return send(res, 400, 'Bad request'); }
  if (url.pathname.startsWith('/api/')) {
    try { await api(req, res, url.pathname.slice(4)); }
    catch (e) {
      const status = e.status || 500;
      if (status === 500) console.error(new Date().toISOString(), req.method, url.pathname, e);
      if (!res.headersSent) json(res, status, { error: status === 500 ? 'Something went wrong on the server. Please try again.' : e.message });
    }
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
  serveStatic(req, res, url.pathname);
});

/* tidy up images that were uploaded but never saved to anything (older than a day) */
function sweepUploads() {
  try {
    const json = JSON.stringify(readDB());
    fs.readdirSync(UPLOADS).forEach(f => {
      const full = path.join(UPLOADS, f), rel = 'assets/uploads/' + f;
      if (!json.includes('"' + rel + '"') && Date.now() - fs.statSync(full).mtimeMs > 24 * 3600e3) fs.unlinkSync(full);
    });
  } catch (e) { console.error('Upload sweep skipped:', e.message); }
}

build(readDB());
sweepUploads();
setInterval(sweepUploads, 6 * 3600e3).unref();
server.listen(PORT, () => {
  console.log('Skyrah Impex running on http://localhost:' + PORT + '  (admin: http://localhost:' + PORT + '/admin)');
  if (auth.isDefault) console.log('⚠  The admin password is still the default. Log in and change it under Account.');
});
