-- Skyrah Impex — Supabase setup. Run this ONCE: Supabase dashboard → SQL Editor → New query → paste → Run.

-- 1) website content (products, categories, journal, FAQs, reviews, company details) as one document
create table if not exists public.site_db (
  id          int primary key check (id = 1),
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

-- 2) last 30 saved versions (undo for mistakes)
create table if not exists public.site_db_history (
  id        bigint generated always as identity primary key,
  data      jsonb not null,
  saved_at  timestamptz not null default now()
);

-- 3) messages from the Contact page
create table if not exists public.enquiries (
  id          text primary key,
  created_at  timestamptz not null default now(),
  status      text not null default 'new' check (status in ('new','read','replied')),
  name        text not null,
  phone       text not null,
  email       text not null,
  subject     text not null,
  message     text not null,
  product     text
);
create index if not exists enquiries_created_idx on public.enquiries (created_at desc);

-- 4) admin password (hashed) + session secret
create table if not exists public.admin_auth (
  id          int primary key check (id = 1),
  salt        text not null,
  hash        text not null,
  secret      text not null,
  is_default  boolean not null default false
);

-- 5) login / contact-form rate limiting
create table if not exists public.rate_limits (
  id   bigint generated always as identity primary key,
  key  text not null,
  at   timestamptz not null default now()
);
create index if not exists rate_limits_key_idx on public.rate_limits (key, at desc);

-- Security: switch on Row Level Security with NO public policies.
-- The website never talks to these tables from the browser; only the server (service_role key) can read/write them.
alter table public.site_db         enable row level security;
alter table public.site_db_history enable row level security;
alter table public.enquiries       enable row level security;
alter table public.admin_auth      enable row level security;
alter table public.rate_limits     enable row level security;

-- 6) public bucket for photos uploaded from the admin panel (anyone may VIEW; only the server can upload/delete)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads', 'uploads', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];
