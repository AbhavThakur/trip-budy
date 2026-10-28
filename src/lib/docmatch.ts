import type { DocSlot, Traveler } from '../types/trip';

export interface Match {
  slotIds: string[];
  /** exact = booking number found in the name · bundle = one file for several people · guess = from keywords · none */
  confidence: 'exact' | 'bundle' | 'guess' | 'none';
}

const digitsOf = (s: string) => s.match(/\d{6,}/g) ?? [];
const normalise = (s: string) => s.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[_\-.#()]+/g, ' ');

const KIND_WORDS: [DocSlot['kind'], RegExp][] = [
  ['visa', /\bvisa\b|evisa/],
  ['insurance', /insurance|policy|certificate|care health|tata/],
  ['passport', /passport/],
  ['flight', /e ?ticket|boarding|itinerary|flight|airline|indigo|vietjet|akasa|makemytrip|flipkart|cleartrip/],
  ['hotel', /booking com|booking id|confirmation|hotel|agoda|voucher|reservation/],
  ['activity', /receipt|klook|cruise|tour|ticket|pass\b/],
];

/** Suggests which vault slot(s) a file belongs to, from its file name only (no file contents are read). */
export function matchSlots(fileName: string, slots: DocSlot[], travelers: Traveler[], taken: Set<string> = new Set()): Match {
  const name = normalise(fileName);
  const open = slots.filter((s) => !taken.has(s.id));

  // 1. a booking / PNR / confirmation number in the file name
  const nums = new Set(digitsOf(name));
  if (nums.size) {
    const hit = open.filter((s) => digitsOf(`${s.ref ?? ''} ${s.title}`).some((d) => nums.has(d)));
    if (hit.length) return { slotIds: hit.map((s) => s.id), confidence: 'exact' };
  }

  // 2. who is it for?
  const named = travelers.filter((t) => [t.shortName, t.name.split(' ')[0]].some((w) => w.length > 2 && new RegExp(`\\b${w.toLowerCase()}\\b`).test(name)));

  // 3. what is it?
  const kinds = KIND_WORDS.filter(([, re]) => re.test(name)).map(([k]) => k);
  if (!kinds.length) return { slotIds: [], confidence: 'none' };
  const byKind = open.filter((s) => s.kind === kinds[0]);
  const forPeople = named.length ? byKind.filter((s) => s.travelerIds.some((t) => named.some((n) => n.id === t))) : byKind;
  if (!forPeople.length) return { slotIds: [], confidence: 'none' };
  // Travel-agency bundles (a "Visa" PDF from Atlys also holds the insurance certificates): when the name says
  // visa and nobody is named, offer the matching insurance slots too — the review screen lets the user untick.
  if (kinds[0] === 'visa' && !named.length) {
    const extra = open.filter((s) => s.kind === 'insurance' && s.travelerIds.length === 1);
    if (extra.length) return { slotIds: [...forPeople, ...extra].map((s) => s.id), confidence: 'bundle' };
  }
  if (forPeople.length === 1) return { slotIds: [forPeople[0].id], confidence: 'guess' };
  // one document per person (visa / insurance / passport): without a name it is a bundle for everyone
  const perPerson = forPeople.every((s) => s.travelerIds.length === 1);
  return perPerson ? { slotIds: forPeople.map((s) => s.id), confidence: 'bundle' } : { slotIds: [], confidence: 'none' };
}
