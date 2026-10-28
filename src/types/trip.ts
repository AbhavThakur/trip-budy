/**
 * Static trip content: authored data that ships with the app (src/data/trips/*.json)
 * and is synced as one versioned document (tb_trips.data). Shared, frequently-edited
 * state (expenses, checklist ticks, documents) lives in separate synced rows — see ledger.ts.
 *
 * All timestamps are ISO-8601 strings WITH the local UTC offset of where the event happens,
 * e.g. "2026-12-04T09:45:00+07:00". The local calendar date is therefore iso.slice(0, 10).
 */

export type ID = string;

/** Any field that still holds dummy/unconfirmed data must be flagged so the UI can warn. */
export type DataStatus = 'confirmed' | 'placeholder' | 'verify';

export interface Traveler {
  id: ID;
  name: string;
  shortName: string;
  color: string;
  role?: string;
  phone?: string;
  homeCity?: string;
  tags?: ('senior' | 'veg' | 'jain' | 'lead')[];
  /** private — only present when scripts/seed/private.local.mjs exists */
  passportNo?: string;
  passportExpiry?: string;
  dob?: string;
}

export interface Currency {
  code: string;
  symbol: string;
  /** digits after the decimal point that the currency actually uses (VND = 0, INR = 2) */
  decimals: number;
  /** fallback/offline conversion rate: how many INR one unit is worth */
  inrPerUnit: number;
}

export interface Airport {
  code: string;
  city: string;
  name?: string;
  terminal?: string;
}

export interface Booking {
  pnr: string;
  travelerIds: ID[];
  bookedVia?: string;
  bookingId?: string;
  eTickets?: Record<ID, string>;
}

export interface Flight {
  id: ID;
  airline: string;
  flightNo: string;
  from: Airport;
  to: Airport;
  depart: string;
  arrive: string;
  bookings: Booking[];
  cabinKg: number;
  checkinKg: number;
  status: DataStatus;
  /** groups legs of one connecting journey (e.g. BLR→CCU→HAN) */
  journey?: string;
  checkinUrl?: string;
  notes?: string;
}

export interface Room {
  type: string;
  guests: number;
  travelerIds?: ID[];
  confirmation?: string;
  priceLocal?: number;
}

export interface Stay {
  id: ID;
  kind: 'hotel' | 'cruise' | 'homestay';
  name: string;
  city: string;
  address: string;
  addressLocal?: string;
  phone?: string;
  lat: number;
  lng: number;
  checkIn: string;
  checkOut: string;
  rooms: Room[];
  bookedVia?: string;
  payment?: string;
  cancellation?: string;
  notes?: string;
  status: DataStatus;
}

export interface Transfer {
  id: ID;
  when?: string;
  label: string;
  route: string;
  vehicle?: string;
  costLocal?: number;
  notes?: string;
  status: DataStatus;
}

export type StopCategory = 'sight' | 'food' | 'shopping' | 'transit' | 'stay' | 'flight' | 'activity';

export interface Tip {
  kind: 'senior' | 'insider' | 'photo' | 'shopping';
  text: string;
}

export interface Stop {
  id: ID;
  start?: string;
  end?: string;
  title: string;
  titleLocal?: string;
  category: StopCategory;
  lat?: number;
  lng?: number;
  address?: string;
  notes?: string;
  tips?: Tip[];
  transitToNext?: string;
  /** set for timeline entries generated from flights / stays */
  ref?: { type: 'flight' | 'stay-in' | 'stay-out'; id: ID };
}

export interface Day {
  index: number;
  date: string;
  title: string;
  subtitle?: string;
  weather?: string;
  stayId?: ID;
  highlights?: string[];
  stops: Stop[];
}

export type PhraseGroup = 'diet' | 'taxi' | 'market' | 'help' | 'courtesy';

export interface Phrase {
  id: ID;
  group: PhraseGroup;
  local: string;
  phonetic?: string;
  english: string;
  /** optional bundled recording — preferred over TTS when present */
  audio?: string;
}

export interface EmergencyContact {
  id: ID;
  kind: 'police' | 'ambulance' | 'fire' | 'embassy' | 'hospital' | 'operator' | 'insurance' | 'other';
  label: string;
  phone: string;
  note?: string;
  status: DataStatus;
}

export interface ChecklistItem {
  id: ID;
  text: string;
  detail?: string;
  /** tick per traveler instead of once for the whole group */
  perTraveler?: boolean;
}

export interface ChecklistSection {
  id: ID;
  title: string;
  items: ChecklistItem[];
}

export type DocKind = 'passport' | 'visa' | 'flight' | 'hotel' | 'activity' | 'insurance' | 'other';

/** A document the trip expects. Files get attached to a slot at runtime (ledger DocFile). */
export interface DocSlot {
  id: ID;
  kind: DocKind;
  title: string;
  travelerIds: ID[];
  ref?: string;
  required: boolean;
  linkedId?: ID;
  note?: string;
}

export type PoiCategory = 'food' | 'shopping' | 'sight' | 'hospital' | 'stay';

export interface Poi {
  id: ID;
  name: string;
  category: PoiCategory;
  lat?: number;
  lng?: number;
  city?: string;
  address?: string;
  note?: string;
}

export interface BudgetLine {
  id: ID;
  category: ExpenseCategory;
  label: string;
  amountInr: number;
  status: 'paid' | 'due' | 'estimate' | 'placeholder';
  note?: string;
}

export type ExpenseCategory =
  | 'flights'
  | 'stays'
  | 'tours'
  | 'transport'
  | 'food'
  | 'shopping'
  | 'visa'
  | 'other';

/** An entry ticket / pass needed on a given day (e.g. Ba Na Hills cable car for the Golden Bridge). */
export interface Pass {
  id: ID;
  dayIndex: number;
  title: string;
  place: string;
  /** price per person in the trip currency (0 = free) */
  pricePerPerson?: number;
  priceNote?: string;
  buy: 'online' | 'gate' | 'included' | 'free';
  /** book before the trip (sells out / cheaper online) */
  bookAhead?: boolean;
  bookUrl?: string;
  note?: string;
  status: DataStatus;
}

export interface OfflineRegion {
  id: ID;
  name: string;
  /** [west, south, east, north] */
  bounds: [number, number, number, number];
}

export interface Trip {
  schemaVersion: 1;
  id: ID;
  title: string;
  subtitle: string;
  destination: string;
  country: string;
  flag: string;
  startDate: string;
  endDate: string;
  timezone: string;
  homeTimezone: string;
  speechLocale: string;
  currency: Currency;
  cover: { from: string; to: string; accent: string; emblem: string };
  travelers: Traveler[];
  flights: Flight[];
  stays: Stay[];
  transfers: Transfer[];
  days: Day[];
  phrases: Phrase[];
  emergency: EmergencyContact[];
  checklist: ChecklistSection[];
  docSlots: DocSlot[];
  pois: Poi[];
  budget: BudgetLine[];
  passes?: Pass[];
  offlineRegions: OfflineRegion[];
  /** human-readable list of things still unverified, surfaced on the readiness screen */
  openQuestions?: string[];
}
