-- Live room metadata (policy, title) and append-only tactic versions per room.
-- Run in Supabase SQL Editor after schema.sql + 002.

create table if not exists public.rooms (
  id text primary key,
  title text not null default 'Untitled room',
  policy jsonb not null default '{}'::jsonb,
  policy_version bigint not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists rooms_updated_idx on public.rooms (updated_at desc);

create table if not exists public.room_versions (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms (id) on delete cascade,
  label text not null default 'Save',
  data jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create index if not exists room_versions_room_created_idx
  on public.room_versions (room_id, created_at desc);

drop trigger if exists rooms_set_updated_at on public.rooms;
create trigger rooms_set_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

alter table public.rooms enable row level security;
alter table public.room_versions enable row level security;

-- Room id in the URL is the capability; anyone in the session may read/write room state.
drop policy if exists "rooms_all" on public.rooms;
create policy "rooms_all" on public.rooms
  for all using (true) with check (true);

drop policy if exists "room_versions_select" on public.room_versions;
create policy "room_versions_select" on public.room_versions
  for select using (true);

drop policy if exists "room_versions_insert" on public.room_versions;
create policy "room_versions_insert" on public.room_versions
  for insert with check (true);
