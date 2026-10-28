-- Run once in the Supabase SQL editor (safe to re-run).
-- Lets phones see in real time when a family member joins or switches identity.
do $$
begin
  begin alter publication supabase_realtime add table public.tb_trip_members; exception when duplicate_object then null; end;
end $$;
