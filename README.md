# Trip Buddy 🧭

Offline-first family travel companion for Android (Expo / React Native).
Passport-style trip carousel · live "Now & Next" timeline · offline map · shared expense split · document vault · phrasebook with audio · SOS.

## Run it

```bash
npm install
cp .env.example .env          # optional: add Supabase URL + anon key for family sync
npm run import-trips          # regenerate src/data/trips/*.json from seeds
npx expo prebuild -p android
npx expo run:android          # dev build on emulator / USB phone
```

Release APK for sideloading onto family phones (install once):

```bash
npm run build:apk
# → android/app/build/outputs/apk/release/app-release.apk
```

## Sharing the APK

See [docs/SHARING.md](docs/SHARING.md): why Drive/Play Protect shows "blocked", what the build does about it, ranked sharing options and a copy-paste family message. Release builds are signed with `~/.trip-buddy/keystore.properties` (back it up!).

## Database access (for me / for you)

`npm run db -- "select count(*) from tb_trips"` runs SQL on the Supabase project; `npm run db -- --file supabase/xyz.sql` applies a migration.
Put a personal access token in `.env.admin` (copy `.env.admin.example`; token from supabase.com/dashboard/account/tokens). The token is gitignored and never shipped in the app.
The Supabase MCP in VS Code (`mcp.json` → `supabase`) also works once you sign in via the MCP panel (OAuth) — it must be started from your VS Code session.

## OTA vs new APK — which to use

| Change | Ship with |
|---|---|
| Screens, logic, trip data, copy, fixes, new reminders | `npm run ship` (OTA, mandatory install screen) |
| New native library, permission, icon, app name, `version` bump | `npm run build:apk` and reinstall |

An OTA only swaps the JavaScript bundle. It never reinstalls the app, so permissions, the vault files (`Documents/vault`), offline map packs and all saved data (SQLite key-value store) are untouched — verified on device (permissions + expenses + attached documents identical before/after).

## Two apps: real vs test

| | Real app | Test app |
|---|---|---|
| Name on phone | Trip Buddy | Trip Buddy (Test) — red "TEST" label on home |
| Package | `com.tripbuddy.family` | `com.tripbuddy.family.test` (installs side by side) |
| Cloud trip id | `vietnam-2026` | `vietnam-2026-test` |
| OTA channel | `production` (`npm run ship`) | `test` (`npm run ship:test`) |
| Build | `npm run build:apk` | `npm run build:apk:test` |

Same real ticket data in both, but test sharing/expenses/uploads never touch the family's real trip. Try every change on the Test app first, then `npm run ship`.

## Upload all ticket PDFs at once

```bash
npm run upload-docs -- --code <TRIP CODE>       # reads ../ (the Trip folder), mapping in scripts/seed/doc-map.mjs
```

Uploads each file once to the private bucket and fills every matching vault slot (the Atlys PDF fills all 5 visas + 5 insurance). Every phone in the trip downloads them for offline use on its next sync.

## Shipping changes without reinstalling (OTA)

Any JS / data change (itinerary, phrases, fixes) goes out over the air:

```bash
npm run ship -- "Updated cruise pickup time"
```

Phones download it in the background and show **“Trip update ready”**; one tap restarts into the new version (Settings → App updates shows the running bundle).
Only native changes (new native library, permissions, app.json plugins) or bumping `version` in app.json need a new APK.
Supabase keys for OTA bundles come from EAS environment variables (`production`), already created from `.env`.

## Private data

Passport / visa / insurance numbers live in `scripts/seed/private.local.mjs` (gitignored) and are merged by `npm run import-trips` into `src/data/trips/vietnam-2026.json` (also gitignored). Keep a backup of the private seed outside the repo.

> The default release build is signed with the debug keystore — fine for sideloading. Use EAS (`npx eas-cli build -p android --profile preview`) or your own keystore for anything wider.

## How a family phone connects (no code needed)

1. The trip leader installs, opens the trip and taps **Invite → Start family sync** once. That publishes the trip and registers the app's family key on the server.
2. Everyone else installs the APK and just opens the trip. The app links itself to the shared trip using the family key built into it; if the leader hasn't shared yet it shows "connecting…" and retries on every refresh/foreground. Typing a code (Join a trip) still works as a fallback.
3. Pull down on any screen to sync instantly. Live changes arrive in ~1 s while the app is open; sockets are closed in the background so nothing drains the battery.
4. Updates are mandatory: when a new version has downloaded, a full-screen "Update required → Install update" screen blocks the app until it is installed.

Server one-time setup: run `supabase/migrations-2026-10-28b-auto-join.sql`. Keys: `EXPO_PUBLIC_FAMILY_KEY` in `.env` and in EAS environments (production + preview).

## Family sync setup (one time, ~5 min)

1. Supabase dashboard → **Authentication → Sign In / Providers → enable "Anonymous sign-ins"**.
2. SQL editor → paste and run [`supabase/schema.sql`](supabase/schema.sql).
3. Put `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (anon/publishable key, never service_role) in `.env`, rebuild.
4. Trip lead: **Settings → Share with family** → sends a 6-letter code.
5. Everyone else: **Home → Join a trip** → enter code → pick their name.

Without step 1–3 the app works fully on one phone ("On this phone" status).

## Checks

```bash
npm run typecheck && npx expo lint && npm test
node --env-file=.env scripts/backend-selftest.mjs   # live Supabase: RLS, join, LWW, private storage
```

## Docs

- [Implementation plan & status](docs/IMPLEMENTATION_PLAN.md)
- [Agent / contributor rules](AGENTS.md)
