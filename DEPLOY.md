# Deploy Skyrah Impex on Vercel + Supabase

The website (HTML/CSS/JS) is served by **Vercel**. Everything you edit in the admin panel
(products, journal, FAQs, company details, enquiries, uploaded photos, admin password) is stored in **Supabase**.

## 1. Supabase (≈5 minutes)

1. Create a project at https://supabase.com → **New project**. Pick region **Mumbai (ap-south-1)** and save the database password.
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**. This creates the tables, locks them down (Row Level Security) and creates the public `uploads` photo bucket.
3. **Project Settings → API**. Copy:
   - **Project URL** → `SUPABASE_URL`
   - the **service_role** secret key (under "Legacy API keys", or the new `sb_secret_…` key) → `SUPABASE_SERVICE_ROLE_KEY`

   ⚠ This key has full access. Only put it in Vercel's environment variables. Never in website files, never on GitHub.

## 2. GitHub

Push this whole folder to a (private) GitHub repo. `.env` is already git-ignored.

## 3. Vercel

1. https://vercel.com → **Add New → Project** → import the repo.
2. Framework Preset: **Other**. Leave Build Command / Output Directory empty (`vercel.json` already sets them).
3. **Environment Variables** (add all, for Production):

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | Project URL from step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key from step 1 |
   | `ADMIN_PASSWORD` | the password you want for the admin (first login only — change it in the admin afterwards) |
   | `SITE_URL` | `https://www.skyrahimpex.com` (your live address; used in sitemap.xml / robots.txt) |

4. **Deploy**. Then open `https://YOUR-SITE/admin/`, sign in with `ADMIN_PASSWORD`, and use **Password & backup** to set your own password.
5. **Settings → Domains**: add `www.skyrahimpex.com` and follow the DNS instructions.

The first time anyone loads the site, the starter content (including Nutmeg Powder, Nutmeg Soap and the WhatsApp number 919025448350) is copied into Supabase automatically. From then on the admin panel is the source of truth.

## 4. After going live

- Check `https://YOUR-SITE/sitemap.xml` and `/robots.txt`, then submit the sitemap in Google Search Console.
- Place a test order on WhatsApp from a product page, and send a test message from the Contact page → it appears under **Enquiries** in the admin.
- Admin changes show on the public site within ~30 seconds (edge cache).

## Good to know

- **Supabase free projects pause after 1 week with no activity** — the shop would then show the built-in starter content and the admin would fail. Upgrade to Pro for a business site, or visit the site/admin regularly.
- **Vercel Hobby is for personal, non-commercial use.** A business website normally needs the Pro plan.
- Photos are resized in the browser before upload (4 MB limit per photo after resizing).
- Forgot the admin password: Supabase → SQL Editor → `delete from admin_auth;` then log in with `ADMIN_PASSWORD` from Vercel (set a new value there first and redeploy).
- Undo a bad edit: the last 30 saved versions are in the `site_db_history` table (copy a row's `data` back into `site_db` where `id = 1`).
- Run locally: copy `.env.example` to `.env`, fill it in, `node server.js`, open http://localhost:3000 (use a separate Supabase project for testing if you don't want to touch live data).
