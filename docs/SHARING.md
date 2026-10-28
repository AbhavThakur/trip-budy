# Sharing Trip Buddy with the family

## Why Drive / phones showed "blocked"
Three different things look the same to the user. Check which one you saw:

| What you saw | Cause | Fix |
|---|---|---|
| **Drive: "can't share" / "blocked" / sharing greyed out** | A **work/school Google account** (e.g. an office Google Workspace) blocks sharing executables or sharing outside the company | Upload from a **personal Gmail** Drive, or use WhatsApp / a link service below |
| **Drive: "can't scan for viruses"** | Normal for files > 25 MB. Harmless — tap **Download anyway** | Nothing to fix |
| **Phone: "Blocked by Play Protect" / "App not installed" / "harmful"** | The old APK was signed with Expo's public *debug* key and asked for risky permissions (draw over apps, change settings, badges, …) | **Fixed in this build** — own signing key + risky permissions removed (see below) |

## What changed in the build
- Signed with the family's **own release key** (`~/.trip-buddy/release.keystore`, outside the repo) instead of the public debug key.
- Permissions cut from 40+ to **8** that the app really uses (location, camera, notifications, exact alarms for flight reminders, biometric, vibrate, network). Removed: *draw over other apps*, *modify system settings*, *read/write storage*, 20 launcher-badge permissions, push-registration.
- `versionCode` is now set, so a newer APK installs **over** the old one and keeps all data.
- ⚠️ This is a **new signing key**, so anyone who installed the earlier (debug-signed) APK must **uninstall it once** before installing this one. After that every update (APK or OTA) just works.
- 🔐 **Back up `~/.trip-buddy/`** (copy to a private cloud folder / USB). Lose it and nobody can update in place again.

## Honest limit
Any app installed outside the Play Store shows Android's "unknown app" prompts. Play Protect may still say **"Unrecognized app"** on first install → tap **More details → Install anyway**. That's a one-time prompt; only Google Play (or Firebase/EAS distribution) removes it fully.

## Ways to share, best first
1. **EAS internal link** (`npx eas-cli build -p android --profile preview`): gives a `expo.dev` install page + QR. Phones open the link, tap Install. No Drive, no file passing. *(uses EAS's own signing key; free plan has monthly build limits)*
2. **Google Play – Internal testing** ($25 one-time developer account): family joins by email/link, installs from Play Store like any app, Play Protect is happy, updates automatic. Best long-term, ~1–2 days to set up.
3. **WhatsApp "Document"**: send `trip-buddy.apk` as a document (not photo). Works if the phone allows installs from WhatsApp.
4. **Drive from a personal Gmail**: sharing = *Restricted → add each person's email* (not "Anyone with the link" — the app contains the trip's family key).
5. **USB / nearby-share** for parents' phones when you're together.

## Message to send the family (copy-paste)
> 🧭 **Trip Buddy – Vietnam trip app**
> 1. Download the file I sent (`trip-buddy.apk`).
> 2. Tap it → if Android asks, allow **“Install unknown apps”** for the app you opened it from (Chrome / WhatsApp / Files).
> 3. If it says **“Unrecognized app / Play Protect”** → tap **More details → Install anyway**.
> 4. Open **Trip Buddy** → tap **Vietnam** → pick your name. Done — it syncs by itself.
> 5. Tap **Allow** for notifications (reminders for flights & hotel check-out) and, in Radar, location.
> 6. If it says an *older version of the app is installed* → uninstall the old Trip Buddy first, then install again.

## Check the file before sharing
`shasum -a 256 dist-apk/trip-buddy.apk` — send the first 8 characters so family can confirm the file wasn't changed (Files app → file details, or any hash app).
