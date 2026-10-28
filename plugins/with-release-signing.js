// Signs release builds with the family's own key instead of the public Expo debug key.
// The key lives OUTSIDE the repo: ~/.trip-buddy/keystore.properties (override with TRIP_BUDDY_KEYSTORE_PROPS).
// If the file is missing (e.g. a fresh machine) the build falls back to the debug key and prints a warning.
// KEEP A BACKUP of ~/.trip-buddy — a different key can never update an installed app.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = (config) =>
  withAppBuildGradle(config, (c) => {
    const propsPath = process.env.TRIP_BUDDY_KEYSTORE_PROPS || path.join(os.homedir(), '.trip-buddy', 'keystore.properties');
    if (!fs.existsSync(propsPath)) {
      console.warn(`[with-release-signing] ${propsPath} not found — release build will use the DEBUG key`);
      return c;
    }
    let g = c.modResults.contents;
    if (g.includes('tripBuddyRelease')) return c;
    const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const block = `
    signingConfigs {
        tripBuddyRelease {
            def p = new Properties()
            file('${esc(propsPath)}').withInputStream { p.load(it) }
            storeFile file(p['storeFile'])
            storePassword p['storePassword']
            keyAlias p['keyAlias']
            keyPassword p['keyPassword']
        }
    }`;
    g = g.replace(/\n    signingConfigs \{/, `${block}\n    signingConfigs {`);
    // the first signingConfigs block above is ours; Gradle merges multiple blocks fine, but keep a single release switch:
    g = g.replace(/(release \{[\s\S]*?)signingConfig signingConfigs\.debug/, '$1signingConfig signingConfigs.tripBuddyRelease');
    c.modResults.contents = g;
    return c;
  });
