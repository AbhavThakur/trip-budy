// Two installable variants from one codebase:
//   production (default)      → "Trip Buddy",        com.tripbuddy.family,      OTA channel "production"
//   APP_VARIANT=test          → "Trip Buddy (Test)", com.tripbuddy.family.test, OTA channel "test"
// The test app keeps its own local data and uses "-test" trip ids in Supabase, so QA never touches real trips.
module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT === 'test' ? 'test' : 'production';
  if (variant === 'production') return { ...config, extra: { ...config.extra, appVariant: variant } };
  return {
    ...config,
    name: 'Trip Buddy (Test)',
    scheme: 'tripbuddytest',
    android: {
      ...config.android,
      package: `${config.android.package}.test`,
      adaptiveIcon: { ...config.android.adaptiveIcon, backgroundImage: './assets/images/android-icon-background-test.png', backgroundColor: '#B45309' },
    },
    ios: { ...config.ios, bundleIdentifier: `${config.ios.bundleIdentifier}.test` },
    updates: { ...config.updates, requestHeaders: { 'expo-channel-name': 'test' } },
    extra: { ...config.extra, appVariant: variant },
  };
};
