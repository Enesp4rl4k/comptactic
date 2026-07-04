-- Append-only access log: one row each time a client joins a room.
-- Powers the Admin panel (who entered a room, when, from where) so a host can
-- spot if a private tactic is being shared/leaked beyond the intended group.
-- Run in Supabase SQL Editor after 003/004.

create table if not exists public.room_access_events (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  member_id text not null,                       -- ephemeral presence id (per browser tab)
  member_name text,                              -- display name shown in the session
  auth_user_id uuid references auth.users (id) on delete set null,
  auth_email text,                               -- email when signed in (null = guest)
  role text,                                     -- 'host' | 'editor' | 'viewer'
  is_host boolean not null default false,
  view_only boolean not null default false,      -- joined via a view-only link
  user_agent text,
  referrer text,                                 -- where the join link was opened from
  created_at timestamptz not null default now()
);

create index if not exists room_access_room_created_idx
  on public.room_access_events (room_id, created_at desc);
create index if not exists room_access_created_idx
  on public.room_access_events (created_at desc);

alter table public.room_access_events enable row level security;

-- Room id in the URL is the capability (same posture as rooms/room_versions):
-- any client in a session can append its own join event.
drop policy if exists "room_access_insert" on public.room_access_events;
create policy "room_access_insert" on public.room_access_events
  for insert with check (true);

-- Reads are open at the DB layer to match the existing model; the Admin panel
-- gates access in the UI with VITE_ADMIN_CODE. Tighten this policy if you later
-- add server-side room ownership.
drop policy if exists "room_access_select" on public.room_access_events;
create policy "room_access_select" on public.room_access_events
  for select using (true);
