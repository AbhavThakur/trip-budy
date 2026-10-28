import { useGlobalSearchParams, useLocalSearchParams } from 'expo-router';
import { createContext, useContext } from 'react';

/** Trip id provided by the trip tabs layout — tab screens don't reliably receive parent route params. */
export const TripIdContext = createContext<string | undefined>(undefined);

export function useTripId(): string {
  const fromContext = useContext(TripIdContext);
  const local = useLocalSearchParams<{ id?: string }>();
  const global = useGlobalSearchParams<{ id?: string }>();
  return (fromContext ?? local.id ?? global.id)!;
}
