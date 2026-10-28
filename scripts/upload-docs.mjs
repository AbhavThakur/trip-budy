#!/usr/bin/env node
// Bulk-uploads ticket files into a shared trip's private vault, exactly as the app would.
// Usage: npm run upload-docs -- --code ABC123 [--dir ..] [--dry-run]
// Joins with the code (anonymous, no traveler), uploads each file once to the private bucket and
// creates one document row per slot, so every phone in the trip downloads it for offline use.
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { docMap } from './seed/doc-map.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] == null ? true : all[i + 1]] : null)).filter(Boolean));
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.resolve(root, args.dir ?? '..');
if (!args.code) throw new Error('Pass --code <trip join code>');

const mimeOf = (f) => (/\.pdf$/i.test(f) ? 'application/pdf' : /\.png$/i.test(f) ? 'image/png' : 'image/jpeg');
const extOf = (m) => (m === 'application/pdf' ? 'pdf' : m === 'image/png' ? 'png' : 'jpg');
const rid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

const sb = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { error: aErr } = await sb.auth.signInAnonymously();
if (aErr) throw aErr;
const { data: joined, error: jErr } = await sb.rpc('tb_join_trip', { p_code: String(args.code).toUpperCase(), p_traveler: null });
if (jErr) throw jErr;
const trip = joined[0];
const baseId = trip.id.replace(/-test$/, '');
const map = docMap[baseId];
if (!map) throw new Error(`No doc map for ${baseId}`);
console.log(`Trip ${trip.id} — ${map.length} files from ${dir}${args['dry-run'] ? ' (dry run)' : ''}\n`);

const { data: existing } = await sb.from('tb_trip_rows').select('id,payload,deleted').eq('trip_id', trip.id).eq('kind', 'docs');
const filled = new Set((existing ?? []).filter((r) => !r.deleted).map((r) => r.payload.slotId));
const slots = trip.data.docSlots;
let rows = 0;

for (const { file, slots: patterns } of map) {
  const full = path.join(dir, file);
  if (!fs.existsSync(full)) {
    console.log(`✘ missing  ${file}`);
    continue;
  }
  const targets = slots.filter((s) => patterns.some((p) => (p.endsWith('*') ? s.id.startsWith(p.slice(0, -1)) : s.id === p)) && !filled.has(s.id));
  if (!targets.length) {
    console.log(`• skip     ${file} (slots already filled)`);
    continue;
  }
  const mime = mimeOf(file);
  const bytes = fs.readFileSync(full);
  const fileId = rid('doc-');
  const remotePath = `${trip.id}/${fileId}.${extOf(mime)}`;
  if (!args['dry-run']) {
    const { error } = await sb.storage.from('trip-docs').upload(remotePath, bytes, { contentType: mime, upsert: true });
    if (error) throw new Error(`${file}: ${error.message}`);
    const now = new Date().toISOString();
    const { error: rErr } = await sb.from('tb_trip_rows').upsert(
      targets.map((s, i) => ({
        trip_id: trip.id,
        kind: 'docs',
        id: i === 0 ? fileId : rid('doc-'),
        updated_at: now,
        deleted: false,
        payload: { slotId: s.id, title: s.title, travelerIds: s.travelerIds, mime, size: bytes.length, remotePath, fileId, updatedBy: 'uploader' },
      })),
    );
    if (rErr) throw rErr;
  }
  rows += targets.length;
  console.log(`✔ uploaded ${file} (${(bytes.length / 1024).toFixed(0)} KB) → ${targets.map((s) => s.id).join(', ')}`);
}
console.log(`\n${rows} document slots filled. Phones download them on their next sync.`);
