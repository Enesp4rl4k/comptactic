-- Keep room_versions small on Free tier (run after 003).
-- Retains the newest N saves per room; older rows are deleted automatically.

create or replace function public.trim_room_versions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  keep int := 12;
begin
  delete from public.room_versions rv
  where rv.room_id = new.room_id
    and rv.id not in (
      select id
      from public.room_versions
      where room_id = new.room_id
      order by created_at desc
      limit keep
    );
  return new;
end;
$$;

drop trigger if exists room_versions_trim on public.room_versions;
create trigger room_versions_trim
  after insert on public.room_versions
  for each row execute function public.trim_room_versions();
