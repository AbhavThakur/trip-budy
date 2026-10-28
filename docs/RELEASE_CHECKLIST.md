# Trip Buddy — Release readiness (28 Oct 2026)

## Verdict: ✅ ready to share with the family

| Area | Status | Evidence |
|---|---|---|
| Build | ✅ | `dist-apk/trip-buddy.apk` (real) and `trip-buddy-TEST.apk`, release builds, compass icon, name “Trip Buddy” |
| Automated | ✅ | tsc clean · lint clean · 10 unit tests · live backend self-test 16/16 |
| Offline | ✅ | airplane mode: timeline, vault PDFs, Radar (downloaded region), phrases, add expense; syncs on reconnect |
| Sync | ✅ | 2-phone tests: join by code, expense split, settlement, docs download, identity switch, members live |
| Security | ✅ | anonymous auth + RLS membership; stranger can't read rows or files; private bucket; signed URLs; vault biometric lock |
| OTA | ✅ | update published → “Trip update ready” → restart → new bundle; separate test channel |
| Reminders | ✅ | 25 reminders scheduled on device; test notification delivered with icon; tap opens the right screen |
| Performance | ✅ | cold start 0.7 s (first launch after install ~13 s while Android compiles — one time only) |

## Reminders the app schedules (on-device, work offline)
- **Before you fly:** 14 days (bookings, eSIM, forex + readiness %), 7 days (packing to the tightest baggage limit), day before (print e-visas, download maps).
- **Day tickets:** 14 and 5 days before for book-ahead tickets not yet marked booked (Ba Na Hills).
- **Flights (per person):** web check-in opens (IndiGo 48 h, others 24 h) and “leave for the airport” (3 h intl / 2 h domestic + 1 h travel) — exact alarms.
- **Hotels (per person's room):** 90 min before check-out — safe, passports, chargers.
- **Morning briefing:** 07:30 local each day — stops, weather, tickets needed.
Each category can be switched off in Settings → Reminders.

## Go-live steps
1. Supabase SQL editor: run `migrations-2026-10-28.sql`, `migrations-2026-10-28b-auto-join.sql`, then `reset-test-data.sql`.
2. Install `trip-buddy.apk` on your phone → open Vietnam → pick yourself → allow notifications → Invite → Start family sync.
3. `npm run upload-docs -- --code <REAL CODE>` (uploads all 11 files once).
4. Send the APK + WhatsApp invite to the 4 others (Android: allow “Install unknown apps” for WhatsApp/Files once).
5. Each phone: Radar → Download all regions on Wi-Fi; Settings → Offline voice check.

## Known limitations (accepted)
- APK is signed with the debug key — fine for sideloading; Play Store would need a release keystore (EAS can create it).
- First launch after install is slow (~13 s) on older phones while Android optimises the app.
- Day-ticket prices are typical rates (marked Verify).
- Family phone numbers and cruise pickup time are still placeholders (update seed → `npm run ship`).
