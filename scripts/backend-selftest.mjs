// End-to-end check of supabase/schema.sql against the configured project.
// Creates a throwaway trip, verifies membership/RLS/LWW/storage, then deletes it.
// Usage: node --env-file=.env scripts/backend-selftest.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const mk = () => createClient(url, key, { auth: { persistSession: false } });
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('✔', m); };

const owner = mk(), member = mk(), stranger = mk();
for (const c of [owner, member, stranger]) { const { error } = await c.auth.signInAnonymously(); ok(!error, `anonymous sign-in ${error?.message ?? ''}`); }

const id = `selftest-${Date.now()}`;
const { data: code, error: pErr } = await owner.rpc('tb_publish_trip', { p_id: id, p_data: { id, title: 'Self test' }, p_traveler: 'a' });
ok(!pErr && /^[A-Z0-9]{6}$/.test(code), `publish returns join code ${pErr?.message ?? ''}`);

const { data: hidden } = await stranger.from('tb_trips').select('id').eq('id', id);
ok(hidden.length === 0, 'stranger cannot read the trip (RLS)');

const { data: joined, error: jErr } = await member.rpc('tb_join_trip', { p_code: code, p_traveler: 'b' });
ok(!jErr && joined[0].id === id, `member joins with code ${jErr?.message ?? ''}`);

const t1 = new Date().toISOString();
const row = { trip_id: id, kind: 'expenses', id: 'ex1', payload: { title: 'Grab', amountMinor: 250000 }, updated_at: t1, deleted: false };
ok(!(await owner.from('tb_trip_rows').upsert(row)).error, 'owner writes expense row');
const { data: seen } = await member.from('tb_trip_rows').select('payload').eq('trip_id', id);
ok(seen.length === 1 && seen[0].payload.title === 'Grab', 'member reads it');

await member.from('tb_trip_rows').upsert({ ...row, payload: { title: 'OLD offline edit' }, updated_at: '2020-01-01T00:00:00Z' });
const { data: lww } = await owner.from('tb_trip_rows').select('payload').eq('trip_id', id).single();
ok(lww.payload.title === 'Grab', 'older offline edit does not overwrite newer (LWW trigger)');

const sIns = await stranger.from('tb_trip_rows').upsert({ ...row, id: 'evil' });
ok(!!sIns.error, 'stranger cannot write rows');

const path = `${id}/doc.txt`;
ok(!(await owner.storage.from('trip-docs').upload(path, new Blob(['hello']), { upsert: true })).error, 'owner uploads to private bucket');
const signed = await member.storage.from('trip-docs').createSignedUrl(path, 60);
ok(!signed.error && (await (await fetch(signed.data.signedUrl)).text()) === 'hello', 'member downloads via signed URL');
const sDl = await stranger.storage.from('trip-docs').createSignedUrl(path, 60);
ok(!!sDl.error, 'stranger cannot access the file');
const pub = await fetch(`${url}/storage/v1/object/public/trip-docs/${path}`);
ok(pub.status >= 400, 'bucket is not public');

const { data: v } = await member.rpc('tb_update_trip', { p_id: id, p_data: { id, title: 'v2' }, p_version: 1 });
const { data: stale } = await owner.rpc('tb_update_trip', { p_id: id, p_data: { id, title: 'stale' }, p_version: 1 });
ok(v === 2 && stale === -1, 'trip document optimistic concurrency');

await owner.storage.from('trip-docs').remove([path]);
ok(!(await owner.from('tb_trips').delete().eq('id', id)).error, 'cleanup: owner deletes test trip');
console.log('\nBackend self-test passed.');
