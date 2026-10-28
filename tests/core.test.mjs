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
