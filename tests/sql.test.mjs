// Runs supabase/schema.sql (with tiny stubs for Supabase-only pieces) on a real Postgres engine (PGlite)
// and exercises join-by-code, join-by-family-key, discovery, owner-only key registration and RLS isolation.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { PGlite } from '@electric-sql/pglite';

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';
const U3 = '33333333-3333-3333-3333-333333333333';

async function boot() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
    create table storage.objects (id serial primary key, bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
    create publication supabase_realtime;
  `);
  await db.exec(schema);
  await db.exec('grant usage on schema public, auth to authenticated; grant all on all tables in schema public to authenticated;');
  return db;
}
const as = async (db, uid, sql, params) => {
  await db.exec(`set test.uid = '${uid}'; set role authenticated;`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role;');
  }
};

test('family-key auto join: only the owner can register the key, only the right key joins', async () => {
  const db = await boot();
  const pub = await as(db, U1, `select tb_publish_trip('t1', '{"title":"x"}'::jsonb, 'abhav') as code`);
  assert.match(pub.rows[0].code, /^[A-Z2-9]{6}$/);

  const KEY = 'k'.repeat(32);
  // a non-owner's attempt to register a key silently does nothing, so the key stays unset and joining fails
  await as(db, U2, `select tb_set_family_key('t1', '${KEY}')`);
  await assert.rejects(as(db, U2, `select * from tb_join_trip_by_id('t1', '${KEY}')`), /not shared yet/, 'non-owner cannot register a key');

  await as(db, U1, `select tb_set_family_key('t1', '${KEY}')`);
  await assert.rejects(as(db, U2, `select * from tb_join_trip_by_id('t1', 'wrong-key-wrong-key-wrong-key-000')`), /not shared yet/);
  await assert.rejects(as(db, U2, `select * from tb_join_trip_by_id('nope', '${KEY}')`), /not shared yet/);

  const j = await as(db, U2, `select * from tb_join_trip_by_id('t1', '${KEY}', null)`);
  assert.equal(j.rows[0].id, 't1');
  assert.equal(j.rows[0].join_code, pub.rows[0].code);

  const members = await as(db, U2, `select user_id, role, traveler_id from tb_trip_members where trip_id = 't1' order by role`);
  assert.equal(members.rows.length, 2);

  // re-joining (by id or by code) must not clobber the identity the member already picked
  await as(db, U2, `update tb_trip_members set traveler_id = 'aanya' where trip_id = 't1' and user_id = '${U2}'`);
  await as(db, U2, `select * from tb_join_trip_by_id('t1', '${KEY}', 'someone-else')`);
  await as(db, U2, `select * from tb_join_trip('${pub.rows[0].code}', null)`);
  const after = await as(db, U2, `select traveler_id from tb_trip_members where trip_id = 't1' and user_id = '${U2}'`);
  assert.equal(after.rows[0].traveler_id, 'aanya');

  // outsiders still see nothing
  const seen = await as(db, U3, `select id from tb_trips`);
  assert.equal(seen.rows.length, 0);
  await assert.rejects(as(db, U3, `select * from tb_join_trip_by_id('t1', '${'z'.repeat(32)}')`), /not shared yet/);

  await assert.rejects(as(db, U1, `select tb_set_family_key('t1', 'short')`), /key too short/);
});

test('family phones discover trips the owner shared with the key — and only those', async () => {
  const db = await boot();
  const KEY = 'k'.repeat(32);
  await as(db, U1, `select tb_publish_trip('trip-a', '{"title":"Thailand"}'::jsonb, 'abhav')`);
  await as(db, U1, `select tb_publish_trip('trip-b', '{"title":"Friends weekend"}'::jsonb, 'abhav')`);
  await as(db, U1, `select tb_set_family_key('trip-a', '${KEY}')`); // trip-b stays code-only
  const list = await as(db, U2, `select * from tb_list_family_trips('${KEY}')`);
  assert.deepEqual(list.rows.map((r) => [r.id, r.title]), [['trip-a', 'Thailand']]);
  assert.equal((await as(db, U2, `select * from tb_list_family_trips('${'x'.repeat(32)}')`)).rows.length, 0, 'wrong key finds nothing');
  assert.equal((await as(db, U2, `select * from tb_list_family_trips('short')`)).rows.length, 0);
  // owner switches discovery off again
  await as(db, U1, `select tb_set_family_key('trip-a', null)`);
  assert.equal((await as(db, U2, `select * from tb_list_family_trips('${KEY}')`)).rows.length, 0);
  // a non-owner cannot touch the key
  await as(db, U1, `select tb_set_family_key('trip-a', '${KEY}')`);
  await as(db, U2, `select * from tb_join_trip_by_id('trip-a', '${KEY}', null)`);
  await as(db, U2, `select tb_set_family_key('trip-a', null)`);
  assert.equal((await as(db, U3, `select * from tb_list_family_trips('${KEY}')`)).rows.length, 1, 'a member could not clear the owner’s key');
});
