import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { balances, formatMoney, settleUp, toMinor } from '../src/lib/money.ts';
import { localTime, nowAndNext, stopsForDay, tripPhase } from '../src/lib/time.ts';

const vietnam = JSON.parse(readFileSync(new URL('../src/data/trips/vietnam-2026.json', import.meta.url), 'utf8'));
const decimalsFor = (c) => (c === 'VND' ? 0 : 2);

const exp = (o) => ({ tripId: 't', updatedAt: '2026-12-04T00:00:00Z', category: 'food', title: 'x', spentAt: '2026-12-04', ...o });

test('balances split VND expense equally and settle-up zeroes everyone', () => {
  const ids = ['a', 'b', 'c'];
  const expenses = [
    exp({ id: '1', amountMinor: 300000, currency: 'VND', inrPerUnit: 0.0034, paidBy: 'a', splitWith: ids }), // ₹1020
    exp({ id: '2', amountMinor: toMinor(600, { decimals: 2 }), currency: 'INR', inrPerUnit: 1, paidBy: 'b', splitWith: ['b', 'c'] }),
  ];
  const bals = balances(ids, expenses, [], decimalsFor);
  const sum = bals.reduce((n, b) => n + b.net, 0);
  assert.equal(sum, 0, 'net balances must sum to zero');
  const a = bals.find((b) => b.travelerId === 'a');
  assert.equal(a.paid, 102000);
  assert.equal(a.net, 102000 - 34000);

  const transfers = settleUp(bals);
  const settlements = transfers.map((t, i) => ({ id: `s${i}`, tripId: 't', updatedAt: '', from: t.from, to: t.to, amountInrMinor: t.amount, settledAt: '' }));
  const after = balances(ids, expenses, settlements, decimalsFor);
  assert.ok(after.every((b) => Math.abs(b.net) <= 50), JSON.stringify(after));
  assert.ok(transfers.length <= ids.length - 1);
});

test('deleted expenses are ignored and remainders are deterministic', () => {
  const ids = ['x', 'y', 'z'];
  const expenses = [
    exp({ id: '1', amountMinor: 100, currency: 'INR', inrPerUnit: 1, paidBy: 'x', splitWith: ids }),
    exp({ id: '2', amountMinor: 999999, currency: 'INR', inrPerUnit: 1, paidBy: 'y', splitWith: ids, deleted: true }),
  ];
  const bals = balances(ids, expenses, [], decimalsFor);
  assert.deepEqual(
    bals.map((b) => b.share),
    [34, 33, 33],
  );
});

test('formatMoney uses currency decimals and compact forms', () => {
  assert.equal(formatMoney(150000, { symbol: '₫', decimals: 0, code: 'VND' }), '₫150,000');
  assert.equal(formatMoney(1500000, { symbol: '₫', decimals: 0, code: 'VND' }, { compact: true }), '₫1.5M');
  assert.equal(formatMoney(74419, { symbol: '₹', decimals: 2, code: 'INR' }), '₹74,419');
});

test('vietnam timeline merges ticket flights and hotel check-ins in time order', () => {
  const day1 = vietnam.days.find((d) => d.index === 1);
  const stops = stopsForDay(vietnam, day1);
  const titles = stops.map((s) => `${localTime(s.start)} ${s.title}`);
  assert.ok(titles.some((t) => t.startsWith('09:45 VietJet Air VJ 527')), titles.join('\n'));
  assert.ok(titles.some((t) => t.startsWith('14:00 Check in · Delicate Hotel')), titles.join('\n'));
  const times = stops.filter((s) => s.start).map((s) => Date.parse(s.start));
  assert.deepEqual(times, [...times].sort((a, b) => a - b));
  assert.ok(!JSON.stringify(vietnam).includes('TMS Hotel'), 'legacy hotel names must be replaced');
});

test('departure day shows both outbound flights', () => {
  const day0 = vietnam.days.find((d) => d.index === 0);
  const flights = stopsForDay(vietnam, day0).filter((s) => s.category === 'flight').map((s) => s.title);
  assert.deepEqual(flights, ['IndiGo 6E 676', 'IndiGo 6E 6517']);
});

test('now & next across timezones', () => {
  // 2026-12-04 09:00 ICT = 02:00Z → next is VJ 527 at 09:45 ICT
  const nn = nowAndNext(vietnam, new Date('2026-12-04T02:00:00Z'));
  assert.equal(nn.next?.title, 'VietJet Air VJ 527');
  assert.equal(tripPhase(vietnam, new Date('2026-10-28T06:00:00Z')), 'upcoming');
  assert.equal(tripPhase(vietnam, new Date('2026-12-05T06:00:00Z')), 'active');
  assert.equal(tripPhase(vietnam, new Date('2026-12-11T06:00:00Z')), 'completed');
});

test('day tickets point at real days and have a ticket slot when one is needed', () => {
  const days = new Set(vietnam.days.map((d) => d.index));
  const slots = new Set(vietnam.docSlots.map((s) => s.id));
  assert.ok(vietnam.passes.length >= 5);
  for (const p of vietnam.passes) {
    assert.ok(days.has(p.dayIndex), `${p.id} day`);
    if (p.buy === 'online' || p.buy === 'gate') assert.ok(slots.has(`pass-${p.id}`), `${p.id} slot`);
  }
  assert.ok(vietnam.passes.some((p) => p.id === 'banahills' && p.bookAhead));
});

test('doc map covers every ticket file with existing slots', async () => {
  const { docMap } = await import('../scripts/seed/doc-map.mjs');
  const ids = vietnam.docSlots.map((s) => s.id);
  for (const { slots } of docMap['vietnam-2026'])
    for (const p of slots) assert.ok(ids.some((id) => (p.endsWith('*') ? id.startsWith(p.slice(0, -1)) : id === p)), p);
});

import { planReminders, wallTime } from '../src/lib/reminders.ts';
const allOn = { flights: true, hotels: true, tickets: true, prep: true, daily: true };

test('wallTime converts local wall clock in a zone to the right instant', () => {
  assert.equal(new Date(wallTime('2026-12-05', '07:30', 'Asia/Ho_Chi_Minh')).toISOString(), '2026-12-05T00:30:00.000Z');
  assert.equal(new Date(wallTime('2026-11-19', '11:00', 'Asia/Kolkata')).toISOString(), '2026-11-19T05:30:00.000Z');
});

test('reminders are personal, future-only and cover the key moments', () => {
  const now = Date.parse('2026-10-28T08:00:00Z');
  const abhav = planReminders({ trip: vietnam, me: 'abhav', now, enabled: allOn, done: () => false });
  const ids = abhav.map((r) => r.id);
  assert.ok(ids.includes('vietnam-2026:checkin:f-6e676'), 'Abhav gets BLR flight check-in');
  assert.ok(!ids.includes('vietnam-2026:checkin:f-6e6517'), 'not the Delhi flight');
  const checkin = abhav.find((r) => r.id === 'vietnam-2026:checkin:f-6e676');
  assert.equal(new Date(checkin.at).toISOString(), '2026-12-01T13:45:00.000Z', 'IndiGo opens 48h before 19:15 IST');
  assert.ok(ids.includes('vietnam-2026:pass:banahills:14'));
  assert.ok(ids.includes('vietnam-2026:daily:2'));
  assert.ok(ids.some((id) => id.startsWith('vietnam-2026:checkout:delicate')));
  assert.ok(abhav.every((r) => r.at > now));
  const times = abhav.map((r) => r.at);
  assert.deepEqual(times, [...times].sort((a, b) => a - b));

  const sundeep = planReminders({ trip: vietnam, me: 'sundeep', now, enabled: allOn, done: () => false }).map((r) => r.id);
  assert.ok(sundeep.includes('vietnam-2026:checkin:f-6e6517') && !sundeep.includes('vietnam-2026:checkin:f-6e676'));

  const booked = planReminders({ trip: vietnam, me: 'abhav', now, enabled: allOn, done: (k) => k === 'vietnam-2026:pass:banahills:' });
  assert.ok(!booked.some((r) => r.kind === 'tickets'), 'booked tickets stop nagging');
  const noDaily = planReminders({ trip: vietnam, me: 'abhav', now, enabled: { ...allOn, daily: false }, done: () => false });
  assert.ok(!noDaily.some((r) => r.kind === 'daily'));
});

import { mergeWithBundle } from '../src/lib/trip-merge.ts';

test('app-update content beats an old cloud copy, but traveler edits are kept', () => {
  let oldCloud = structuredClone(vietnam);
  delete oldCloud.passes;
  oldCloud.days = oldCloud.days.slice(0, 2);
  oldCloud.travelers = oldCloud.travelers.map((t) => (t.id === 'sundeep' ? { ...t, phone: '+91 98765 43210', passportNo: undefined } : t)).filter((t) => t.id !== 'arjit');
  oldCloud = JSON.parse(JSON.stringify(oldCloud)); // what the server actually stores
  const merged = mergeWithBundle(oldCloud, vietnam);
  assert.equal(merged.passes.length, vietnam.passes.length, 'new content from the app bundle');
  assert.equal(merged.days.length, vietnam.days.length);
  assert.equal(merged.travelers.length, 4, 'a traveler removed in the cloud stays removed');
  const s = merged.travelers.find((t) => t.id === 'sundeep');
  assert.equal(s.phone, '+91 98765 43210', 'edited phone is kept');
  assert.equal(s.passportNo, vietnam.travelers.find((t) => t.id === 'sundeep').passportNo, 'fields added by the app fill gaps');
  assert.equal(mergeWithBundle(oldCloud, undefined), oldCloud, 'non-bundled trips are taken as-is');
});

import { guessCategory } from '../src/lib/categorize.ts';
import { budgetMarkId, budgetTotals, resolveBudget } from '../src/lib/budget.ts';

test('expense titles are auto-categorised', () => {
  const cases = {
    'Grab to Ba Na Hills': 'transport',
    'Lunch at Sadhu Vegetarian': 'food',
    'Coconut coffee': 'food',
    'Cable car tickets': 'tours',
    'Silk shirt at the market': 'shopping',
    'Hotel extra bed': 'stays',
    'e-visa fee': 'visa',
    'Airport limousine transfer': 'transport',
    'Tip for guide': 'tours',
    'SIM card': 'other',
    'zzz': null,
  };
  for (const [title, cat] of Object.entries(cases)) assert.equal(guessCategory(title), cat, title);
});

test('planned & prepaid edits overlay the shipped budget without rewriting it', () => {
  const first = vietnam.budget.find((b) => b.status === 'due');
  const marks = {
    [budgetMarkId('vietnam-2026', first.id)]: { id: 'm1', tripId: 'vietnam-2026', itemId: `budget:${first.id}`, travelerId: '', done: false, updatedAt: 'x', status: 'paid', amountInr: 12345 },
    'vietnam-2026:budget:custom-a1:': { id: 'vietnam-2026:budget:custom-a1:', tripId: 'vietnam-2026', itemId: 'budget:custom-a1', travelerId: '', done: false, updatedAt: 'x', label: 'Travel pillow', category: 'shopping', amountInr: 800, status: 'due' },
    'vietnam-2026:budget:custom-gone:': { id: 'g', tripId: 'vietnam-2026', itemId: 'budget:custom-gone', travelerId: '', done: false, updatedAt: 'x', deleted: true, label: 'x', amountInr: 5 },
  };
  const before = budgetTotals(resolveBudget(vietnam, {}));
  const lines = resolveBudget(vietnam, marks);
  const edited = lines.find((l) => l.id === first.id);
  assert.equal(edited.status, 'paid');
  assert.equal(edited.amountInr, 12345);
  assert.ok(edited.edited);
  assert.equal(lines.length, vietnam.budget.length + 1, 'custom line added, deleted one ignored');
  assert.equal(lines.at(-1).label, 'Travel pillow');
  const after = budgetTotals(lines);
  assert.equal(after.total, before.total - first.amountInr + 12345 + 800);
  assert.ok(after.paid > before.paid);
  assert.equal(vietnam.budget.find((b) => b.id === first.id).status, 'due', 'shipped data untouched');
});

import { matchSlots } from '../src/lib/docmatch.ts';

test('ticket files are matched to the right vault slots from their names', () => {
  const m = (f) => matchSlots(f, vietnam.docSlots, vietnam.travelers);
  assert.deepEqual(m('Confirmation_for_Booking_ID_#_2052041833.pdf').slotIds, ['htl-urban-1']);
  assert.deepEqual(m('Confirmation_for_Booking_ID_#_2052042959.pdf').slotIds, ['htl-urban-2']);
  assert.deepEqual(m('Receipt_NRJ724054_20260928.pdf').slotIds, ['act-cozybay'], 'Klook order number');
  const visa = m('Vietnam Visa.pdf');
  assert.equal(visa.confidence, 'bundle');
  assert.equal(visa.slotIds.length, 10, '5 visas + the 5 insurance certificates that travel in the same PDF');
  assert.equal(visa.slotIds.filter((id) => id.startsWith('visa-')).length, 5);
  assert.deepEqual(m('Abhav passport scan.jpg').slotIds, ['passport-abhav']);
  assert.deepEqual(m('visa shikha.pdf').slotIds, ['visa-shikha']);
  assert.equal(m('Booking.com_ Confirmation.pdf').confidence, 'none', 'ambiguous hotel booking is left for the user to choose');
  assert.equal(m('IMG_2231.jpg').confidence, 'none');
  const taken = new Set(['visa-abhav']);
  assert.equal(matchSlots('Vietnam Visa.pdf', vietnam.docSlots, vietnam.travelers, taken).slotIds.length, 9, 'filled slots are not offered again');
});

import { buildTrip, normalizeImportedTrip, PRESETS, addDays } from '../src/lib/new-trip.ts';

test('a new trip is complete and usable straight away', () => {
  const preset = PRESETS.find((p) => p.key === 'th');
  const t = buildTrip({ title: 'Thailand Family Trip', destination: 'Bangkok & Phuket', preset, startDate: '2027-03-10', days: 5, travelers: ['Abhav Thakur', 'Aanya Jain', 'Arjit Jain', 'Aanya Rao'] }, 1700000000000);
  assert.equal(t.days.length, 5);
  assert.equal(t.endDate, '2027-03-14');
  assert.equal(t.days[4].date, '2027-03-14');
  assert.equal(t.travelers.length, 4);
  assert.equal(new Set(t.travelers.map((x) => x.id)).size, 4, 'duplicate first names still get unique ids');
  assert.ok(t.travelers[0].tags.includes('lead'));
  assert.equal(t.currency.code, 'THB');
  assert.ok(t.emergency.some((e) => e.phone === '191'));
  assert.ok(t.docSlots.some((s) => s.id === 'passport-abhav'));
  assert.match(t.id, /^thailand-family-trip-2027-/);
  assert.throws(() => buildTrip({ title: 'x', destination: '', preset, startDate: '2027-03-10', days: 5, travelers: ['A'] }), /name/);
  assert.throws(() => buildTrip({ title: 'Ok trip', destination: '', preset, startDate: '2027-02-30', days: 5, travelers: ['A'] }), /start date/);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('imported trip JSON is validated and defaulted', () => {
  const ok = normalizeImportedTrip({ id: 'x', title: 'T', startDate: '2027-01-01', endDate: '2027-01-02', timezone: 'Asia/Tokyo', currency: { code: 'JPY', symbol: '¥', decimals: 0, inrPerUnit: 0.56 }, travelers: [{ id: 'a', name: 'A' }], days: [{ index: 1, date: '2027-01-01' }] });
  assert.ok(ok.trip && Array.isArray(ok.trip.flights) && ok.trip.days[0].stops.length === 0);
  assert.match(normalizeImportedTrip({ id: 'x' }).error, /Missing/);
  assert.match(normalizeImportedTrip({ ...vietnam, timezone: 'Mars/Base' }).error, /time zone/);
  assert.match(normalizeImportedTrip({ ...vietnam, startDate: 'soon' }).error, /startDate/);
  const bad = structuredClone(vietnam); bad.flights[0].bookings[0].travelerIds.push('ghost');
  assert.match(normalizeImportedTrip(bad).error, /ghost/);
  assert.ok(normalizeImportedTrip(JSON.parse(JSON.stringify(vietnam))).trip, 'the shipped Vietnam trip is itself importable');
});

import { zonedIso } from '../src/lib/time.ts';
test('zonedIso carries the destination UTC offset', () => {
  assert.equal(zonedIso('2027-01-03', '09:30', 'Asia/Bangkok'), '2027-01-03T09:30:00+07:00');
  assert.equal(zonedIso('2027-01-03', '09:30', 'Asia/Kolkata'), '2027-01-03T09:30:00+05:30');
  assert.equal(zonedIso('2027-07-01', '09:30', 'Europe/London'), '2027-07-01T09:30:00+01:00');
  assert.equal(zonedIso('2027-01-03', '23:15', 'America/New_York'), '2027-01-03T23:15:00-05:00');
});
