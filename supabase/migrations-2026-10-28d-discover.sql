-- Run once (safe to re-run). Lets a phone ask "which trips has the family shared with this key?" so a trip created
-- later by the leader appears on every family phone automatically (no code, no app update).
-- Only trips whose owner chose "Appear automatically on family phones" (family_key set) are returned.
create or replace function public.tb_list_family_trips(p_key text)
returns table (id text, title text, join_code text)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if length(coalesce(p_key, '')) < 16 then return; end if;
  return query select t.id, coalesce(t.data->>'title', t.id), t.join_code from tb_trips t where t.family_key = p_key;
end $$;
revoke all on function public.tb_list_family_trips(text) from public, anon;
grant execute on function public.tb_list_family_trips(text) to authenticated;

-- owner can switch automatic discovery off for a trip (code-only sharing) by clearing the key
create or replace function public.tb_set_family_key(p_id text, p_key text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_key is not null and length(p_key) < 16 then raise exception 'key too short'; end if;
  update tb_trips set family_key = p_key
   where id = p_id
     and exists (select 1 from tb_trip_members m where m.trip_id = p_id and m.user_id = auth.uid() and m.role = 'owner');
end $$;
revoke all on function public.tb_set_family_key(text, text) from public, anon;
grant execute on function public.tb_set_family_key(text, text) to authenticated;
