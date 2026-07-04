-- Richer telemetry for the Admin panel: approximate location (from IP), device,
-- screen, locale and a persistent per-browser visitor id so the same person is
-- recognised across tabs/sessions. Run in Supabase SQL Editor after 005.

alter table public.room_access_events
  add column if not exists visitor_id text,          -- persistent per-browser id
  add column if not exists ip text,                  -- public IP (from IP lookup)
  add column if not exists country text,
  add column if not exists region text,
  add column if not exists city text,
  add column if not exists org text,                 -- ISP / network owner
  add column if not exists timezone text,
  add column if not exists languages text,
  add column if not exists screen text,              -- e.g. "1920x1080"
  add column if not exists viewport text,            -- e.g. "1280x720"
  add column if not exists device_pixel_ratio numeric,
  add column if not exists platform text,
  add column if not exists cpu_cores int,
  add column if not exists device_memory numeric,
  add column if not exists touch boolean,
  add column if not exists connection text,          -- effective network type
  add column if not exists landing_url text;         -- full URL the visitor opened

create index if not exists room_access_visitor_idx
  on public.room_access_events (visitor_id);
