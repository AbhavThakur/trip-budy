-- Removes the test copy of the Vietnam trip created during QA on 2026-10-28
-- (join code E2R632, owned by an emulator session that no longer exists).
-- Run once in the Supabase SQL editor BEFORE sharing the trip from your real phone.
-- Cascades to all test expenses, settlements, checklist ticks, document rows and memberships.
delete from public.tb_trips where id = 'vietnam-2026';
