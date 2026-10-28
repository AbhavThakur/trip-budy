import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { asyncKv } from '@/lib/storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (key && (key.startsWith('sb_secret_') || key.includes('service_role'))) {
  throw new Error('Never ship a Supabase secret/service_role key in the app. Use the anon / publishable key.');
}

export const cloudConfigured = Boolean(url && key);

export const supabase: SupabaseClient | null = cloudConfigured
  ? createClient(url!, key!, {
      auth: { storage: asyncKv, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;

export const DOCS_BUCKET = 'trip-docs';

/** Signs in anonymously once per install. Returns the user id or null when offline/unconfigured. */
export async function ensureSession(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const res = await supabase.auth.signInAnonymously();
  if (res.error) throw res.error;
  return res.data.user?.id ?? null;
}
