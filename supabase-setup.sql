-- ================================================
-- وِرْدٌ — Supabase Database Setup
-- Run this once in your Supabase SQL Editor
-- ================================================

-- Groups table
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

-- Members table
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  name text not null,
  gender text not null,   -- 'male' | 'female'
  pages_today int default 0,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table groups enable row level security;
alter table members enable row level security;

-- Open policies (suitable for public app without auth)
create policy "public read groups"   on groups  for select using (true);
create policy "public insert groups" on groups  for insert with check (true);
create policy "public update groups" on groups  for update using (true);
create policy "public read members"  on members for select using (true);
create policy "public insert members" on members for insert with check (true);
create policy "public update members" on members for update using (true);

-- Enable realtime for members table
alter publication supabase_realtime add table members;
