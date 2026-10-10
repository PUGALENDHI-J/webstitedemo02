// Skyrah Impex — input validation shared by the API (extracted from the original server).
'use strict';
const crypto = require('crypto');

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
const { storage } = require('./supabase');
function imgPath(v, label, required) {
  const s = String(v || '').trim();
  if (!s) { if (required) bad(label + ' is required — please upload an image.'); return ''; }
  if (s.includes('..')) bad(label + ' is not a valid image path.');
  if (IMG_RE.test(s)) return s;                       // photos that ship with the website
  if (storage.isOurUrl(s) && /\.(jpe?g|png|webp|gif)$/i.test(s)) return s; // photos uploaded from the admin (Supabase Storage)
  bad(label + ' is not a valid image — please upload it again.');
}
const tagList = v => (Array.isArray(v) ? v : String(v || '').split(','))
  .map(t => String(t).trim().toLowerCase()).filter(Boolean).filter((t, i, a) => a.indexOf(t) === i).slice(0, 20).map(t => t.slice(0, 40));
const nextOrder = list => list.reduce((m, x) => Math.max(m, Number(x.order) || 0), -1) + 1;
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;

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
  if (wa.length < 10 || wa.length > 15) bad('WhatsApp number: enter country code + number, e.g. 919025448350.');
  const email = str(b.email, 120, 'Email', true);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bad('Enter a valid email address.');
  const url = (v, label) => { const s = str(v, 300, label); if (s && !/^https:\/\/[^\s]+$/i.test(s)) bad(label + ' must be a full link starting with https://'); return s; };
  const social = b.social || {};
  return Object.assign({}, cur, {
    legalName: str(b.legalName, 120, 'Registered company name', true), brand: str(b.brand, 60, 'Brand name', true),
    tagline: str(b.tagline, 120, 'Tagline'), businessLine: str(b.businessLine, 80, 'Business line'),
    director: str(b.director, 80, 'Director name'), directorTitle: str(b.directorTitle, 60, 'Director title'),
    phone1: str(b.phone1, 30, 'Primary phone', true), phone2: '', whatsapp: wa, email,
    website: str(b.website, 120, 'Website'), address: str(b.address, 300, 'Address', true), mapQuery: str(b.mapQuery, 300, 'Map search text'),
    hours: str(b.hours, 120, 'Business hours'), fssai: str(b.fssai, 40, 'FSSAI number'), gstin: str(b.gstin, 30, 'GSTIN'), iec: str(b.iec, 30, 'IEC'),
    shippingNote: str(b.shippingNote, 1000, 'Shipping note'),
    social: { instagram: url(social.instagram, 'Instagram link'), facebook: url(social.facebook, 'Facebook link'),
      youtube: url(social.youtube, 'YouTube link'), linkedin: url(social.linkedin, 'LinkedIn link') }
  });
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


module.exports = { HttpError, bad, uid, slugify, uniqueSlug, str, num, tagList, nextOrder, imagesOf, COLLECTIONS,
  cleanSettings, cleanEnquiry, SUBJECTS };
