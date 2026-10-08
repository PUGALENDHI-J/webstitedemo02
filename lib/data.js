// Skyrah Impex — turns data/db.json into the two browser files every page reads:
//   assets/js/products-data.js  (company details, categories, products, FAQs, testimonials + helpers)
//   assets/js/journal-data.js   (journal articles + helpers)
// Run directly (`node lib/data.js`) to rebuild by hand; the server rebuilds after every admin save.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
const lines = s => String(s || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);

/* Article body: plain text written in the admin.
   "## Heading", "> Quote", "- list item"; blank line = new paragraph. */
function parseBody(text) {
  const blocks = [];
  let para = [], list = null;
  const flushPara = () => { if (para.length) { blocks.push({ type: 'p', text: para.join(' ') }); para = []; } };
  const flushList = () => { if (list) { blocks.push({ type: 'ul', items: list }); list = null; } };
  for (const raw of String(text || '').split(/\r?\n/)) {
    const l = raw.trim();
    if (!l) { flushPara(); flushList(); continue; }
    if (/^##\s+/.test(l)) { flushPara(); flushList(); blocks.push({ type: 'h2', text: l.replace(/^##\s+/, '') }); }
    else if (/^>\s*/.test(l)) { flushPara(); flushList(); blocks.push({ type: 'quote', text: l.replace(/^>\s*/, '') }); }
    else if (/^[-*]\s+/.test(l)) { flushPara(); (list = list || []).push(l.replace(/^[-*]\s+/, '')); }
    else { flushList(); para.push(l); }
  }
  flushPara(); flushList();
  return blocks;
}

function publicSite(s) {
  const pick = ['legalName', 'brand', 'tagline', 'businessLine', 'director', 'directorTitle', 'phone1', 'phone2', 'whatsapp',
    'email', 'website', 'address', 'mapQuery', 'hours', 'fssai', 'gstin', 'iec', 'shippingNote'];
  const o = {};
  pick.forEach(k => { o[k] = String(s[k] || ''); });
  o.social = Object.assign({ instagram: '', facebook: '', youtube: '', linkedin: '' }, s.social || {});
  return o;
}

function writeIfChanged(file, content) {
  const full = path.join(ROOT, file);
  try { if (fs.readFileSync(full, 'utf8') === content) return; } catch (e) { /* new file */ }
  const tmp = full + '.tmp';
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, full);
}

exports.parseBody = parseBody;

exports.build = function (db) {
  const cats = [...db.categories].sort(byOrder);
  const catOf = id => cats.find(c => c.id === id);
  const products = [...db.products]
    .sort((a, b) => {
      const ca = cats.indexOf(catOf(a.categoryId)), cb = cats.indexOf(catOf(b.categoryId));
      return ca !== cb ? ca - cb : byOrder(a, b);
    })
    .map(p => ({
      slug: p.slug, name: p.name, cat: (catOf(p.categoryId) || {}).name || 'Other', catSlug: (catOf(p.categoryId) || {}).slug || '',
      desc: p.desc || '', long: p.long || p.desc || '', weight: p.weight || '', price: Number(p.price) || 0, mrp: Number(p.mrp) || 0,
      img: p.img, gallery: (p.gallery || []).filter(Boolean), tags: p.tags || [], inStock: p.inStock !== false,
      usage: lines(p.usage), storage: p.storage || '', ingredients: p.ingredients || '', shelfLife: p.shelfLife || '', origin: p.origin || ''
    }));
  const categories = cats.map(c => ({ name: c.name, slug: c.slug, description: c.description || '', img: c.img || 'assets/img/logo.png',
    count: products.filter(p => p.catSlug === c.slug).length }));
  const featured = products.filter(p => (db.products.find(x => x.slug === p.slug) || {}).featured).map(p => p.slug);
  const faqs = [...(db.faqs || [])].sort(byOrder).map(f => ({ cat: f.cat || 'General', q: f.q, a: f.a }));
  const testimonials = [...(db.testimonials || [])].sort(byOrder).map(t => ({ quote: t.quote, name: t.name, place: t.place || '', rating: Math.min(5, Math.max(0, Number(t.rating) || 0)) }));
  const site = publicSite(db.settings || {});
  const J = v => JSON.stringify(v, null, 2).replace(/</g, '\\u003c');

  writeIfChanged('assets/js/products-data.js', `/* Skyrah Impex — site data. AUTO-GENERATED from the admin panel (data/db.json). Do not edit by hand. */
const SITE = ${J(site)};
const WA_NUMBER = SITE.whatsapp;
const CATEGORIES = ${J(categories)};
const PRODUCTS = ${J(products)};
const FEATURED_SLUGS = ${J(featured)};
const FAQS = ${J(faqs)};
const TESTIMONIALS = ${J(testimonials)};

function escHtml(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; });
}
function formatINR(n){
  if(!n) return "Ask us";
  return "₹" + Number(n).toLocaleString("en-IN");
}
function mrpHtml(p){
  return (p.price && p.mrp > p.price) ? '<span class="strike">' + formatINR(p.mrp) + '</span>' : '';
}
function waLink(text){
  return "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(text);
}
function orderText(p, qty){
  return "Hi " + SITE.brand + ", I'd like to order " + (qty && qty > 1 ? qty + " × " : "") + p.name + (p.weight ? " (" + p.weight + ")" : "") + ".";
}
function productUrl(p){ return "product.html?slug=" + encodeURIComponent(p.slug); }
function shopCatUrl(name){ return "shop.html?cat=" + encodeURIComponent(name); }
function getProductBySlug(slug){
  return PRODUCTS.find(function(p){ return p.slug === slug; });
}
function resolveProductImage(p){
  return p.img || "assets/img/logo.png";
}
/* data-img / data-bg keys: a real file path (contains "/") is used as-is; a bare key is a product slug. */
function resolveImageKey(key){
  if(!key) return '';
  if(key.indexOf('/') !== -1) return key;
  const p = getProductBySlug(key);
  return p ? resolveProductImage(p) : '';
}
function telHref(n){ return "tel:" + String(n || '').replace(/[^0-9+]/g, ''); }
function siteValue(key){
  if(key === 'year') return String(new Date().getFullYear());
  if(key === 'phones') return [SITE.phone1, SITE.phone2].filter(Boolean).join(' · ');
  if(key === 'productCount') return String(PRODUCTS.length);
  if(key === 'categoryCount') return String(CATEGORIES.length);
  return SITE[key] == null ? '' : String(SITE[key]);
}
function siteHref(key){
  switch(key){
    case 'tel1': return SITE.phone1 ? telHref(SITE.phone1) : '';
    case 'tel2': return SITE.phone2 ? telHref(SITE.phone2) : '';
    case 'mailto': return SITE.email ? 'mailto:' + SITE.email : '';
    case 'website': return SITE.website ? (/^https?:/i.test(SITE.website) ? SITE.website : 'https://' + SITE.website) : '';
    case 'whatsapp': return waLink("Hi " + SITE.brand + ", I'd like to know more about your products.");
    case 'map': return SITE.mapQuery || SITE.address ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(SITE.mapQuery || SITE.address) : '';
  }
  return '';
}

/* Fill company details, footer links and WhatsApp links on every page from SITE */
function applySiteData(root){
  root = root || document;
  root.querySelectorAll('[data-site]').forEach(function(el){
    const v = siteValue(el.getAttribute('data-site'));
    el.textContent = v;
    const row = el.closest('[data-site-row]');
    if(row) row.hidden = !v;
  });
  root.querySelectorAll('[data-site-href]').forEach(function(el){
    const h = siteHref(el.getAttribute('data-site-href'));
    if(h) el.setAttribute('href', h);
    const row = el.closest('[data-site-row]');
    if(row && !h) row.hidden = true;
  });
  root.querySelectorAll('[data-social]').forEach(function(el){
    const url = (SITE.social || {})[el.getAttribute('data-social')];
    if(url){ el.href = url; el.target = '_blank'; el.rel = 'noopener'; el.hidden = false; }
    else el.hidden = true;
  });
  root.querySelectorAll('iframe[data-site-map]').forEach(function(f){
    const q = SITE.mapQuery || SITE.address;
    if(q) f.src = 'https://www.google.com/maps?q=' + encodeURIComponent(q) + '&output=embed';
  });
  root.querySelectorAll('[data-foot-cats]').forEach(function(el){
    el.innerHTML = CATEGORIES.map(function(c){ return '<a href="' + shopCatUrl(c.name) + '">' + escHtml(c.name) + '</a>'; }).join('');
  });
  root.querySelectorAll('a[href*="wa.me/"]').forEach(function(a){
    a.href = a.href.replace(/wa\\.me\\/\\d+/, 'wa.me/' + WA_NUMBER);
  });
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ applySiteData(); });
else applySiteData();
`);

  const articles = [...(db.articles || [])]
    .filter(a => a.published !== false)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map(a => ({ slug: a.slug, title: a.title, cat: a.cat || 'Journal', img: a.img || 'assets/img/logo.png', excerpt: a.excerpt || '',
      author: a.author || site.brand + ' Team', date: a.date, readTime: a.readTime || '', tags: a.tags || [], body: parseBody(a.body) }));

  writeIfChanged('assets/js/journal-data.js', `/* Skyrah Impex — journal articles. AUTO-GENERATED from the admin panel (data/db.json). Do not edit by hand. */
const ARTICLES = ${J(articles)};

function getArticleBySlug(slug){
  return ARTICLES.find(function(a){ return a.slug === slug; });
}
function formatArticleDate(iso){
  const d = new Date(String(iso) + "T00:00:00");
  return isNaN(d) ? '' : d.toLocaleDateString("en-IN", {day:"numeric", month:"long", year:"numeric"});
}
function articleUrl(a){ return "journal-post.html?post=" + encodeURIComponent(a.slug); }
`);
};

if (require.main === module) {
  exports.build(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/db.json'), 'utf8')));
  console.log('Rebuilt assets/js/products-data.js and assets/js/journal-data.js');
}
