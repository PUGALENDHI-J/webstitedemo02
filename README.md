# Skyrah Impex Private Limited — website + admin panel

**From Indian Soil to Global Soul** · Import & Export · Pollachi, Tamil Nadu

The website shows the Skyrah Impex range (whole spices, spice powders, fruit & vegetable
powders, dehydrated vegetables and herbal infusions). Customers order on WhatsApp or send
an enquiry from the Contact page. Everything is managed from the admin panel at `/admin`.

## Run it

Needs **Node.js 18 or newer**. There are no packages to install.

    node server.js

- Website: http://localhost:3000
- Admin:   http://localhost:3000/admin

Use another port with `PORT=8080 node server.js`.

### Admin password

- The first time the server starts, the admin password is **`skyrah@2026`**
  (or whatever you set in `ADMIN_PASSWORD` for that first start).
- Sign in and change it straight away under **Password & backup**. The dashboard
  shows a warning until you do.
- Forgot it? Stop the server and start it once with
  `RESET_ADMIN_PASSWORD=1 ADMIN_PASSWORD="new-password" node server.js`,
  then start it normally again.

## What the admin panel manages

| Section | What you can do |
|---|---|
| Dashboard | Counts, latest enquiries, website health checks, quick actions |
| Products | Add / edit / delete, main photo + up to 8 extra photos, price & MRP (empty price shows “Ask us”), pack size, how to use, storage, ingredients, shelf life, origin, search keywords, in-stock switch, feature on home page, reorder |
| Categories | Add / edit / delete (only when empty), photo for the home page cards, reorder |
| Journal | Write articles with headings, lists and quotes, cover photo, drafts / published |
| FAQs | Questions grouped by topic, reorder |
| Testimonials | Genuine customer reviews — the home page section appears only when there is at least one |
| Enquiries | Messages from the Contact page: new / read / replied, reply by email or WhatsApp, delete |
| Company details | Company name, director, phones, WhatsApp number, email, website, address, map, FSSAI / GSTIN / IEC, shipping note, social links — used across every page |
| Password & backup | Change password (signs out other devices), download a full backup |

Photos are resized in the browser before upload (max 1600 px). Portrait 3:4 photos fit the
product cards best.

## How it works

- `data/db.json` — all content (products, categories, articles, FAQs, reviews, company details).
- `data/enquiries.json` — contact form messages. `data/auth.json` — hashed admin password.
- `data/backups/` — a copy of `db.json` is kept before every save (last 30).
- Every save rebuilds `assets/js/products-data.js` and `assets/js/journal-data.js`, which the
  pages read. You can rebuild by hand with `node lib/data.js`.
- Uploaded photos go to `assets/uploads/`; photos that are no longer used are removed automatically.
- The server never serves `data/`, `lib/`, `server.js` or other private files.

## Hosting

Host it anywhere that runs Node.js (a VPS, Render, Railway, Hostinger Node hosting, etc.)
with a **persistent disk**, because the admin panel saves to the `data/` and `assets/uploads/`
folders. Back up those two folders (or use *Download backup* in the admin).

On plain static hosting the website still displays from the generated files, but the admin
panel and the contact form will not work there (the form then offers to send the message on
WhatsApp instead).
