# Trip Buddy — Final Implementation Plan

_Last updated 28 Oct 2026 (full QA pass) · departure Thu 3 Dec 2026 (36 days)_

## 1. Decisions

| Topic | Decision | Why |
|---|---|---|
| Platform | Android only (all 5 phones), sideloaded APK | No Play Store review, no Apple account needed |
| Framework | Expo SDK 58 + Expo Router, React Native 0.88 (New Architecture) | Current stable; file-based routing |
| Local storage | Zustand + `expo-sqlite/kv-store` (synchronous) | Instant offline reads, no extra native lib (MMKV not needed) |
| Backend | **Keep Supabase** (not Firebase) | Already set up; Postgres suits a money ledger; RLS + private storage; realtime. Firebase's offline cache is nice, but it needs a new project and google-services setup, and its document model is a poorer fit for settlements. |
| Auth | Supabase anonymous sign-in + 6-letter join code | No passwords for parents; access = membership (RLS) |
| Sync model | Trip content = 1 versioned document. Expenses / settlements / checklist / documents = individual rows with last-writer-wins by `updatedAt`, offline outbox, realtime push | Two phones adding expenses offline never overwrite each other |
| Files | Private bucket `trip-docs`, signed URLs, local copy on every phone | Passports are never public; vault works in airplane mode |
| Map | MapLibre + OpenFreeMap dark vector tiles, downloadable offline packs per region | `react-native-maps` can't do offline; no API key |
| Audio | Device TTS (`expo-speech`) + voice-pack check → opens Android TTS settings | Works offline once the Vietnamese voice is installed. Recorded clips can be dropped in later (`Phrase.audio`). |
| Sheets | Native `Modal` sheet instead of `@gorhom/bottom-sheet` | One less native dependency on a brand-new RN version |
| Legacy PWA | Delete **after** the APK is installed and verified on all 5 phones | It still holds the source itinerary data for the importer |

## 2. UI features — keep or cut?

All of them are built, because they cost little and make the app feel premium:

| Feature | Verdict | Implementation |
|---|---|---|
| 3D passport carousel | ✅ Keep | Reanimated `rotateY` + scale on scroll, gradient "leather" cover, stitched border, crest |
| Readiness ring | ✅ Keep — it's useful | Required docs attached + checklist ticks (shared live) |
| Swipe-linked map carousel | ✅ Keep | Bottom cards ⇄ camera `flyTo`, tap a pin to scroll to its card |
| Live FX | ✅ Keep | open.er-api.com, cached 6h, falls back to the trip rate offline; each expense stores the rate it was entered at |
| Receipt photos | ✅ Keep | Camera/gallery → local copy → uploaded to private bucket on sync |

## 3. What's built (v0.1)

**Home**: passport carousel (active → upcoming → completed), sync status, join trip.
**Expedition**: Now & Next HUD (countdown → live current/next stop → web check-in window alert), day pills, timeline merging stops + flights + hotel check-in/out, expandable cards (tips, Navigate, Driver card, flight / booking links), WhatsApp day share, dual clock (local + IST).
**Radar**: offline-capable map, filters (Today / All / Stays / Pure veg / Shopping), synced card carousel, offline region downloader.
**Wallet**: total spent, my balance, settle-up (minimum transfers), per-person balances, category bar, converter, expense list, planned & prepaid budget. Add/edit/delete expense: VND or INR, category, payer, split, day, receipt, note.
**Vault**: SOS quick-dial, basecamps (call / navigate / driver card), biometric-locked documents with per-traveler filter, expected-document slots (passport, e-visa, tickets, hotels, cruise, insurance) → attach PDF/image → offline viewer with pinch-zoom, scanner brightness boost, keep-awake, system PDF viewer, share.
**More screens**: Flights & transfers (PNRs, copy, e-tickets, baggage, web check-in), Stays (rooms, confirmations, payment, cancellation), Phrasebook (diet / taxi / market / help / basics + TTS), full-screen show-to-driver card, Emergency (113/114/115, embassy, hospitals, "I'm lost" card with hotel address, family phones), Pre-departure readiness (ring, baggage rule, open questions, shared checklist), Travelers (add / edit / remove, "this phone"), Settings (sync, share code, large text for parents, vault lock, voice check).

**Data**: Vietnam built from your tickets (7 flights, 3 stays, 42 stops, 22 phrases); Hampi + Chikmagalur imported as past trips.

## 4. Ticket review — what changed vs the old web app

| Item | Old web data | Tickets (now in app) |
|---|---|---|
| Da Nang hotel | TMS Hotel | **Delicate Hotel**, 2 rooms, Booking.com 6575.472.606 & 6155.457.223, pay at property |
| Hanoi hotel | Peridot Grand | **Urban Alley Hotel**, 2 rooms, Agoda 2052041833 & 2052042959, pay later |
| Cruise | Aqua Cruise | **Cozy Bay Grand**, Klook NRJ724054, ₹67,900 paid |
| HAN→DAD | VN-165 09:00 | **VietJet VJ 527 09:45** (PNR RVKAH8) |
| DAD→HAN | VN-172 12:00 | **VietJet VJ 512 13:15** (PNR 8AR7WB) |
| Return | — | VJ 971 HAN 19:10 → DEL 22:50 (PNR 58FTFJ), then **Akasa QP 1827 DEL→BLR 12 Dec** for Abhav/Aanya/Arjit |
| Baggage | 25 kg | 30 kg IndiGo intl · **20 kg VietJet** (tightest) · 7 kg cabin |

Booking-management PINs are deliberately **not** stored in the app.

## 5. Open questions (also shown in-app under "Still to confirm")

1. Cozy Bay cruise date (assumed 9–10 Dec), pickup time, operator phone — not on the Klook receipt.
2. Urban Alley room allocation and check-in time.
3. Amounts paid for DEL→HAN (MakeMyTrip) and the VietJet domestic flights.
4. Ground transfers — none booked; all are estimates.
5. Family phone numbers — placeholders.
6. **Insurance gap:** Care Health cover runs 04 Dec 00:00 → 10 Dec midnight. The 03 Dec departure evening + Kolkata layover are not covered.
7. Should the Delhi→Bengaluru leg (12 Dec) be part of this trip or a separate one?

✅ Resolved from `Vietnam Visa.pdf`: all 5 e-visas (single entry, 03 Dec 2026 – 02 Mar 2027), passport numbers + expiry (all valid > 6 months after return), 5 insurance certificates (USD 50,000, group policy 24737838) and the Care Health / Falck emergency numbers.

## 6. Remaining roadmap

| When | Task | Owner |
|---|---|---|
| ✅ Done | Anonymous sign-ins, schema.sql (incl. join-code fix), EAS project + OTA channel `production` | You + agent |
| Now | Run `supabase/reset-test-data.sql` once (removes the QA copy of the trip), then on **your phone**: install APK → Settings → Share with family | You |
| Week 1 (by 4 Nov) | Install APK + Join on the other 4 phones; replace phone-number placeholders → `npm run ship` | You + agent |
| Week 2 (by 11 Nov) | Vault: attach each PDF once and use **"This file also covers…"** to link multi-person PDFs (the visa PDF covers all 10 visa + insurance slots); download offline map regions; install the Vietnamese TTS voice | Family |
| Week 3 (by 22 Nov) | Airplane-mode drill on every phone | Everyone |
| After the trip | Delete legacy `trip-architect` (its data is now vendored in `scripts/seed/legacy`) and its public `trips` table / bucket | You |

## 7. Verification done (28 Oct, full pass)

**Automated**: `tsc` clean · `expo lint` clean · 6 unit tests · live backend self-test 16/16 (anonymous auth, publish + join code, stranger blocked by RLS, member read, LWW rejects stale offline write, stranger can't write, private bucket upload, signed-URL download, stranger blocked from file, bucket not public, trip-document optimistic concurrency, cleanup).

**On device (release APK, Android emulator)**:
- Carousel swipe, completed vs upcoming trips, Hampi timeline.
- Vault unlock, attach real visa PDF, offline viewer, system PDF viewer, readiness counters, passport-validity check.
- Share trip → join code → second phone (script) joins, sees the document and downloads the 5 MB PDF.
- Second phone adds an expense → appears live on first phone with correct split.
- Settle-up row → synced. Airplane mode → add expense offline → reconnect → reaches server.
- Fresh install → **Join** UI with code → pick traveler → identical balances + document available offline.
- **OTA**: published update to `production` → app showed "Trip update ready" → restart → Settings shows the new bundle id; sync still works on the OTA bundle.
- One file linked to 10 slots → 10 rows, 1 stored object.

**Bugs found & fixed during QA**: join-code generator failed on Supabase (`gen_random_bytes` not on search_path) · keyboard covered footer buttons · completed trips showed "0% ready" · baggage rule used an unconfirmed leg · map tab crash (missing route param) · Gradle metaspace OOM on release builds.

## 8. Round 3 (28 Oct afternoon) — Radar 2.0, identity, sharing, tickets, test app

**Radar** (now the "where do I go next" screen):
- Opens on today's day (or the first day before the trip) instead of a cluttered "all".
- Numbered stops in visiting order, gold dashed route line, hotels always shown as blue bed pins.
- Camera auto-fits the day (ignores far-away airport legs so the city stays readable).
- Swipe the bottom cards ⇄ map flies to the stop; cards have Navigate + Driver card + "n/7".
- "My location" (GPS, works offline): blue dot + distance on each card; friendly message if you're still in India.
- Offline-map banner until regions are downloaded; "Download all regions" + per-region progress bar.
- Tested: Day 1/2 views, card swipe, location permission, Da Nang pack download (~20 s), then airplane mode + cold start → map still renders.

**Identity & family**:
- Name chip top-right on the trip screen → tap to switch person anytime; warns if that person is already on another phone. Choice syncs to the server.
- Family card shows who has joined (bright) vs not yet (faded), live via realtime.
- New Invite screen: Start family sync → 6-letter code + QR + WhatsApp message + per-person invite.
- Deep link `tripbuddy://join?code=…` pre-fills the join screen.

**Vault**: Mine (your passport/visa/insurance) · Group (shared bookings) · Everyone (lead can see all, per-person filter).

**Day tickets**: 10 entries for Vietnam with per-person price, total for the family, Book-ahead warnings (Ba Na Hills), Mark booked (shared), Book link, Attach ticket. Shown as a strip on each day in the timeline and counted in readiness.

**All PDFs uploaded & verified** (to the Test trip): 11 files → 20 vault slots; phone downloaded them; image ticket opens with pinch/double-tap zoom; PDFs open in the system viewer.

**Test vs real**: separate Test app + test OTA channel + `-test` trip ids. Verified a test session cannot see the real trip.

**Bugs found & fixed in this round**: map pins vanished after enabling location · Day 1 zoomed out to all of Vietnam · trip code clipped · zoomed image covered the close button · empty day-ticket slots cluttered Group · update banner covered the name chip · members list didn't refresh when someone joined.

**Ideas for later**: weather per day (cached), "leave by" alerts before each stop using drive time, push notifications for check-in windows, trip photo journal per day, packing list per person.
