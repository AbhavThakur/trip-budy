import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { hasVoice, openTtsSettings, speak } from '@/lib/speech';
import { colors, radius, space } from '@/theme';

import { Icon, IconButton, Row, Txt } from './ui';

/** Plays a phrase with the phone's TTS voice; offers to install the voice pack when missing. */
export function SpeakButton({ text, locale, size = 44, slow }: { text: string; locale: string; size?: number; slow?: boolean }) {
  const [speaking, setSpeaking] = useState(false);
  return (
    <IconButton
      icon={speaking ? 'volume-high' : 'play'}
      size={size}
      bg={colors.gold}
      color={colors.bg}
      label="Speak"
      onPress={() => {
        setSpeaking(true);
        speak(text, locale, { slow, onDone: () => setSpeaking(false) });
      }}
    />
  );
}

export function VoiceCheck({ locale }: { locale: string }) {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    void hasVoice(locale).then(setOk);
  }, [locale]);
  if (ok !== false) return null;
  return (
    <Pressable onPress={openTtsSettings} style={{ padding: space.md, borderRadius: radius.md, backgroundColor: colors.goldSoft, marginBottom: space.md }}>
      <Row style={{ alignItems: 'flex-start' }}>
        <Icon name="download-outline" color={colors.gold} />
        <View style={{ flex: 1 }}>
          <Txt v="h3" color={colors.gold}>
            Install the {locale.startsWith('vi') ? 'Vietnamese' : locale} voice
          </Txt>
          <Txt v="small" color={colors.textDim}>
            Audio needs the offline voice pack. Tap → Speech services by Google → Install voice data. The written cards work without it.
          </Txt>
        </View>
      </Row>
    </Pressable>
  );
}
