import type { Day, EmergencyContact, Trip } from '../types/trip';

export interface Preset {
  key: string;
  label: string;
  flag: string;
  country: string;
  timezone: string;
  speechLocale: string;
  currency: { code: string; symbol: string; decimals: number; inrPerUnit: number };
  emergency: { kind: EmergencyContact['kind']; label: string; phone: string }[];
  accent: [string, string, string];
}

const E = (police: string, ambulance: string, extra: Preset['emergency'] = []): Preset['emergency'] => [
  { kind: 'police', label: 'Police', phone: police },
  { kind: 'ambulance', label: 'Ambulance', phone: ambulance },
  ...extra,
];

/** Approximate rates only — the Wallet refreshes them live whenever the phone is online. */
export const PRESETS: Preset[] = [
  { key: 'th', label: 'Thailand', flag: '🇹🇭', country: 'Thailand', timezone: 'Asia/Bangkok', speechLocale: 'th-TH', currency: { code: 'THB', symbol: '฿', decimals: 2, inrPerUnit: 2.6 }, emergency: E('191', '1669', [{ kind: 'other', label: 'Tourist police', phone: '1155' }]), accent: ['#1E3A8A', '#111827', '#60A5FA'] },
  { key: 'sg', label: 'Singapore', flag: '🇸🇬', country: 'Singapore', timezone: 'Asia/Singapore', speechLocale: 'en-SG', currency: { code: 'SGD', symbol: 'S$', decimals: 2, inrPerUnit: 65 }, emergency: E('999', '995'), accent: ['#7F1D1D', '#111827', '#FCA5A5'] },
  { key: 'ae', label: 'UAE (Dubai)', flag: '🇦🇪', country: 'United Arab Emirates', timezone: 'Asia/Dubai', speechLocale: 'ar-AE', currency: { code: 'AED', symbol: 'د.إ', decimals: 2, inrPerUnit: 23 }, emergency: E('999', '998'), accent: ['#14532D', '#111827', '#86EFAC'] },
  { key: 'id', label: 'Bali / Indonesia', flag: '🇮🇩', country: 'Indonesia', timezone: 'Asia/Makassar', speechLocale: 'id-ID', currency: { code: 'IDR', symbol: 'Rp', decimals: 0, inrPerUnit: 0.0053 }, emergency: E('110', '118', [{ kind: 'other', label: 'National emergency', phone: '112' }]), accent: ['#7C2D12', '#111827', '#FDBA74'] },
  { key: 'jp', label: 'Japan', flag: '🇯🇵', country: 'Japan', timezone: 'Asia/Tokyo', speechLocale: 'ja-JP', currency: { code: 'JPY', symbol: '¥', decimals: 0, inrPerUnit: 0.56 }, emergency: E('110', '119'), accent: ['#9F1239', '#111827', '#FDA4AF'] },
  { key: 'my', label: 'Malaysia', flag: '🇲🇾', country: 'Malaysia', timezone: 'Asia/Kuala_Lumpur', speechLocale: 'ms-MY', currency: { code: 'MYR', symbol: 'RM', decimals: 2, inrPerUnit: 19 }, emergency: E('999', '999'), accent: ['#1E1B4B', '#111827', '#A5B4FC'] },
  { key: 'lk', label: 'Sri Lanka', flag: '🇱🇰', country: 'Sri Lanka', timezone: 'Asia/Colombo', speechLocale: 'en-LK', currency: { code: 'LKR', symbol: 'Rs', decimals: 2, inrPerUnit: 0.28 }, emergency: E('119', '1990'), accent: ['#78350F', '#111827', '#FCD34D'] },
  { key: 'np', label: 'Nepal', flag: '🇳🇵', country: 'Nepal', timezone: 'Asia/Kathmandu', speechLocale: 'ne-NP', currency: { code: 'NPR', symbol: 'Rs', decimals: 2, inrPerUnit: 0.625 }, emergency: E('100', '102'), accent: ['#831843', '#111827', '#F9A8D4'] },
  { key: 'eu', label: 'Europe (€)', flag: '🇪🇺', country: 'Europe', timezone: 'Europe/Paris', speechLocale: 'fr-FR', currency: { code: 'EUR', symbol: '€', decimals: 2, inrPerUnit: 92 }, emergency: E('112', '112'), accent: ['#1E3A8A', '#111827', '#93C5FD'] },
  { key: 'uk', label: 'United Kingdom', flag: '🇬🇧', country: 'United Kingdom', timezone: 'Europe/London', speechLocale: 'en-GB', currency: { code: 'GBP', symbol: '£', decimals: 2, inrPerUnit: 108 }, emergency: E('999', '999'), accent: ['#1E293B', '#111827', '#CBD5E1'] },
  { key: 'us', label: 'USA', flag: '🇺🇸', country: 'United States', timezone: 'America/New_York', speechLocale: 'en-US', currency: { code: 'USD', symbol: '$', decimals: 2, inrPerUnit: 84 }, emergency: E('911', '911'), accent: ['#7F1D1D', '#111827', '#FCA5A5'] },
  { key: 'in', label: 'India (domestic)', flag: '🇮🇳', country: 'India', timezone: 'Asia/Kolkata', speechLocale: 'en-IN', currency: { code: 'INR', symbol: '₹', decimals: 2, inrPerUnit: 1 }, emergency: E('112', '108'), accent: ['#78350F', '#111827', '#FBBF24'] },
];

export interface NewTripInput {
  title: string;
  destination: string;
  preset: Preset;
  startDate: string;
  days: number;
  travelers: string[];
  homeTimezone?: string;
}

const PALETTE = ['#F59E0B', '#EC4899', '#10B981', '#8B5CF6', '#3B82F6', '#F97316', '#14B8A6', '#EF4444', '#84CC16', '#06B6D4'];
const EMBLEMS = ['★', '◆', '▲', '●', '✦', '❖'];

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);

export const addDays = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
export const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;
export const validTimezone = (tz: string) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export function validateNewTrip(i: NewTripInput): string | null {
  if (i.title.trim().length < 2) return 'Give the trip a name';
  if (!isYmd(i.startDate)) return 'Pick a start date';
  if (i.days < 1 || i.days > 60) return 'Trips can be 1–60 days';
  if (!i.travelers.some((t) => t.trim())) return 'Add at least one traveler';
  if (!validTimezone(i.preset.timezone)) return 'Unknown time zone';
  return null;
}

/** A ready-to-use empty trip: one day per date, the country's emergency numbers, and a starter checklist. */
export function buildTrip(i: NewTripInput, now = Date.now()): Trip {
  const err = validateNewTrip(i);
  if (err) throw new Error(err);
  const p = i.preset;
  const id = `${slugify(i.title) || 'trip'}-${i.startDate.slice(0, 4)}-${now.toString(36).slice(-4)}`;
  const names = i.travelers.map((t) => t.trim()).filter(Boolean);
  const used = new Set<string>();
  const travelers = names.map((name, k) => {
    let tid = slugify(name.split(' ')[0]) || `p${k + 1}`;
    while (used.has(tid)) tid += k;
    used.add(tid);
    return { id: tid, name, shortName: name.split(' ')[0], color: PALETTE[k % PALETTE.length], ...(k === 0 ? { tags: ['lead' as const], role: 'Trip lead' } : {}) };
  });
  const endDate = addDays(i.startDate, i.days - 1);
  const days: Day[] = Array.from({ length: i.days }, (_, k) => ({ index: k + 1, date: addDays(i.startDate, k), title: `Day ${k + 1}`, stops: [] }));
  const emblem = EMBLEMS[now % EMBLEMS.length];
  return {
    schemaVersion: 1,
    id,
    title: i.title.trim(),
    subtitle: i.destination.trim() || p.country,
    destination: i.destination.trim() || p.country,
    country: p.country,
    flag: p.flag,
    startDate: i.startDate,
    endDate,
    timezone: p.timezone,
    homeTimezone: i.homeTimezone ?? 'Asia/Kolkata',
    speechLocale: p.speechLocale,
    currency: { ...p.currency },
    cover: { from: p.accent[0], to: p.accent[1], accent: p.accent[2], emblem },
    travelers,
    flights: [],
    stays: [],
    transfers: [],
    days,
    phrases: [],
    emergency: p.emergency.map((e, k) => ({ id: `e-${k}`, kind: e.kind, label: e.label, phone: e.phone, status: 'verify' as const })),
    checklist: [
      {
        id: 'before',
        title: 'Before you go',
        items: [
          { id: 'b1', text: 'Passports valid 6+ months after return', perTraveler: true },
          { id: 'b2', text: 'Visa / entry permit sorted', perTraveler: true },
          { id: 'b3', text: 'Flights & hotels booked and saved in the Vault' },
          { id: 'b4', text: 'Travel insurance', perTraveler: true },
          { id: 'b5', text: 'Forex / cards / local cash' },
          { id: 'b6', text: 'eSIM or roaming pack' },
          { id: 'b7', text: 'Offline maps downloaded (Radar → cloud icon)' },
        ],
      },
      {
        id: 'pack',
        title: 'Packing',
        items: [
          { id: 'p1', text: 'Chargers, power bank (cabin bag) & adapter' },
          { id: 'p2', text: 'Medicines & first-aid', perTraveler: true },
          { id: 'p3', text: 'Weather-appropriate clothes & footwear', perTraveler: true },
        ],
      },
    ],
    docSlots: travelers.flatMap((t) => [
      { id: `passport-${t.id}`, kind: 'passport' as const, title: `Passport — ${t.shortName}`, travelerIds: [t.id], required: true },
      { id: `visa-${t.id}`, kind: 'visa' as const, title: `Visa — ${t.shortName}`, travelerIds: [t.id], required: false },
    ]),
    pois: [],
    budget: [],
    passes: [],
    offlineRegions: [],
    openQuestions: ['Add flights, hotels and day plans — import them from tickets with “Import trip JSON”, or add stops by hand.'],
  };
}

/** Light structural check for a pasted/imported trip document; fills optional arrays so the UI never crashes. */
export function normalizeImportedTrip(raw: unknown): { trip?: Trip; error?: string } {
  try {
    return normalizeUnsafe(raw);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not read that trip.' };
  }
}

function normalizeUnsafe(raw: unknown): { trip?: Trip; error?: string } {
  if (!raw || typeof raw !== 'object') return { error: 'That is not a JSON object.' };
  const t = raw as Record<string, unknown>;
  for (const k of ['id', 'title', 'startDate', 'endDate', 'timezone', 'currency', 'travelers', 'days'])
    if (t[k] == null) return { error: `Missing "${k}".` };
  if (!isYmd(String(t.startDate)) || !isYmd(String(t.endDate))) return { error: 'startDate / endDate must look like 2026-12-03.' };
  if (!Array.isArray(t.travelers) || !t.travelers.length) return { error: '"travelers" must list at least one person.' };
  if (!Array.isArray(t.days) || !t.days.length) return { error: '"days" must list at least one day.' };
  if (!validTimezone(String(t.timezone))) return { error: `Unknown time zone "${t.timezone}".` };
  const cur = t.currency as Record<string, unknown>;
  if (!cur || typeof cur.code !== 'string' || typeof cur.inrPerUnit !== 'number') return { error: '"currency" needs code, symbol, decimals and inrPerUnit.' };
  const ids = new Set<string>();
  (t.travelers as Record<string, unknown>[]).forEach((p, k) => {
    if (!p?.id || !p?.name) throw new Error('Every traveler needs an "id" and a "name".');
    p.shortName ??= String(p.name).split(' ')[0];
    p.color ??= PALETTE[k % PALETTE.length];
    ids.add(String(p.id));
  });
  for (const d of t.days as { index?: number; date?: string; title?: string; stops?: Record<string, unknown>[] }[]) {
    if (typeof d?.index !== 'number' || !d?.date || !isYmd(d.date)) throw new Error('Every day needs "index" and a valid "date".');
    d.title ??= `Day ${d.index}`;
    if (!Array.isArray(d.stops)) d.stops = [];
    for (const st of d.stops) {
      if (!st?.id || !st?.title) throw new Error(`A stop on day ${d.index} needs an "id" and a "title".`);
      st.category ??= 'activity';
    }
  }
  const arr = (k: string) => {
    if (t[k] != null && !Array.isArray(t[k])) throw new Error(`"${k}" must be a list.`);
    return (t[k] as Record<string, unknown>[] | undefined) ?? [];
  };
  for (const f of arr('flights')) {
    if (!f.id || !f.depart || !f.arrive || !(f.from as { code?: string })?.code || !(f.to as { code?: string })?.code) throw new Error('Every flight needs id, from.code, to.code, depart and arrive.');
    f.bookings ??= [];
    f.cabinKg ??= 7;
    f.checkinKg ??= 15;
    f.status ??= 'verify';
    for (const b of f.bookings as { travelerIds?: string[] }[]) for (const x of b.travelerIds ?? []) if (!ids.has(x)) throw new Error(`A flight booking mentions unknown traveler "${x}".`);
  }
  for (const h of arr('stays')) {
    if (!h.id || !h.name || !h.checkIn || !h.checkOut) throw new Error('Every stay needs id, name, checkIn and checkOut.');
    h.kind ??= 'hotel';
    h.rooms ??= [];
    h.address ??= '';
    h.city ??= '';
    h.lat ??= 0;
    h.lng ??= 0;
    h.status ??= 'verify';
  }
  for (const e of arr('emergency')) {
    e.status ??= 'verify';
    e.kind ??= 'other';
    e.id ??= `e-${String(e.label)}`;
  }
  const trip = {
    schemaVersion: 1,
    subtitle: '',
    destination: '',
    country: '',
    flag: '🧭',
    homeTimezone: 'Asia/Kolkata',
    speechLocale: 'en-IN',
    cover: { from: '#1E293B', to: '#111827', accent: '#F59E0B', emblem: '★' },
    flights: [],
    stays: [],
    transfers: [],
    phrases: [],
    emergency: [],
    checklist: [],
    docSlots: [],
    pois: [],
    budget: [],
    passes: [],
    offlineRegions: [],
    ...t,
  } as unknown as Trip;
  return { trip };
}
