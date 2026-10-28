-- Hardening found by auditing the live project on 2026-10-28 (safe to re-run).

-- 1) The old web app's table was readable AND writable/deletable by anyone holding the public key.
--    Keep it readable (the old PWA still works as a read-only backup) and allow writes only to the
--    keep-alive heartbeat row used by the GitHub workflow that stops the free project pausing.
drop policy if exists "Public trips full access" on public.trips;
drop policy if exists trips_public_read on public.trips;
drop policy if exists trips_heartbeat_write on public.trips;
create policy trips_public_read on public.trips for select to public using (true);
create policy trips_heartbeat_write on public.trips for all to public
  using (id = '_heartbeat') with check (id = '_heartbeat');

-- 2) Only signed-in users need the membership helper (RLS policies run as 'authenticated').
revoke execute on function public.tb_is_member(text) from public, anon;
grant execute on function public.tb_is_member(text) to authenticated;

-- 3) Re-joining with no traveler must never erase the identity a member already picked.
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
    on conflict (trip_id, user_id) do update
      set traveler_id = coalesce(excluded.traveler_id, tb_trip_members.traveler_id);
  return query select t.id, t.data, t.version, t.join_code from tb_trips t where t.id = v_id;
end $$;
revoke all on function public.tb_join_trip(text, text) from public, anon;
grant execute on function public.tb_join_trip(text, text) to authenticated;
