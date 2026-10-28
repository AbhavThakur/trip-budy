import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useFx } from '@/lib/fx';
import { formatMoney, INR } from '@/lib/money';
import { colors, font, radius, space } from '@/theme';
import type { Currency } from '@/types/trip';

import { Card, Icon, Pill, Row, Txt } from './ui';

const parse = (s: string) => Number(s.replace(/[^\d.]/g, '')) || 0;
const fmt = (n: number, decimals: number) => (n ? n.toLocaleString('en-US', { maximumFractionDigits: decimals }) : '');

export function CurrencyConverter({ currency, bare }: { currency: Currency; bare?: boolean }) {
  const fx = useFx(currency);
  const [local, setLocal] = useState('100,000');
  const [inr, setInr] = useState(fmt(100000 * fx.inrPerUnit, 0));
  const [lastEdited, setLastEdited] = useState<'local' | 'inr'>('local');

  const localVal = lastEdited === 'local' ? local : fmt(parse(inr) / fx.inrPerUnit, currency.decimals);
  const inrVal = lastEdited === 'inr' ? inr : fmt(parse(local) * fx.inrPerUnit, 0);
  const quick = currency.code === 'VND' ? [50000, 100000, 200000, 500000, 1000000] : [100, 500, 1000];

  const Wrap = bare ? View : Card;
  return (
    <Wrap>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="tiny" color={colors.textDim}>
          {currency.code} ⇄ INR
        </Txt>
        <Row gap={6}>
          <Icon name={fx.live ? 'radio' : 'cloud-offline-outline'} size={12} color={fx.live ? colors.emerald : colors.textMute} />
          <Txt v="small" color={colors.textDim} style={{ fontSize: 11 }}>
            1 INR = {Math.round(1 / fx.inrPerUnit).toLocaleString()} {currency.code} · {fx.live ? 'live' : 'offline rate'}
          </Txt>
        </Row>
      </Row>
      <View style={{ marginTop: space.md, gap: space.sm }}>
        <Field code={currency.code} symbol={currency.symbol} value={localVal} onChange={(v) => { setLocal(v); setLastEdited('local'); }} />
        <Row style={{ justifyContent: 'center' }}>
          <Icon name="swap-vertical" color={colors.gold} />
        </Row>
        <Field code="INR" symbol="₹" value={inrVal} onChange={(v) => { setInr(v); setLastEdited('inr'); }} />
      </View>
      <Row style={{ flexWrap: 'wrap', marginTop: space.md }}>
        {quick.map((q) => (
          <Pill
            key={q}
            small
            label={`${formatMoney(q, currency, { compact: true })} ≈ ${formatMoney(q * fx.inrPerUnit, INR, { compact: true })}`}
            onPress={() => {
              setLocal(fmt(q, 0));
              setLastEdited('local');
            }}
          />
        ))}
      </Row>
    </Wrap>
  );
}

function Field({ code, symbol, value, onChange }: { code: string; symbol: string; value: string; onChange: (v: string) => void }) {
  return (
    <Pressable style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.border }}>
      <Txt v="h2" color={colors.gold}>
        {symbol}
      </Txt>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.textMute}
        style={[{ flex: 1, color: colors.text, fontSize: 24, fontWeight: '700', paddingVertical: space.md, paddingHorizontal: space.sm }, font.mono]}
      />
      <Txt v="tiny" color={colors.textDim}>
        {code}
      </Txt>
    </Pressable>
  );
}
