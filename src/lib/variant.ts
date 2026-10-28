import Constants from 'expo-constants';

export const appVariant: 'production' | 'test' = Constants.expoConfig?.extra?.appVariant === 'test' ? 'test' : 'production';
export const isTestApp = appVariant === 'test';

/** Trip ids are suffixed in the test app so its cloud data never mixes with the real trip. */
export const variantTripId = (id: string) => (isTestApp && !id.endsWith('-test') ? `${id}-test` : id);

export const joinLink = (code: string) => `${isTestApp ? 'tripbuddytest' : 'tripbuddy'}://join?code=${code}`;
