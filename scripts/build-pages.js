'use strict';

const fs = require('fs');
const path = require('path');
const { render } = require('../lib/data');

const root = path.join(__dirname, '..');
const output = path.join(root, 'dist');
const publicDir = path.join(root, 'public');
const data = render(JSON.parse(fs.readFileSync(path.join(root, 'data', 'db.json'), 'utf8')));

fs.rmSync(output, { recursive: true, force: true });
fs.cpSync(publicDir, output, { recursive: true });
fs.rmSync(path.join(output, 'admin'), { recursive: true, force: true });
fs.writeFileSync(path.join(output, '.nojekyll'), '');

const assets = path.join(output, 'assets', 'js');
fs.writeFileSync(path.join(assets, 'products-data.js'), data.products);
fs.writeFileSync(path.join(assets, 'journal-data.js'), data.journal);

for (const name of fs.readdirSync(output)) {
  if (!name.endsWith('.html')) continue;
  const file = path.join(output, name);
  let html = fs.readFileSync(file, 'utf8');
  html = html.replaceAll('/api/data/products', 'assets/js/products-data.js');
  html = html.replaceAll('/api/data/journal', 'assets/js/journal-data.js');
  if (name === '404.html') html = html.replaceAll('="/assets/', '="assets/').replaceAll('="/index.html', '="index.html').replaceAll('="/shop.html', '="shop.html');
  fs.writeFileSync(file, html);
}
