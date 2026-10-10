# Skyrah Impex Private Limited — website + admin panel

**From Indian Soil to Global Soul** · Import & Export · Pollachi, Tamil Nadu

Static website (`public/`) + serverless API (`api/`, `lib/`) on **Vercel**, with all content, enquiries and photos in **Supabase**.
**See `DEPLOY.md` for the step-by-step setup.**

| Folder | What it is |
|---|---|
| `public/` | The website and the admin panel (`public/admin/`) |
| `api/` | Vercel function entry (all `/api/*`, sitemap.xml, robots.txt) |
| `lib/` | API logic, validation, Supabase client, data-script generator |
| `data/db.json` | Starter content, loaded into Supabase on first run |
| `supabase/schema.sql` | Database + storage setup, run once |
| `server.js` | Local development server |

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

- The pages load their product/journal data from `/api/data/products` and `/api/data/journal`, generated live from Supabase and cached for 30 seconds.
- `/sitemap.xml` and `/robots.txt` are generated from the same data, so new products and articles appear in the sitemap automatically.
- Admin sign-in uses a signed 12-hour token; the password is stored hashed (scrypt) in Supabase. Login and contact-form attempts are rate limited.
- Uploaded photos go to the public Supabase Storage bucket `uploads`; photos no longer used are deleted automatically.
