-- CompTactic cloud plans schema.
-- Run this in the Supabase dashboard -> SQL Editor (once per project).

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Untitled plan',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plans_user_updated_idx
  on public.plans (user_id, updated_at desc);

-- Keep updated_at fresh on every update.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

-- Row level security: each user only sees and edits their own plans.
alter table public.plans enable row level security;

drop policy if exists "plans_select_own" on public.plans;
create policy "plans_select_own" on public.plans
  for select using (auth.uid() = user_id);

drop policy if exists "plans_insert_own" on public.plans;
create policy "plans_insert_own" on public.plans
  for insert with check (auth.uid() = user_id);

drop policy if exists "plans_update_own" on public.plans;
create policy "plans_update_own" on public.plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "plans_delete_own" on public.plans;
create policy "plans_delete_own" on public.plans
  for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Short share links: anyone can create a share and read one by id (like a paste).
-- ----------------------------------------------------------------------------
create table if not exists public.shares (
  id text primary key,
  data jsonb not null,
  created_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.shares enable row level security;

drop policy if exists "shares_read" on public.shares;
create policy "shares_read" on public.shares
  for select using (expires_at is null or expires_at > now());

drop policy if exists "shares_insert" on public.shares;
create policy "shares_insert" on public.shares
  for insert with check (auth.uid() is not null and created_by = auth.uid());

-- ----------------------------------------------------------------------------
-- Storage bucket for user-uploaded background images (public read).
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('plan-images', 'plan-images', true)
on conflict (id) do nothing;

drop policy if exists "plan_images_read" on storage.objects;
create policy "plan_images_read" on storage.objects
  for select using (bucket_id = 'plan-images');

drop policy if exists "plan_images_insert" on storage.objects;
create policy "plan_images_insert" on storage.objects
  for insert with check (bucket_id = 'plan-images' and auth.role() = 'authenticated');
