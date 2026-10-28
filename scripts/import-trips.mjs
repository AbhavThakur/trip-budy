#!/usr/bin/env node
// Builds src/data/trips/*.json (typed Trip documents) from:
//   - scripts/seed/vietnam.core.mjs  (ticket-verified facts)
//   - scripts/seed/legacy/*.json (itinerary / phrases / checklists copied from the old web app)
// Usage: npm run import-trips
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vietnamCore, hotelRenames, extraPhrases } from './seed/vietnam.core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const legacyDir = path.resolve(root, 'scripts/seed/legacy');
const outDir = path.resolve(root, 'src/data/trips');
const readLegacy = (f) => JSON.parse(fs.readFileSync(path.join(legacyDir, f), 'utf8'));
const privatePath = path.join(root, 'scripts/seed/private.local.mjs');
const privateData = fs.existsSync(privatePath) ? (await import(privatePath)).privateData : {};

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

function to24h(t) {
  const m = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  const ap = m[3]?.toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

function parseRange(timeStr, date, offset) {
  if (!timeStr) return {};
  const parts = String(timeStr).split(/[–—-]/).map((p) => to24h(p)).filter(Boolean);
  if (!parts.length) return {};
  const iso = (hm) => `${date}T${hm}:00${offset}`;
  return { start: iso(parts[0]), end: parts[1] && parts[1] > parts[0] ? iso(parts[1]) : undefined };
}

function category(raw = '') {
  const c = raw.toLowerCase();
  if (/food|veg|dining|restaurant|cafe|meal/.test(c)) return 'food';
  if (/shop|market/.test(c)) return 'shopping';
  if (/transit|transport|flight|bus|cab|ferry/.test(c)) return 'transit';
  if (/hotel|stay/.test(c)) return 'stay';
  if (/activity|adventure|trek|cruise/.test(c)) return 'activity';
  return 'sight';
}

const rename = (s) => (typeof s === 'string' ? hotelRenames.reduce((acc, [re, to]) => acc.replace(re, to), s) : s);
const list = (v) => (v == null ? undefined : (Array.isArray(v) ? v : [v]).map((x) => rename(String(x))));
const transit = (v) => (v == null ? undefined : typeof v === 'string' ? rename(v) : rename([v.time, v.desc || v.mode].filter(Boolean).join(' · ')));

function checklistFrom(legacy, perTravelerIds = []) {
  return (legacy || []).map((sec, i) => ({
    id: `sec-${i + 1}`,
    title: rename(sec.phase || sec.title || `Checklist ${i + 1}`).replace(/^Phase \d+:\s*/, ''),
    items: (sec.items || []).map((it, j) => ({
      id: it.id || `sec-${i + 1}-${j + 1}`,
      text: rename(it.text || it.label || String(it)),
      detail: rename(it.desc || it.note) || undefined,
      perTraveler: perTravelerIds.includes(it.id) || undefined,
    })),
  }));
}

function phraseList(objs, group) {
  return objs.map((p, i) => ({
    id: `${group}-${i}-${slug(p.english || p.local || '')}`,
    group,
    local: p.vietnamese || p.local,
    phonetic: p.phonetic,
    english: p.english,
  }));
}

function buildVietnam() {
  const legacy = readLegacy('vietnam.json');
  const t = structuredClone(vietnamCore);
  const ICT = '+07:00';
  const stayForDate = (date) => t.stays.find((s) => s.checkIn.slice(0, 10) <= date && s.checkOut.slice(0, 10) > date)?.id;

  const days = [{
    index: 0, date: '2026-12-03', title: 'Departure day', subtitle: 'Bengaluru & Delhi → Kolkata → Hanoi',
    highlights: ['BLR group: 6E 676 at 19:15', 'Delhi group: 6E 6517 at 19:30', 'Meet at Kolkata, overnight 6E 1631 to Hanoi'], stops: [],
  }];

  for (const d of legacy.itinerary) {
    const date = new Date(`${d.date.replace(/^\w+, /, '')} 12:00 UTC`).toISOString().slice(0, 10);
    const stops = [];
    d.places.forEach((p, i) => {
      if (p.hotelKey) return; // replaced by generated stay events
      if (/Domestic Flight|Flight to Hanoi|Departure Home/i.test(p.name)) return; // replaced by flight events
      const tips = [];
      if (p.seniorTip) tips.push({ kind: 'senior', text: rename(p.seniorTip) });
      if (p.insiderTip) tips.push({ kind: 'insider', text: rename(p.insiderTip) });
      if (p.photoOp) tips.push({ kind: 'photo', text: rename(p.photoOp) });
      if (p.shoppingGem) tips.push({ kind: 'shopping', text: rename(p.shoppingGem) });
      stops.push({
        id: `d${d.day}-${i}-${slug(p.name)}`,
        ...parseRange(p.time, date, ICT),
        title: rename(p.name),
        titleLocal: p.vietnamese || undefined,
        category: category(p.category || p.type),
        lat: p.lat, lng: p.lng,
        address: rename(p.address) || undefined,
        notes: rename(p.notes) || undefined,
        tips: tips.length ? tips : undefined,
        transitToNext: transit(p.transitToNext),
      });
    });
    days.push({
      index: d.day, date, title: rename(d.title), subtitle: rename(d.subtitle), weather: d.weather,
      stayId: stayForDate(date),
      highlights: list(d.atAGlanceHighlights),
      stops,
    });
  }
  t.days = days;

  const vd = legacy.vegDining || {};
  const dietPhrases = phraseList([...(vd.vietnamesePhrases || []), ...(vd.phrases || [])], 'diet');
  const seen = new Set();
  t.phrases = [
    ...dietPhrases.filter((p) => {
      const k = p.local.toLowerCase().replace(/[.,!?\s]+/g, ' ').trim();
      return seen.has(k) ? false : seen.add(k);
    }),
    ...extraPhrases.map((p, i) => ({ id: `${p.group}-x${i}`, ...p })),
  ];

  t.checklist = checklistFrom(legacy.checklist, ['c1_1', 'c1_2']);

  t.pois = [
    ...(vd.restaurants || []).map((r, i) => ({
      id: `food-${i}-${slug(r.name)}`, name: r.name, category: 'food', city: r.city, address: r.address, note: [r.cuisine, r.note].filter(Boolean).join(' — '),
    })),
    ...(legacy.shopping || []).map((s, i) => ({
      id: `shop-${i}-${slug(s.category)}`, name: s.category, category: 'shopping', address: s.location, note: [s.items, s.price, s.rule].filter(Boolean).join(' · '),
    })),
  ];

  const tr = t.travelers;
  t.docSlots = [
    ...tr.map((p) => ({ id: `passport-${p.id}`, kind: 'passport', title: `Passport — ${p.shortName}`, travelerIds: [p.id], ref: 'PASSPORT-NO-PLACEHOLDER', required: true })),
    ...tr.map((p) => ({ id: `visa-${p.id}`, kind: 'visa', title: `Vietnam e-visa — ${p.shortName}`, travelerIds: [p.id], ref: 'EVISA-NO-PLACEHOLDER', required: true, note: 'Single entry · valid 03 Dec 2026 – 02 Mar 2027 · print a hard copy' })),
    ...tr.map((p) => ({ id: `ins-${p.id}`, kind: 'insurance', title: `Travel insurance — ${p.shortName}`, travelerIds: [p.id], ref: 'INSURANCE-PLACEHOLDER', required: true, note: 'Care Health · 04–10 Dec · USD 50,000' })),
    { id: 'tkt-ob5l6j', kind: 'flight', title: 'IndiGo BLR→CCU→HAN e-ticket', travelerIds: ['arjit', 'aanya', 'abhav'], ref: 'PNR OB5L6J', required: true, linkedId: 'f-6e676' },
    { id: 'tkt-gi2egr', kind: 'flight', title: 'IndiGo DEL→CCU→HAN e-ticket', travelerIds: ['sundeep', 'shikha'], ref: 'PNR GI2EGR', required: true, linkedId: 'f-6e6517' },
    { id: 'tkt-vietjet-dom', kind: 'flight', title: 'VietJet HAN⇄DAD e-itinerary', travelerIds: tr.map((p) => p.id), ref: 'PNR RVKAH8 / 8AR7WB', required: true, linkedId: 'f-vj527' },
    { id: 'tkt-58ftfj', kind: 'flight', title: 'VietJet HAN→DEL e-ticket', travelerIds: tr.map((p) => p.id), ref: 'PNR 58FTFJ', required: true, linkedId: 'f-vj971' },
    { id: 'tkt-z67lgs', kind: 'flight', title: 'Akasa DEL→BLR e-ticket', travelerIds: ['abhav', 'aanya', 'arjit'], ref: 'PNR Z67LGS', required: false, linkedId: 'f-qp1827' },
    { id: 'htl-delicate-1', kind: 'hotel', title: 'Delicate Hotel — Suite', travelerIds: ['sundeep', 'shikha'], ref: '6575.472.606', required: true, linkedId: 'delicate' },
    { id: 'htl-delicate-2', kind: 'hotel', title: 'Delicate Hotel — Deluxe Twin', travelerIds: ['arjit', 'aanya', 'abhav'], ref: '6155.457.223', required: true, linkedId: 'delicate' },
    { id: 'htl-urban-1', kind: 'hotel', title: 'Urban Alley — Premium Family', travelerIds: tr.map((p) => p.id), ref: 'Agoda 2052041833', required: true, linkedId: 'urban-alley' },
    { id: 'htl-urban-2', kind: 'hotel', title: 'Urban Alley — Superior Double', travelerIds: tr.map((p) => p.id), ref: 'Agoda 2052042959', required: true, linkedId: 'urban-alley' },
    ...(t.passes || []).filter((p) => p.buy === 'online' || p.buy === 'gate').map((p) => ({ id: `pass-${p.id}`, kind: 'activity', title: `Ticket — ${p.title}`, travelerIds: tr.map((x) => x.id), required: false, linkedId: p.id })),
    { id: 'act-cozybay', kind: 'activity', title: 'Cozy Bay Grand cruise receipt', travelerIds: tr.map((p) => p.id), ref: 'Klook NRJ724054', required: true, linkedId: 'cozy-bay' },
  ];
  applyPrivate(t);
  return t;
}

function applyPrivate(t) {
  const p = privateData[t.id];
  if (!p) return;
  for (const tr of t.travelers) Object.assign(tr, p.travelers?.[tr.id]);
  for (const slot of t.docSlots) {
    if (p.docRefs?.[slot.id]) slot.ref = p.docRefs[slot.id];
    const pass = slot.kind === 'passport' && p.travelers?.[slot.travelerIds[0]];
    if (pass?.passportNo) slot.ref = `${pass.passportNo} · expires ${pass.passportExpiry}`;
  }
}

function buildIndian({ file, id, title, subtitle, startDate, travelers, cover, emblem }) {
  const legacy = readLegacy(file);
  const IST = '+05:30';
  const days = legacy.itinerary.map((d, di) => {
    const date = new Date(Date.parse(`${startDate}T12:00:00Z`) + di * 864e5).toISOString().slice(0, 10);
    return {
      index: di + 1, date, title: d.title, subtitle: d.subtitle || d.highlight, weather: d.weather,
      highlights: list(d.atAGlanceHighlights),
      stops: (d.events || []).map((e, i) => ({
        id: `d${di + 1}-${i}-${slug(e.title || e.name || 'stop')}`,
        ...parseRange(e.time, date, IST),
        title: e.title || e.name,
        category: category(e.category),
        lat: e.coords?.[0], lng: e.coords?.[1],
        notes: e.desc || undefined,
        transitToNext: transit(e.transitToNext),
      })),
    };
  });
  const stays = Object.entries(legacy.stays || {}).map(([sid, s]) => ({
    id: sid, kind: 'hotel', name: s.name, city: s.city || '', address: s.address || '', addressLocal: s.addressVi || undefined,
    phone: s.phone, lat: s.coords?.[0] ?? 0, lng: s.coords?.[1] ?? 0,
    checkIn: `${days[0].date}T12:00:00${IST}`, checkOut: `${days[days.length - 1].date}T11:00:00${IST}`,
    rooms: [{ type: s.room || 'Room', guests: travelers.length, confirmation: s.pnr || s.voucher }], status: 'confirmed', notes: s.note,
  }));
  const em = legacy.emergencyContacts || [];
  const emergency = [
    { id: 'e-112', kind: 'police', label: 'Emergency (all services)', phone: '112', status: 'confirmed' },
    { id: 'e-108', kind: 'ambulance', label: 'Ambulance', phone: '108', status: 'confirmed' },
    ...(Array.isArray(em) ? em : []).map((c, i) => ({ id: `e-${i}`, kind: /hospital/i.test(c.name) ? 'hospital' : 'other', label: c.name, phone: String(c.phone).split('/')[0].trim(), note: c.info, status: 'confirmed' })),
    ...((legacy.emergency?.hospitals) || []).map((h, i) => ({ id: `e-h${i}`, kind: 'hospital', label: h.name, phone: h.phone, note: h.address, status: 'confirmed' })),
  ];
  return {
    schemaVersion: 1, id, title, subtitle, destination: legacy.destination, country: 'India', flag: '🇮🇳',
    startDate, endDate: days[days.length - 1].date, timezone: 'Asia/Kolkata', homeTimezone: 'Asia/Kolkata', speechLocale: 'kn-IN',
    currency: { code: 'INR', symbol: '₹', decimals: 2, inrPerUnit: 1 },
    cover: { ...cover, emblem },
    travelers, flights: [], stays, transfers: [], days, phrases: [], emergency,
    checklist: checklistFrom(legacy.checklist), docSlots: [], pois: [],
    budget: [{ id: 'b-total', category: 'other', label: 'Trip budget (legacy estimate)', amountInr: legacy.budget?.total || 0, status: 'estimate' }],
    offlineRegions: [],
  };
}

const pair = [
  { id: 'aanya', name: 'Aanya Jain', shortName: 'Aanya', color: '#8B5CF6' },
  { id: 'abhav', name: 'Abhav Thakur', shortName: 'Abhav', color: '#3B82F6', tags: ['lead'] },
];

const trips = [
  buildVietnam(),
  buildIndian({ file: 'hampi-2026.json', id: 'hampi-2026', title: 'Hampi', subtitle: 'Boulders, ruins & the Tungabhadra', startDate: '2026-10-02', travelers: pair, cover: { from: '#78350F', to: '#111827', accent: '#FBBF24' }, emblem: '◆' }),
  buildIndian({ file: 'chikmagalur.json', id: 'chikmagalur-2026', title: 'Chikmagalur', subtitle: 'Coffee estates & Mullayanagiri', startDate: '2026-09-12', travelers: pair, cover: { from: '#064E3B', to: '#111827', accent: '#34D399' }, emblem: '▲' }),
];

fs.mkdirSync(outDir, { recursive: true });
for (const t of trips) {
  fs.writeFileSync(path.join(outDir, `${t.id}.json`), JSON.stringify(t, null, 2) + '\n');
  const stops = t.days.reduce((n, d) => n + d.stops.length, 0);
  console.log(`✔ ${t.id}: ${t.days.length} days, ${stops} stops, ${t.flights.length} flights, ${t.stays.length} stays, ${t.phrases.length} phrases`);
}
