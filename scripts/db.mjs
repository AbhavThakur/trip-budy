#!/usr/bin/env node
// Run SQL against the Supabase project from the terminal (for migrations, QA queries, clean-up).
//   npm run db -- "select count(*) from tb_trips"
//   npm run db -- --file supabase/migrations-2026-10-28b-auto-join.sql
// Needs SUPABASE_ACCESS_TOKEN (a personal access token from https://supabase.com/dashboard/account/tokens) in
// .env.admin (gitignored). The project ref is read from EXPO_PUBLIC_SUPABASE_URL.
import fs from 'node:fs';

const args = process.argv.slice(2);
const fileIdx = args.indexOf('--file');
const sql = fileIdx >= 0 ? fs.readFileSync(args[fileIdx + 1], 'utf8') : args.join(' ');
const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').hostname.split('.')[0];
if (!sql.trim()) throw new Error('Usage: npm run db -- "<sql>"  |  npm run db -- --file path.sql');
if (!token) throw new Error('Missing SUPABASE_ACCESS_TOKEN — add it to .env.admin (see README → Database access).');

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
const body = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${body}`);
  process.exit(1);
}
try {
  const rows = JSON.parse(body);
  console.table(Array.isArray(rows) ? rows : [rows]);
} catch {
  console.log(body);
}
