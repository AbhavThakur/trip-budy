-- Trip Buddy — Supabase schema
-- Run once in the Supabase SQL editor (safe to re-run).
-- Prerequisite: Authentication → Sign In / Providers → enable "Anonymous sign-ins".
--
-- Security model
--   * Every phone signs in anonymously (no passwords to remember).
--   * Access to a trip requires membership in tb_trip_members.
--   * Membership is granted only by the join_trip() RPC with the trip's join code.
--   * Documents live in a PRIVATE bucket; files are read through short-lived signed URLs.
--   * Tables are prefixed tb_ so they never collide with the legacy public "trips" table.

-- gen_random_uuid() is built into Postgres 13+, no extension needed.

-- ───────────────────────────── tables ─────────────────────────────
create table if not exists public.tb_trips (
  id          text primary key,
  owner       uuid not null default auth.uid(),
  join_code   text not null unique,
  data        jsonb not null,
  version     integer not null default 1,
  updated_at  timestamptz not null default now()
);

create table if not exists public.tb_trip_members (
  trip_id     text not null references public.tb_trips(id) on delete cascade,
  user_id     uuid not null default auth.uid(),
  traveler_id text,
  role        text not null default 'member' check (role in ('owner', 'member')),
  joined_at   timestamptz not null default now(),
  primary key (trip_id, user_id)
);

-- One table for all row-level shared state (expenses, settlements, checklist ticks, documents).
-- Row-level storage means two phones adding expenses offline both survive the merge.
create table if not exists public.tb_trip_rows (
  trip_id           text not null references public.tb_trips(id) on delete cascade,
  kind              text not null check (kind in ('expenses', 'settlements', 'checklist', 'docs')),
  id                text not null,
  payload           jsonb not null,
  updated_at        timestamptz not null,
  deleted           boolean not null default false,
  server_updated_at timestamptz not null default now(),
  primary key (trip_id, kind, id)
);
create index if not exists tb_trip_rows_cursor on public.tb_trip_rows (trip_id, server_updated_at);

-- ───────────────────────────── helpers ─────────────────────────────
create or replace function public.tb_is_member(p_trip text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from tb_trip_members where trip_id = p_trip and user_id = auth.uid());
$$;

-- Last-writer-wins: an older offline edit can never overwrite a newer one.
create or replace function public.tb_rows_lww()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists tb_rows_lww on public.tb_trip_rows;
create trigger tb_rows_lww before insert or update on public.tb_trip_rows
  for each row execute function public.tb_rows_lww();

create or replace function public.tb_trips_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists tb_trips_touch on public.tb_trips;
create trigger tb_trips_touch before update on public.tb_trips
  for each row execute function public.tb_trips_touch();

-- ───────────────────────────── RPCs ─────────────────────────────
-- Publish a trip (first device) or return the existing join code (owner/member).
create or replace function public.tb_publish_trip(p_id text, p_data jsonb, p_traveler text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select join_code into v_code from tb_trips where id = p_id;
  if v_code is null then
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(x.b, i) % 32), 1), '')
      into v_code
      from (select decode(replace(gen_random_uuid()::text, '-', ''), 'hex') as b) x, generate_series(0, 5) as i;
    insert into tb_trips (id, owner, join_code, data) values (p_id, auth.uid(), v_code, p_data);
    insert into tb_trip_members (trip_id, user_id, traveler_id, role) values (p_id, auth.uid(), p_traveler, 'owner');
  elsif not tb_is_member(p_id) then
    raise exception 'trip id already used by another group';
  end if;
  return v_code;
end $$;

-- Join with a code; returns the trip document.
create or replace function public.tb_join_trip(p_code text, p_traveler text)
returns table (id text, data jsonb, version integer, join_code text)
language plpgsql security definer set search_path = public as $$
declare
  v_id text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select t.id into v_id from tb_trips t where t.join_code = upper(trim(p_code));
  if v_id is null then raise exception 'invalid join code'; end if;
  insert into tb_trip_members (trip_id, user_id, traveler_id) values (v_id, auth.uid(), p_traveler)
    on conflict (trip_id, user_id) do update set traveler_id = excluded.traveler_id;
  return query select t.id, t.data, t.version, t.join_code from tb_trips t where t.id = v_id;
end $$;

-- Optimistic-concurrency update of the trip document (itinerary, travelers…).
create or replace function public.tb_update_trip(p_id text, p_data jsonb, p_version integer)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_new integer;
begin
  if not tb_is_member(p_id) then raise exception 'not a member'; end if;
  update tb_trips set data = p_data, version = version + 1
    where id = p_id and version = p_version
    returning version into v_new;
  return coalesce(v_new, -1); -- -1 = conflict, client must pull first
end $$;

revoke all on function public.tb_publish_trip(text, jsonb, text) from public, anon;
revoke all on function public.tb_join_trip(text, text) from public, anon;
revoke all on function public.tb_update_trip(text, jsonb, integer) from public, anon;
grant execute on function public.tb_publish_trip(text, jsonb, text) to authenticated;
grant execute on function public.tb_join_trip(text, text) to authenticated;
grant execute on function public.tb_update_trip(text, jsonb, integer) to authenticated;

-- ───────────────────────────── RLS ─────────────────────────────
alter table public.tb_trips enable row level security;
alter table public.tb_trip_members enable row level security;
alter table public.tb_trip_rows enable row level security;

drop policy if exists tb_trips_read on public.tb_trips;
create policy tb_trips_read on public.tb_trips for select to authenticated using (tb_is_member(id));

drop policy if exists tb_trips_delete on public.tb_trips;
create policy tb_trips_delete on public.tb_trips for delete to authenticated using (owner = auth.uid());

drop policy if exists tb_members_read on public.tb_trip_members;
create policy tb_members_read on public.tb_trip_members for select to authenticated using (tb_is_member(trip_id));

drop policy if exists tb_members_self_update on public.tb_trip_members;
create policy tb_members_self_update on public.tb_trip_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists tb_members_self_leave on public.tb_trip_members;
create policy tb_members_self_leave on public.tb_trip_members for delete to authenticated using (user_id = auth.uid());

drop policy if exists tb_rows_rw on public.tb_trip_rows;
create policy tb_rows_rw on public.tb_trip_rows for all to authenticated
  using (tb_is_member(trip_id)) with check (tb_is_member(trip_id));

-- ───────────────────────────── realtime ─────────────────────────────
do $$
begin
  begin alter publication supabase_realtime add table public.tb_trip_rows; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.tb_trips; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.tb_trip_members; exception when duplicate_object then null; end;
end $$;

-- ───────────────────────────── private document storage ─────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('trip-docs', 'trip-docs', false, 26214400)
on conflict (id) do update set public = false;

-- Object paths are "<trip_id>/<file>", so the first folder decides access.
drop policy if exists tb_docs_read on storage.objects;
create policy tb_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'trip-docs' and public.tb_is_member((storage.foldername(name))[1]));

drop policy if exists tb_docs_write on storage.objects;
create policy tb_docs_write on storage.objects for insert to authenticated
  with check (bucket_id = 'trip-docs' and public.tb_is_member((storage.foldername(name))[1]));

drop policy if exists tb_docs_update on storage.objects;
create policy tb_docs_update on storage.objects for update to authenticated
  using (bucket_id = 'trip-docs' and public.tb_is_member((storage.foldername(name))[1]));

drop policy if exists tb_docs_delete on storage.objects;
create policy tb_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'trip-docs' and public.tb_is_member((storage.foldername(name))[1]));
