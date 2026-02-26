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
drop policy if exists "public delete groups"  on groups;
drop policy if exists "public read members"   on members;
drop policy if exists "public insert members" on members;
drop policy if exists "public update members" on members;

create policy "public read groups"    on groups  for select using (true);
create policy "public insert groups"  on groups  for insert with check (true);
create policy "public update groups"  on groups  for update using (true);
create policy "public read members"   on members for select using (true);
create policy "public insert members" on members for insert with check (true);
create policy "public update members" on members for update using (true);
create policy "public delete members" on members for delete using (true);
create policy "public delete groups"  on groups  for delete using (true);

-- ── Migrations (safe to run on existing DB) ──
alter table groups  add column if not exists created_by       uuid references auth.users(id);
alter table members add column if not exists user_id          uuid references auth.users(id);
alter table groups  add column if not exists timezone         text default 'Asia/Riyadh';
alter table groups  add column if not exists last_reset_date  text default '';
alter table members add column if not exists email            text default '';

-- ── Push Subscriptions ────────────────────────
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz default now()
);
alter table push_subscriptions enable row level security;
drop policy if exists "users manage own subscriptions" on push_subscriptions;
create policy "users manage own subscriptions" on push_subscriptions
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Allow edge function to read all (via service role key)

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

-- ── Points system ──────────────────────────────────
alter table members add column if not exists total_points int not null default 0;

alter table members add column if not exists points_today int not null default 0;

-- ── FCM Tokens (Android push notifications) ──────────────────────────────────
create table if not exists fcm_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  token text not null,
  created_at timestamptz default now(),
  unique(user_id, group_id)
);
alter table fcm_tokens enable row level security;
drop policy if exists "users manage own fcm tokens" on fcm_tokens;
create policy "users manage own fcm tokens" on fcm_tokens
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Tasbeeh Goal & Daily Counter ─────────────────────────────────────────────
alter table groups  add column if not exists tasbeeh_goal   int  not null default 100;
alter table members add column if not exists tasbeeh_today  int  not null default 0;
-- Per-dhikr goals (e.g. {"سبحان الله": 33, "الحمد لله": 33})
alter table groups  add column if not exists tasbeeh_goals  jsonb not null default '{}';
-- Per-dhikr daily counts for each member
alter table members add column if not exists tasbeeh_counts jsonb not null default '{}';
