import type { ExpenseCategory } from '../types/trip';

/** Order matters: the first matching rule wins (e.g. "Grab to Ba Na Hills" is a cab, not a tour). */
const RULES: [ExpenseCategory, RegExp][] = [
  ['visa', /\b(visa|e-?visa|immigration)\b/i],
  ['flights', /\b(flight|airline|indigo|vietjet|vietnam airlines|akasa|baggage|luggage fee|airport tax|seat selection|boarding)\b/i],
  ['stays', /\b(hotel|room|hostel|resort|homestay|airbnb|agoda|booking\.com|accommodation|night stay|check-?in fee)\b/i],
  ['transport', /\b(grab|taxi|cab|uber|ola|xanh|gojek|bus|train|metro|limo|limousine|transfer|toll|fuel|petrol|scooter|scooty|bike rental|ferry|shuttle|parking)\b/i],
  ['tours', /\b(ticket|tickets|entry|entrance|tour|cruise|show|museum|temple|cable car|ba na|golden bridge|boat|basket boat|guide|klook|pass|park|activity|lantern|trang an|hang mua)\b/i],
  ['food', /\b(food|lunch|dinner|breakfast|brunch|coffee|cafe|café|tea|restaurant|meal|snack|snacks|drink|drinks|water|juice|smoothie|ice cream|kem|banh|pho|buffet|thali|veg|bar|dessert|bakery|fruit)\b/i],
  ['shopping', /\b(shop|shopping|market|souvenir|gift|gifts|cashew|cashews|silk|tailor|clothes|shirt|dress|bag|store|mall|buy|bought|coffee beans)\b/i],
];

/** Best-guess category for what someone typed, or null when nothing matches. */
export function guessCategory(title: string): ExpenseCategory | null {
  const t = title.trim();
  if (t.length < 2) return null;
  for (const [cat, re] of RULES) if (re.test(t)) return cat;
  if (/\b(tip|sim|esim|insurance|medicine|pharmacy|laundry|atm|fee)\b/i.test(t)) return 'other';
  return null;
}

export const QUICK_EXPENSES: { title: string; category: ExpenseCategory }[] = [
  { title: 'Grab / taxi', category: 'transport' },
  { title: 'Lunch', category: 'food' },
  { title: 'Dinner', category: 'food' },
  { title: 'Coffee & snacks', category: 'food' },
  { title: 'Entry tickets', category: 'tours' },
  { title: 'Shopping', category: 'shopping' },
  { title: 'Tip', category: 'other' },
];
