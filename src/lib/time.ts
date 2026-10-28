import type { Day, Flight, Stop, Trip } from '@/types/trip';

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-12-04T09:45:00+07:00" → "09:45" (wall-clock time where the event happens) */
export const localTime = (iso?: string) => (iso ? iso.slice(11, 16) : '');

/** "2026-12-04..." → "2026-12-04" */
export const localDate = (iso: string) => iso.slice(0, 10);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Calendar-safe parts for a YYYY-MM-DD string (no timezone shifting). */
export function dateParts(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, weekday: WEEKDAYS[wd], month: MONTHS[m - 1] };
}

export const shortDate = (ymd: string) => {
  const p = dateParts(ymd);
  return `${p.weekday}, ${p.d} ${p.month}`;
};

export function dateRange(a: string, b: string) {
  const pa = dateParts(a);
  const pb = dateParts(b);
  return pa.m === pb.m ? `${pa.d} – ${pb.d} ${pb.month} ${pb.y}` : `${pa.d} ${pa.month} – ${pb.d} ${pb.month} ${pb.y}`;
}

/** Today's YYYY-MM-DD in an IANA timezone. */
export function todayIn(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return parts.slice(0, 10);
}

export function clockIn(timeZone: string, now = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
}

export function durationLabel(ms: number) {
  const m = Math.max(0, Math.round(ms / 60000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const mm = m % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${pad(mm)}m`;
  return `${mm}m`;
}

export function daysUntil(ymd: string, now = new Date()) {
  const [y, m, d] = ymd.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 864e5);
}

export type TripPhase = 'upcoming' | 'active' | 'completed';

export function tripPhase(trip: Trip, now = new Date()): TripPhase {
  const today = todayIn(trip.timezone, now);
  if (today < trip.startDate) return 'upcoming';
  if (today > trip.endDate) return 'completed';
  return 'active';
}

function flightStop(f: Flight): Stop {
  return {
    id: `flight-${f.id}`,
    start: f.depart,
    end: f.arrive,
    title: `${f.airline} ${f.flightNo}`,
    titleLocal: `${f.from.code} → ${f.to.code}`,
    category: 'flight',
    notes: f.notes,
    ref: { type: 'flight', id: f.id },
  };
}

/** Day stops merged with generated flight + hotel check-in/out entries, sorted by time. */
export function stopsForDay(trip: Trip, day: Day): Stop[] {
  const extra: Stop[] = [];
  for (const f of trip.flights) if (localDate(f.depart) === day.date) extra.push(flightStop(f));
  for (const s of trip.stays) {
    if (localDate(s.checkIn) === day.date)
      extra.push({ id: `in-${s.id}`, start: s.checkIn, title: `Check in · ${s.name}`, titleLocal: s.addressLocal, category: 'stay', lat: s.lat, lng: s.lng, address: s.address, notes: s.notes, ref: { type: 'stay-in', id: s.id } });
    if (localDate(s.checkOut) === day.date)
      extra.push({ id: `out-${s.id}`, start: s.checkOut, title: `Check out · ${s.name}`, category: 'stay', lat: s.lat, lng: s.lng, ref: { type: 'stay-out', id: s.id } });
  }
  return [...day.stops, ...extra].sort((a, b) => (a.start && b.start ? Date.parse(a.start) - Date.parse(b.start) : a.start ? -1 : 1));
}

export interface NowNext {
  now?: Stop;
  next?: Stop;
  nextInMs?: number;
}

/** Finds the current and upcoming timeline entries across the whole trip. */
export function nowAndNext(trip: Trip, at = new Date()): NowNext {
  const t = at.getTime();
  const all = trip.days.flatMap((d) => stopsForDay(trip, d)).filter((s) => s.start);
  let now: Stop | undefined;
  let next: Stop | undefined;
  for (const s of all) {
    const start = Date.parse(s.start!);
    const end = s.end ? Date.parse(s.end) : start + 60 * 60000;
    if (start <= t && t < end) now = s;
    if (start > t && (!next || start < Date.parse(next.start!))) next = s;
  }
  return { now, next, nextInMs: next ? Date.parse(next.start!) - t : undefined };
}

export const flightDuration = (f: Flight) => durationLabel(Date.parse(f.arrive) - Date.parse(f.depart));

/** "2027-01-03" + "09:30" in a time zone → ISO string carrying that zone's UTC offset (the format the trip data uses). */
export function zonedIso(ymd: string, hhmm: string, timeZone: string) {
  const guess = Date.parse(`${ymd}T${hhmm}:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(guess));
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asLocal = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'));
  const offMin = Math.round((asLocal - guess) / 60000);
  const sign = offMin < 0 ? '-' : '+';
  const abs = Math.abs(offMin);
  return `${ymd}T${hhmm}:00${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}
