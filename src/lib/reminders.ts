import type { ID, Trip } from '@/types/trip';

/**
 * Pure reminder planner (no React Native imports, unit-tested in tests/).
 * Produces the list of local notifications a phone should have scheduled for one trip.
 * The scheduler wipes and re-creates them whenever the trip, ledger or "who am I" changes.
 */

export type ReminderKind = 'prep' | 'tickets' | 'flights' | 'hotels' | 'daily';

export const REMINDER_KINDS: { kind: ReminderKind; label: string; detail: string }[] = [
  { kind: 'flights', label: 'Flights', detail: 'Web check-in opens · leave for the airport' },
  { kind: 'hotels', label: 'Hotels', detail: 'Check-out mornings — pack, safe, passports' },
  { kind: 'tickets', label: 'Day tickets', detail: 'Book-ahead tickets not yet booked' },
  { kind: 'prep', label: 'Before you fly', detail: '2 weeks, 1 week and the day before' },
  { kind: 'daily', label: 'Morning briefing', detail: '07:30 each trip day: today’s plan' },
];

export interface Reminder {
  id: string;
  kind: ReminderKind;
  at: number;
  title: string;
  body: string;
  /** deep link opened when the notification is tapped */
  url: string;
}

export interface PlanInput {
  trip: Trip;
  me?: ID;
  now: number;
  enabled: Record<ReminderKind, boolean>;
  /** checklist/pass marks: key → done */
  done: (key: string) => boolean;
  readinessPct?: number;
}

const HOUR = 3600e3;
const DAY = 24 * HOUR;
const INDIA = new Set(['BLR', 'DEL', 'CCU', 'BOM', 'MAA', 'HYD', 'COK', 'AMD', 'PNQ', 'GOI']);

/** UTC offset (minutes) of an IANA zone at a given instant, via Intl. */
export function offsetMinutes(timeZone: string, at: number) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(at));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
  return Math.round((asUtc - Math.floor(at / 60000) * 60000) / 60000);
}

/** Epoch ms for wall-clock "HH:MM" on YYYY-MM-DD in a time zone. */
export function wallTime(ymd: string, hm: string, timeZone: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  const [hh, mm] = hm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  return guess - offsetMinutes(timeZone, guess) * 60000;
}

const addDays = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const hhmm = (iso?: string) => (iso ? iso.slice(11, 16) : '');

export function planReminders({ trip, me, now, enabled, done, readinessPct }: PlanInput): Reminder[] {
  const out: Reminder[] = [];
  const url = `/trip/${trip.id}`;
  const add = (r: Omit<Reminder, 'url'> & { url?: string }) => {
    if (enabled[r.kind] && r.at > now + 60e3) out.push({ url, ...r });
  };
  const home = trip.homeTimezone;
  const passKey = (pid: string) => `${trip.id}:pass:${pid}:`;

  // Before you fly
  const left = readinessPct != null && readinessPct < 0.999 ? ` You're ${Math.round(readinessPct * 100)}% ready — open the checklist.` : '';
  add({ id: `${trip.id}:prep:14`, kind: 'prep', at: wallTime(addDays(trip.startDate, -14), '10:00', home), title: `${trip.flag} 2 weeks to ${trip.title}`, body: `Confirm bookings, eSIM and forex card.${left}`, url: `${url}/readiness` });
  const bag = Math.min(...trip.flights.filter((f) => f.status === 'confirmed' && f.checkinKg > 0).map((f) => f.checkinKg), Infinity);
  add({
    id: `${trip.id}:prep:7`,
    kind: 'prep',
    at: wallTime(addDays(trip.startDate, -7), '19:00', home),
    title: `${trip.flag} One week to go — packing check`,
    body: `${Number.isFinite(bag) ? `Pack to ${bag} kg checked + 7 kg cabin per person. ` : ''}Power banks in cabin only.${left}`,
    url: `${url}/readiness`,
  });
  add({
    id: `${trip.id}:prep:1`,
    kind: 'prep',
    at: wallTime(addDays(trip.startDate, -1), '18:00', home),
    title: `${trip.flag} Tomorrow you fly!`,
    body: trip.country === 'India' ? 'Charge phones, carry ID and keep tickets offline.' : 'Print hard copies of e-visas, carry passports, download offline maps in Radar, charge power banks.',
    url: `${url}/readiness`,
  });

  // Day tickets that must be booked ahead
  for (const p of trip.passes ?? []) {
    if (!p.bookAhead || done(passKey(p.id))) continue;
    for (const days of [14, 5])
      add({ id: `${trip.id}:pass:${p.id}:${days}`, kind: 'tickets', at: wallTime(addDays(trip.startDate, -days), '11:00', home), title: `🎟️ Book ${p.title}`, body: `Needed on Day ${p.dayIndex}. ${p.note ?? ''}`.trim(), url: `${url}/tickets` });
  }

  // Flights (only the ones this traveler is on, or all if unknown)
  for (const f of trip.flights) {
    if (f.status === 'placeholder') continue;
    if (me && !f.bookings.some((b) => b.travelerIds.includes(me))) continue;
    const dep = Date.parse(f.depart);
    const pnr = f.bookings.find((b) => !me || b.travelerIds.includes(me))?.pnr ?? f.bookings[0]?.pnr;
    const openH = f.airline.startsWith('IndiGo') ? 48 : 24;
    add({ id: `${trip.id}:checkin:${f.id}`, kind: 'flights', at: dep - openH * HOUR, title: `✈️ Web check-in open · ${f.flightNo}`, body: `${f.from.code} → ${f.to.code} at ${hhmm(f.depart)} · PNR ${pnr}. Check in now to sit together.`, url: `${url}/flights` });
    const intl = INDIA.has(f.from.code) !== INDIA.has(f.to.code) || Boolean(f.journey);
    const leadH = intl ? 3 : 2;
    add({
      id: `${trip.id}:leave:${f.id}`,
      kind: 'flights',
      at: dep - (leadH + 1) * HOUR,
      title: `🧳 Leave for ${f.from.code} airport within the hour`,
      body: `${f.flightNo} departs ${hhmm(f.depart)}${f.from.terminal ? ` from ${f.from.terminal}` : ''}. Be there ${leadH}h early · passports, ${intl ? 'printed e-visa, ' : ''}phone charged.`,
      url: `${url}/flights`,
    });
  }

  // Hotels
  for (const s of trip.stays) {
    if (s.status === 'placeholder') continue;
    if (me && s.rooms.every((r) => r.travelerIds && !r.travelerIds.includes(me))) continue;
    add({ id: `${trip.id}:checkout:${s.id}`, kind: 'hotels', at: Date.parse(s.checkOut) - 1.5 * HOUR, title: `🛎️ Check-out at ${hhmm(s.checkOut)} · ${s.name}`, body: 'Pack up, empty the room safe, collect passports and chargers.', url: `${url}/stays` });
  }

  // Morning briefing for each trip day
  for (const d of trip.days) {
    if (!d.stops.length) continue;
    const first = d.stops.find((s) => s.start);
    const passes = (trip.passes ?? []).filter((p) => p.dayIndex === d.index && p.buy !== 'free' && p.buy !== 'included');
    const body = [`${d.stops.length} stops${first ? ` · first ${hhmm(first.start)} ${first.title.split(' (')[0]}` : ''}.`, d.weather ? `${d.weather}.` : '', passes.length ? `Tickets: ${passes.map((p) => p.title.split(' (')[0]).join(', ')}.` : '']
      .filter(Boolean)
      .join(' ');
    add({ id: `${trip.id}:daily:${d.index}`, kind: 'daily', at: wallTime(d.date, '07:30', trip.timezone), title: `☀️ Day ${d.index}: ${d.title}`, body });
  }

  return out.sort((a, b) => a.at - b.at);
}
