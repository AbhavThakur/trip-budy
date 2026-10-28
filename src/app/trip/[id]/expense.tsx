import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Avatar, Button, Icon, Pill, Row, SectionTitle, Txt } from '@/components/ui';
import { useFx } from '@/lib/fx';
import { importToVault, localFile } from '@/lib/files';
import { success } from '@/lib/haptics';
import { formatMoney, fromMinor, INR, toMinor } from '@/lib/money';
import { uid } from '@/lib/storage';
import { shortDate, todayIn } from '@/lib/time';
import { useMe } from '@/lib/trip';
import { useLedger } from '@/store/ledger';
import { useTrip } from '@/store/trips';
import { colors, font, radius, space } from '@/theme';
import { CATEGORY_META } from '@/theme/categories';
import type { ExpenseCategory } from '@/types/trip';

export default function ExpenseEditor() {
  const { id, eid } = useLocalSearchParams<{ id: string; eid?: string }>();
  const trip = useTrip(id)!;
  const me = useMe(trip);
  const existing = useLedger((s) => (eid ? s.expenses[eid] : undefined));
  const put = useLedger((s) => s.put);
  const remove = useLedger((s) => s.remove);
  const fx = useFx(trip.currency);

  const [currency, setCurrency] = useState(existing?.currency ?? trip.currency.code);
  const cur = currency === 'INR' ? INR : trip.currency;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [amount, setAmount] = useState(existing ? String(fromMinor(existing.amountMinor, cur)) : '');
  const [category, setCategory] = useState<ExpenseCategory>(existing?.category ?? 'food');
  const [paidBy, setPaidBy] = useState(existing?.paidBy ?? me?.id ?? trip.travelers[0].id);
  const [splitWith, setSplitWith] = useState<string[]>(existing?.splitWith ?? trip.travelers.map((t) => t.id));
  const defaultDate = useMemo(() => {
    const today = todayIn(trip.timezone);
    return trip.days.some((d) => d.date === today) ? today : trip.days[0].date;
  }, [trip]);
  const [date, setDate] = useState(existing?.spentAt.slice(0, 10) ?? defaultDate);
  const [note, setNote] = useState(existing?.note ?? '');
  const [receipt, setReceipt] = useState<string | undefined>(existing?.receiptPath);
  const [receiptUri, setReceiptUri] = useState<string | undefined>(() => {
    if (!existing?.receiptPath) return undefined;
    const f = localFile(`rcpt-${existing.id}`, 'image/jpeg');
    return f.exists ? f.uri : undefined;
  });
  const [expenseId] = useState(existing?.id ?? uid('ex-'));

  const value = Number(amount.replace(/,/g, '')) || 0;
  const inrPerUnit = currency === 'INR' ? 1 : existing?.currency === currency ? existing.inrPerUnit : fx.inrPerUnit;
  const valid = title.trim() && value > 0 && splitWith.length > 0;

  const pickReceipt = async (camera: boolean) => {
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets[0]) return;
    const f = importToVault(res.assets[0].uri, `rcpt-${expenseId}`, 'image/jpeg');
    setReceipt('local:pending');
    setReceiptUri(`${f.uri}?t=${Date.now()}`);
  };

  const save = () => {
    put('expenses', {
      id: expenseId,
      tripId: trip.id,
      title: title.trim(),
      category,
      amountMinor: toMinor(value, cur),
      currency,
      inrPerUnit,
      paidBy,
      splitWith,
      spentAt: `${date}T12:00:00`,
      note: note.trim() || undefined,
      receiptPath: receipt,
      updatedBy: me?.id,
    });
    success();
    router.back();
  };

  const toggleSplit = (tid: string) => setSplitWith((s) => (s.includes(tid) ? s.filter((x) => x !== tid) : [...s, tid]));

  return (
    <Screen
      title={existing ? 'Edit expense' : 'New expense'}
      right={
        existing ? (
          <Pressable
            onPress={() =>
              Alert.alert('Delete expense?', 'It will be removed from everyone’s wallet.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    remove('expenses', existing.id);
                    router.back();
                  },
                },
              ])
            }>
            <Icon name="trash-outline" color={colors.rose} />
          </Pressable>
        ) : undefined
      }
      footer={<Button label={existing ? 'Save changes' : 'Add expense'} icon="checkmark" onPress={save} disabled={!valid} />}>
      <Row style={{ backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: space.lg, borderWidth: 1, borderColor: colors.border }}>
        <Txt v="h1" color={colors.gold}>
          {cur.symbol}
        </Txt>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.textMute}
          autoFocus={!existing}
          style={[{ flex: 1, color: colors.text, fontSize: 36, fontWeight: '800', paddingVertical: space.lg }, font.mono]}
        />
      </Row>
      <Row style={{ marginTop: space.sm, justifyContent: 'space-between' }}>
        <Row>
          {[trip.currency.code, 'INR'].filter((c, i, a) => a.indexOf(c) === i).map((c) => (
            <Pill key={c} small label={c} active={currency === c} onPress={() => setCurrency(c)} />
          ))}
        </Row>
        {currency !== 'INR' && value > 0 && (
          <Txt v="small" color={colors.textDim}>
            ≈ {formatMoney(value * inrPerUnit, INR)}
          </Txt>
        )}
      </Row>

      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="What was it? e.g. Grab to Ba Na Hills"
        placeholderTextColor={colors.textMute}
        style={{ marginTop: space.lg, color: colors.text, fontSize: 17, padding: space.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}
      />

      <SectionTitle title="Category" />
      <Row style={{ flexWrap: 'wrap' }}>
        {(Object.keys(CATEGORY_META) as ExpenseCategory[]).map((c) => (
          <Pill key={c} label={CATEGORY_META[c].label} icon={CATEGORY_META[c].icon} color={CATEGORY_META[c].color} active={category === c} onPress={() => setCategory(c)} />
        ))}
      </Row>

      <SectionTitle title="Paid by" />
      <Row style={{ flexWrap: 'wrap' }} gap={space.md}>
        {trip.travelers.map((t) => (
          <Pressable key={t.id} onPress={() => setPaidBy(t.id)} style={{ alignItems: 'center', gap: 4, opacity: paidBy === t.id ? 1 : 0.45 }}>
            <View style={{ borderRadius: 24, borderWidth: 2, borderColor: paidBy === t.id ? colors.gold : 'transparent', padding: 2 }}>
              <Avatar t={t} size={40} />
            </View>
            <Txt v="small">{t.shortName}</Txt>
          </Pressable>
        ))}
      </Row>

      <SectionTitle
        title={`Split equally between (${splitWith.length})`}
        action={splitWith.length === trip.travelers.length ? 'Only me' : 'Everyone'}
        onAction={() => setSplitWith(splitWith.length === trip.travelers.length ? [paidBy] : trip.travelers.map((t) => t.id))}
      />
      <Row style={{ flexWrap: 'wrap' }}>
        {trip.travelers.map((t) => (
          <Pill key={t.id} label={t.shortName} icon={splitWith.includes(t.id) ? 'checkmark-circle' : 'ellipse-outline'} color={t.color} active={splitWith.includes(t.id)} onPress={() => toggleSplit(t.id)} />
        ))}
      </Row>
      {value > 0 && splitWith.length > 0 && (
        <Txt v="small" color={colors.textDim} style={{ marginTop: space.sm }}>
          {formatMoney(value / splitWith.length, cur)} each
        </Txt>
      )}

      <SectionTitle title="Day" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {trip.days.map((d) => (
          <Pill key={d.index} small label={`D${d.index} · ${shortDate(d.date)}`} active={date === d.date} onPress={() => setDate(d.date)} />
        ))}
      </ScrollView>

      <SectionTitle title="Receipt & note" />
      <Row>
        <Pill icon="camera" label="Camera" onPress={() => pickReceipt(true)} />
        <Pill icon="image" label="Gallery" onPress={() => pickReceipt(false)} />
        {receipt && (
          <Pill
            icon="close"
            label="Remove"
            color={colors.rose}
            onPress={() => {
              setReceipt(undefined);
              setReceiptUri(undefined);
            }}
          />
        )}
      </Row>
      {receiptUri && <Image source={{ uri: receiptUri }} style={{ width: '100%', height: 220, borderRadius: radius.md, marginTop: space.md }} contentFit="cover" />}
      {receipt && !receiptUri && (
        <Txt v="small" color={colors.textDim} style={{ marginTop: space.sm }}>
          Receipt will download on next sync.
        </Txt>
      )}
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Optional note"
        placeholderTextColor={colors.textMute}
        multiline
        style={{ marginTop: space.md, color: colors.text, fontSize: 15, padding: space.md, minHeight: 70, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}
      />
    </Screen>
  );
}
