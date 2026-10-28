import NetInfo from '@react-native-community/netinfo';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { File } from 'expo-file-system';
import { AppState } from 'react-native';

import { localFile, remotePathFor } from '@/lib/files';
import { cloudConfigured, DOCS_BUCKET, ensureSession, supabase } from '@/lib/supabase';
import { useLedger } from '@/store/ledger';
import { useSession } from '@/store/session';
import { useTrips } from '@/store/trips';
import type { DocFile, Expense, LedgerTable } from '@/types/ledger';
import type { ID, Trip } from '@/types/trip';

/**
 * Offline-first sync.
 *  1. Every local edit is written to SQLite instantly and queued in the outbox.
 *  2. When online: upload pending files → flush outbox (upsert rows) → pull rows changed since our cursor.
 *  3. While the app is open, realtime pushes other phones' changes within ~1s.
 * Conflicts resolve per row by updatedAt (enforced server-side by the tb_rows_lww trigger).
 */

const TABLES: LedgerTable[] = ['expenses', 'settlements', 'checklist', 'docs'];
let running: Promise<void> | null = null;
let pendingRun = false;
const channels = new Map<ID, RealtimeChannel>();

const sharedTripIds = () => Object.keys(useSession.getState().joinCodes);

interface DbRow {
  trip_id: string;
  kind: LedgerTable;
  id: string;
  payload: Record<string, unknown>;
  updated_at: string;
  deleted: boolean;
  server_updated_at: string;
}

const fromDb = (r: DbRow) => ({ ...r.payload, id: r.id, tripId: r.trip_id, updatedAt: r.updated_at, deleted: r.deleted });

async function uploadPendingFiles() {
  const sb = supabase!;
  const ledger = useLedger.getState();
  const shared = new Set(sharedTripIds());
  const docs = Object.values(ledger.docs).filter((d) => shared.has(d.tripId) && !d.deleted && !d.remotePath);
  for (const d of docs) {
    const fileId = d.fileId ?? d.id;
    const shared = Object.values(useLedger.getState().docs).find((o) => (o.fileId ?? o.id) === fileId && o.remotePath);
    if (shared) {
      useLedger.getState().put('docs', { ...d, remotePath: shared.remotePath });
      continue;
    }
    const f = localFile(fileId, d.mime);
    if (!f.exists) continue;
    const path = remotePathFor(d.tripId, fileId, d.mime);
    const { error } = await sb.storage.from(DOCS_BUCKET).upload(path, await f.arrayBuffer(), { contentType: d.mime, upsert: true });
    if (error) throw error;
    useLedger.getState().put('docs', { ...d, remotePath: path });
  }
  const receipts = Object.values(ledger.expenses).filter((e) => shared.has(e.tripId) && !e.deleted && e.receiptPath?.startsWith('local:'));
  for (const e of receipts) {
    const f = localFile(`rcpt-${e.id}`, 'image/jpeg');
    if (!f.exists) continue;
    const path = remotePathFor(e.tripId, `rcpt-${e.id}`, 'image/jpeg');
    const { error } = await sb.storage.from(DOCS_BUCKET).upload(path, await f.arrayBuffer(), { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    useLedger.getState().put('expenses', { ...e, receiptPath: path });
  }
}

async function flushOutbox() {
  const sb = supabase!;
  const { outbox } = useLedger.getState();
  const shared = new Set(sharedTripIds());
  const batch = outbox.slice(0, 200);
  const rows: DbRow[] = [];
  const sent = [];
  for (const item of batch) {
    const row = useLedger.getState()[item.table][item.id] as unknown as { tripId: ID; updatedAt: string; deleted?: boolean } | undefined;
    if (!row || !shared.has(row.tripId)) continue;
    const { tripId, updatedAt, deleted, ...payload } = row as Record<string, unknown> & { tripId: ID; updatedAt: string };
    delete payload.id;
    rows.push({ trip_id: tripId, kind: item.table, id: item.id, payload, updated_at: updatedAt, deleted: Boolean(deleted), server_updated_at: '' });
    sent.push(item);
  }
  if (rows.length) {
    const { error } = await sb.from('tb_trip_rows').upsert(rows.map(({ server_updated_at: _s, ...r }) => r), { onConflict: 'trip_id,kind,id' });
    if (error) throw error;
    useLedger.getState().ack(sent);
  }
  if (outbox.length > batch.length) await flushOutbox();
}

async function pullTrip(tripId: ID) {
  const sb = supabase!;
  const cursor = useSession.getState().cursors[tripId] ?? '1970-01-01T00:00:00Z';
  const { data, error } = await sb
    .from('tb_trip_rows')
    .select('*')
    .eq('trip_id', tripId)
    .gt('server_updated_at', cursor)
    .order('server_updated_at', { ascending: true })
    .limit(1000);
  if (error) throw error;
  applyRows(data as DbRow[]);
  if (data?.length) useSession.getState().setCursor(tripId, (data[data.length - 1] as DbRow).server_updated_at);

  const meta = useTrips.getState().meta[tripId];
  const { data: tripRow, error: tErr } = await sb.from('tb_trips').select('data, version').eq('id', tripId).maybeSingle();
  if (tErr) throw tErr;
  if (!tripRow) return;
  if (meta?.dirty && tripRow.version === meta.version) {
    const { data: v, error: uErr } = await sb.rpc('tb_update_trip', { p_id: tripId, p_data: useTrips.getState().trips[tripId], p_version: meta.version });
    if (uErr) throw uErr;
    if (v !== -1) useTrips.getState().setTrip(useTrips.getState().trips[tripId], { source: 'cloud', version: v as number, dirty: false });
  } else if (!meta || tripRow.version > meta.version) {
    // Remote is newer. Local unsynced trip-document edits lose here (rare: travelers / itinerary edits).
    useTrips.getState().setTrip(tripRow.data as Trip, { source: 'cloud', version: tripRow.version, dirty: false });
  }
  if (data?.length === 1000) await pullTrip(tripId);
}

function applyRows(rows: DbRow[]) {
  const byTable: Record<LedgerTable, ReturnType<typeof fromDb>[]> = { expenses: [], settlements: [], checklist: [], docs: [] };
  for (const r of rows) if (TABLES.includes(r.kind)) byTable[r.kind].push(fromDb(r));
  for (const t of TABLES) useLedger.getState().applyRemote(t, byTable[t] as never);
}

async function downloadMissingFiles() {
  const sb = supabase!;
  const { docs, expenses } = useLedger.getState();
  const wanted: { id: string; mime: string; path: string }[] = [];
  for (const d of Object.values(docs) as DocFile[]) if (!d.deleted && d.remotePath) wanted.push({ id: d.fileId ?? d.id, mime: d.mime, path: d.remotePath });
  for (const e of Object.values(expenses) as Expense[])
    if (!e.deleted && e.receiptPath && !e.receiptPath.startsWith('local:')) wanted.push({ id: `rcpt-${e.id}`, mime: 'image/jpeg', path: e.receiptPath });
  for (const w of wanted) {
    const f = localFile(w.id, w.mime);
    if (f.exists) continue;
    const { data, error } = await sb.storage.from(DOCS_BUCKET).createSignedUrl(w.path, 300);
    if (error || !data) continue;
    await File.downloadFileAsync(data.signedUrl, f, { idempotent: true });
  }
}

function subscribe(tripId: ID) {
  if (!supabase || channels.has(tripId)) return;
  const ch = supabase
    .channel(`tb:${tripId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tb_trip_rows', filter: `trip_id=eq.${tripId}` }, (p) => {
      if (p.new && 'id' in p.new) {
        applyRows([p.new as DbRow]);
        void downloadMissingFiles().catch(() => undefined);
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tb_trips', filter: `id=eq.${tripId}` }, () => requestSync())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tb_trip_members', filter: `trip_id=eq.${tripId}` }, () => requestSync())
    .subscribe();
  channels.set(tripId, ch);
}

async function pullMembers(tripId: ID, userId: string | null) {
  const { data, error } = await supabase!.from('tb_trip_members').select('user_id, traveler_id, role, joined_at').eq('trip_id', tripId);
  if (error) throw error;
  useSession.getState().setMembers(
    tripId,
    (data ?? []).map((m) => ({ travelerId: m.traveler_id, joinedAt: m.joined_at, role: m.role, isMe: m.user_id === userId })),
  );
}

async function runOnce() {
  const session = useSession.getState();
  if (!cloudConfigured) return session.setSync({ status: 'local-only' });
  const net = await NetInfo.fetch();
  if (!net.isConnected) return session.setSync({ status: 'offline' });
  session.setSync({ status: 'syncing', error: undefined });
  try {
    if (!sharedTripIds().length) return session.setSync({ status: 'local-only', error: undefined });
    const userId = await ensureSession();
    await uploadPendingFiles();
    await flushOutbox();
    for (const id of sharedTripIds()) {
      await pullTrip(id);
      await pullMembers(id, userId);
      const mine = useSession.getState().members[id]?.find((m) => m.isMe);
      const me = useSession.getState().me[id];
      if (mine && me && mine.travelerId !== me) {
        await supabase!.from('tb_trip_members').update({ traveler_id: me }).eq('trip_id', id).eq('user_id', userId!);
        await pullMembers(id, userId);
      }
      subscribe(id);
    }
    await downloadMissingFiles();
    session.setSync({ status: 'synced', lastSyncAt: new Date().toISOString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    session.setSync({ status: /fetch|network/i.test(msg) ? 'offline' : 'error', error: msg });
  }
}

/** Debounced, single-flight sync trigger — safe to call after every edit. */
export function requestSync() {
  if (running) {
    pendingRun = true;
    return running;
  }
  running = (async () => {
    await new Promise((r) => setTimeout(r, 400));
    await runOnce();
  })().finally(() => {
    running = null;
    if (pendingRun) {
      pendingRun = false;
      void requestSync();
    }
  });
  return running;
}

/** Publishes a trip to the cloud and returns the 6-letter join code for the family. */
export async function shareTrip(tripId: ID): Promise<string> {
  if (!supabase) throw new Error('Cloud sync is not configured. Add the Supabase keys to .env and rebuild.');
  await ensureSession();
  const trip = useTrips.getState().trips[tripId];
  const me = useSession.getState().me[tripId] ?? null;
  const { data, error } = await supabase.rpc('tb_publish_trip', { p_id: tripId, p_data: trip, p_traveler: me });
  if (error) throw error;
  useSession.getState().setJoinCode(tripId, data as string);
  useTrips.getState().setTrip(trip, { source: 'cloud', version: useTrips.getState().meta[tripId]?.version || 1, dirty: false });
  // Queue everything recorded before sharing so it reaches the server.
  const l = useLedger.getState();
  for (const t of TABLES) for (const r of Object.values(l[t])) if (r.tripId === tripId && !l.outbox.some((o) => o.id === r.id)) l.put(t, r as never);
  await requestSync();
  return data as string;
}

export async function joinTrip(code: string, travelerId: ID | null): Promise<Trip> {
  if (!supabase) throw new Error('Cloud sync is not configured.');
  await ensureSession();
  const { data, error } = await supabase.rpc('tb_join_trip', { p_code: code, p_traveler: travelerId });
  if (error) throw error;
  const row = (data as { id: string; data: Trip; version: number; join_code: string }[])[0];
  useTrips.getState().setTrip(row.data, { source: 'cloud', version: row.version, dirty: false });
  useSession.getState().setJoinCode(row.id, row.join_code);
  useSession.getState().setCursor(row.id, '1970-01-01T00:00:00Z');
  await requestSync();
  return row.data;
}

/** Starts listeners: reconnect, foreground, and outbox changes all trigger a sync. */
export function startSync() {
  void requestSync();
  const unNet = NetInfo.addEventListener((s) => {
    if (s.isConnected) void requestSync();
    else useSession.getState().setSync({ status: cloudConfigured ? 'offline' : 'local-only' });
  });
  const app = AppState.addEventListener('change', (s) => s === 'active' && void requestSync());
  const unOutbox = useLedger.subscribe((s, prev) => {
    if (s.outbox.length > prev.outbox.length) void requestSync();
  });
  const unTrips = useTrips.subscribe((s, prev) => {
    if (s.meta !== prev.meta && Object.values(s.meta).some((m) => m.dirty && m.source === 'cloud')) void requestSync();
  });
  return () => {
    unNet();
    app.remove();
    unOutbox();
    unTrips();
    channels.forEach((c) => void supabase?.removeChannel(c));
    channels.clear();
  };
}

/** Changes who this phone belongs to; also updates the membership row so other phones see it. */
export async function setMyTraveler(tripId: ID, travelerId: ID) {
  useSession.getState().setMe(tripId, travelerId);
  if (!supabase || !useSession.getState().joinCodes[tripId]) return;
  try {
    const userId = await ensureSession();
    if (!userId) return;
    await supabase.from('tb_trip_members').update({ traveler_id: travelerId }).eq('trip_id', tripId).eq('user_id', userId);
    await pullMembers(tripId, userId);
  } catch {
    // offline — the next join/sync will carry it
  }
}
