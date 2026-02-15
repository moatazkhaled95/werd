-- ================================================
-- وِرْدٌ — Supabase Database Setup
-- Run this in your Supabase SQL Editor
-- Safe to re-run (uses IF NOT EXISTS + DROP IF EXISTS for policies)
-- ================================================

-- ── Profiles ──────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name  text not null default '',
  email      text not null default '',
  gender     text not null default '',  -- 'male' | 'female'
  created_at timestamptz default now()
);

alter table profiles enable row level security;

drop policy if exists "users read own profile"   on profiles;
drop policy if exists "users insert own profile" on profiles;
drop policy if exists "users update own profile" on profiles;

create policy "users read own profile"   on profiles for select using (auth.uid() = id);
create policy "users insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "users update own profile" on profiles for update using (auth.uid() = id);

-- ── Groups ────────────────────────────────────
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  goal_amount int not null default 2,
  goal_unit text not null default 'page',   -- 'page' | 'hizb' | 'juz'
  privacy text not null default 'public',   -- 'public' | 'private'
  restriction text not null default 'all',  -- 'all' | 'men' | 'women'
  invite_code text unique default substr(md5(random()::text), 1, 8),
  created_at timestamptz default now()
);

-- ── Members ───────────────────────────────────
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  name text not null,
  gender text not null,   -- 'male' | 'female'
  pages_today int default 0,
  created_at timestamptz default now()
);

-- ── RLS ───────────────────────────────────────
alter table groups  enable row level security;
alter table members enable row level security;

drop policy if exists "public read groups"    on groups;
drop policy if exists "public insert groups"  on groups;
drop policy if exists "public update groups"  on groups;
drop policy if exists "public read members"   on members;
drop policy if exists "public insert members" on members;
drop policy if exists "public update members" on members;

create policy "public read groups"    on groups  for select using (true);
create policy "public insert groups"  on groups  for insert with check (true);
create policy "public update groups"  on groups  for update using (true);
create policy "public read members"   on members for select using (true);
create policy "public insert members" on members for insert with check (true);
create policy "public update members" on members for update using (true);

-- ── Migrations (safe to run on existing DB) ──
alter table groups  add column if not exists created_by uuid references auth.users(id);
alter table members add column if not exists user_id    uuid references auth.users(id);

-- ── Realtime ──────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'members'
  ) then
    alter publication supabase_realtime add table members;
  end if;
end $$;
