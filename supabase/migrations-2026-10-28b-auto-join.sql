-- Run once in the Supabase SQL editor (safe to re-run).
-- Zero-touch joining: a phone whose app already contains a trip joins it automatically using a
-- family key shipped inside the app (EXPO_PUBLIC_FAMILY_KEY). No 6-letter code needs to be typed.
--
-- The trip owner's phone registers the key by itself the first time it syncs after updating.
-- Security: the key is long and random; without it (or the 6-letter code) nobody can join, and
-- all data stays behind the membership RLS policies exactly as before.

alter table public.tb_trips add column if not exists family_key text;

create or replace function public.tb_set_family_key(p_id text, p_key text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if length(coalesce(p_key, '')) < 16 then raise exception 'key too short'; end if;
  update tb_trips set family_key = p_key
   where id = p_id
     and exists (select 1 from tb_trip_members m where m.trip_id = p_id and m.user_id = auth.uid() and m.role = 'owner');
end $$;

create or replace function public.tb_join_trip_by_id(p_trip_id text, p_key text, p_traveler text default null)
returns table (id text, data jsonb, version integer, join_code text)
language plpgsql security definer set search_path = public as $$
declare
  v_ok boolean;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select true into v_ok from tb_trips t
   where t.id = p_trip_id and t.family_key is not null and t.family_key = p_key;
  if v_ok is null then raise exception 'trip not shared yet'; end if;
  insert into tb_trip_members (trip_id, user_id, traveler_id) values (p_trip_id, auth.uid(), p_traveler)
    on conflict (trip_id, user_id) do nothing;
  return query select t.id, t.data, t.version, t.join_code from tb_trips t where t.id = p_trip_id;
end $$;

revoke all on function public.tb_set_family_key(text, text) from public, anon;
revoke all on function public.tb_join_trip_by_id(text, text, text) from public, anon;
grant execute on function public.tb_set_family_key(text, text) to authenticated;
grant execute on function public.tb_join_trip_by_id(text, text, text) to authenticated;
