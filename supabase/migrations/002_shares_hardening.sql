-- Tighten public share links: authenticated create, optional expiry.
-- Run in Supabase SQL Editor after schema.sql.

alter table public.shares
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists expires_at timestamptz;

drop policy if exists "shares_insert" on public.shares;
create policy "shares_insert" on public.shares
  for insert
  with check (auth.uid() is not null and created_by = auth.uid());

drop policy if exists "shares_read" on public.shares;
create policy "shares_read" on public.shares
  for select
  using (expires_at is null or expires_at > now());
