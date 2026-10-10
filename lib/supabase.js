// Skyrah Impex — tiny Supabase client (PostgREST + Storage over fetch). No npm packages needed.
// Uses the SERVICE ROLE key, so it must only ever run on the server (Vercel function / local server).
'use strict';

const BUCKET = 'uploads';

function cfg() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) {
    const e = new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    e.status = 500; e.config = true; throw e;
  }
  return { url, key };
}

async function call(method, pathAndQuery, { body, headers, raw } = {}) {
  const { url, key } = cfg();
  const res = await fetch(url + pathAndQuery, {
    method,
    headers: Object.assign(key.startsWith('sb_') ? { apikey: key } : { apikey: key, Authorization: 'Bearer ' + key }, headers || {}),
    body
  });
  if (raw) return res;
  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch (e) { data = text; } }
  if (!res.ok) {
    const msg = (data && (data.message || data.error || data.msg)) || res.statusText;
    const e = new Error('Supabase ' + method + ' ' + pathAndQuery.split('?')[0] + ' failed: ' + msg);
    e.status = 500; e.supabase = data; throw e;
  }
  return data;
}

const J = { 'Content-Type': 'application/json' };
const enc = encodeURIComponent;

/* ---- database (PostgREST) ---- */
const db = {
  // rows = await db.select('enquiries', 'order=created_at.desc&limit=100')
  select: (table, query) => call('GET', '/rest/v1/' + table + (query ? '?' + query : '')),
  insert: (table, rows) => call('POST', '/rest/v1/' + table, { body: JSON.stringify(rows), headers: Object.assign({ Prefer: 'return=minimal' }, J) }),
  upsert: (table, rows) => call('POST', '/rest/v1/' + table, { body: JSON.stringify(rows), headers: Object.assign({ Prefer: 'resolution=merge-duplicates,return=minimal' }, J) }),
  update: (table, filter, patch) => call('PATCH', '/rest/v1/' + table + '?' + filter, { body: JSON.stringify(patch), headers: Object.assign({ Prefer: 'return=representation' }, J) }),
  remove: (table, filter) => call('DELETE', '/rest/v1/' + table + '?' + filter, { headers: { Prefer: 'return=minimal' } })
};

/* ---- storage (public bucket "uploads") ---- */
const storage = {
  publicUrl: name => cfg().url + '/storage/v1/object/public/' + BUCKET + '/' + name.split('/').map(enc).join('/'),
  isOurUrl: u => { try { return String(u).startsWith(cfg().url + '/storage/v1/object/public/' + BUCKET + '/'); } catch (e) { return false; } },
  nameFromUrl: u => String(u).slice((cfg().url + '/storage/v1/object/public/' + BUCKET + '/').length),
  upload: (name, buffer, contentType) => call('POST', '/storage/v1/object/' + BUCKET + '/' + name.split('/').map(enc).join('/'),
    { body: buffer, headers: { 'Content-Type': contentType, 'Cache-Control': 'max-age=31536000', 'x-upsert': 'false' } }),
  remove: names => names.length ? call('DELETE', '/storage/v1/object/' + BUCKET, { body: JSON.stringify({ prefixes: names }), headers: J }) : Promise.resolve(),
  list: () => call('POST', '/storage/v1/object/list/' + BUCKET, { body: JSON.stringify({ prefix: '', limit: 1000, sortBy: { column: 'created_at', order: 'asc' } }), headers: J })
};

module.exports = { db, storage, cfg };
