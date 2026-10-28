import * as IntentLauncher from 'expo-intent-launcher';
import * as Speech from 'expo-speech';

const voiceCache = new Map<string, boolean>();

/** True when the phone has an offline-capable TTS voice for the language. */
export async function hasVoice(locale: string) {
  const lang = locale.slice(0, 2);
  if (voiceCache.has(lang)) return voiceCache.get(lang)!;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const ok = voices.some((v) => v.language?.toLowerCase().startsWith(lang));
    voiceCache.set(lang, ok);
    return ok;
  } catch {
    return false;
  }
}

export function speak(text: string, locale: string, opts: { slow?: boolean; onDone?: () => void } = {}) {
  Speech.stop();
  Speech.speak(text, {
    language: locale,
    rate: opts.slow ? 0.7 : 0.9,
    onDone: opts.onDone,
    onStopped: opts.onDone,
    onError: opts.onDone,
  });
}

export const stopSpeaking = () => Speech.stop();

/** Opens Android text-to-speech settings so the user can download the Vietnamese voice pack. */
export function openTtsSettings() {
  return IntentLauncher.startActivityAsync('com.android.settings.TTS_SETTINGS').catch(() =>
    IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.SETTINGS),
  );
}
