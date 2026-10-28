import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CurrencyConverter } from '@/components/converter';
import { Avatar, Button, Card, Empty, Icon, Pill, Row, SectionTitle, Txt } from '@/components/ui';
import { success } from '@/lib/haptics';
import { balances, expenseInrMinor, formatMoney, fromMinor, inr, settleUp } from '@/lib/money';
import { uid } from '@/lib/storage';
import { shortDate } from '@/lib/time';
import { travelerName, useMe } from '@/lib/trip';
import { liveRows, useLedger } from '@/store/ledger';
import { useTripId } from '@/lib/trip-context';
import { useTrip } from '@/store/trips';
import { colors, radius, space } from '@/theme';
import { CATEGORY_META } from '@/theme/categories';
import type { ExpenseCategory } from '@/types/trip';


export default function Wallet() {
  const id = useTripId();
  const trip = useTrip(id)!;
  const insets = useSafeAreaInsets();
  const me = useMe(trip);
  const expensesRec = useLedger((s) => s.expenses);
  const settlementsRec = useLedger((s) => s.settlements);
  const put = useLedger((s) => s.put);
  const [showBudget, setShowBudget] = useState(false);

  const expenses = useMemo(() => liveRows(expensesRec, trip.id).sort((a, b) => b.spentAt.localeCompare(a.spentAt)), [expensesRec, trip.id]);
  const settlements = useMemo(() => liveRows(settlementsRec, trip.id), [settlementsRec, trip.id]);
  const decimalsFor = (code: string) => (code === trip.currency.code ? trip.currency.decimals : 2);
  const bals = balances(trip.travelers.map((t) => t.id), expenses, settlements, decimalsFor);
  const transfers = settleUp(bals);
  const totalPaise = expenses.reduce((n, e) => n + expenseInrMinor(e, { decimals: decimalsFor(e.currency) }), 0);
  const myBal = bals.find((b) => b.travelerId === me?.id);

  const byCategory = useMemo(() => {
    const m = new Map<ExpenseCategory, number>();
    for (const e of expenses) m.set(e.category, (m.get(e.category) ?? 0) + expenseInrMinor(e, { decimals: decimalsFor(e.currency) }));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses]);

  const plannedTotal = trip.budget.reduce((n, b) => n + b.amountInr, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.sm, paddingBottom: 120 }}>
        <Txt v="h1">Wallet</Txt>

        <Card style={{ marginTop: space.lg, backgroundColor: colors.surface2 }}>
          <Txt v="tiny" color={colors.textDim}>
            Spent together
          </Txt>
          <Txt v="display">{inr(totalPaise / 100)}</Txt>
          <Txt v="small" color={colors.textDim}>
            {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'} · {trip.travelers.length} travelers · planned {inr(plannedTotal, true)}
          </Txt>
          {myBal && (
            <View style={{ marginTop: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: myBal.net >= 0 ? colors.emeraldSoft : colors.roseSoft }}>
              <Txt v="small" color={myBal.net >= 0 ? colors.emerald : colors.rose}>
                {me?.shortName}: {myBal.net >= 0 ? `you get back ${inr(myBal.net / 100)}` : `you owe ${inr(-myBal.net / 100)}`}
              </Txt>
            </View>
          )}
          {byCategory.length > 0 && (
            <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: space.md }}>
              {byCategory.map(([c, v]) => (
                <View key={c} style={{ flex: v, backgroundColor: CATEGORY_META[c].color }} />
              ))}
            </View>
          )}
          <Row style={{ flexWrap: 'wrap', marginTop: space.sm }}>
            {byCategory.map(([c, v]) => (
              <Row key={c} gap={4}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: CATEGORY_META[c].color }} />
                <Txt v="small" color={colors.textDim} style={{ fontSize: 11 }}>
                  {CATEGORY_META[c].label} {inr(v / 100, true)}
                </Txt>
              </Row>
            ))}
          </Row>
        </Card>

        <SectionTitle title="Settle up" />
        {transfers.length === 0 ? (
          <Card>
            <Row>
              <Icon name="checkmark-circle" color={colors.emerald} />
              <Txt v="small" color={colors.textDim}>
                Everyone is square.
              </Txt>
            </Row>
          </Card>
        ) : (
          transfers.map((t) => {
            const from = trip.travelers.find((x) => x.id === t.from);
            const to = trip.travelers.find((x) => x.id === t.to);
            return (
              <Card key={`${t.from}-${t.to}`} style={{ marginBottom: space.sm }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row>
                    {from && <Avatar t={from} size={30} />}
                    <Icon name="arrow-forward" size={14} color={colors.textDim} />
                    {to && <Avatar t={to} size={30} />}
                    <View>
                      <Txt v="h3">{inr(t.amount / 100)}</Txt>
                      <Txt v="small" color={colors.textDim}>
                        {travelerName(trip, t.from)} pays {travelerName(trip, t.to)}
                      </Txt>
                    </View>
                  </Row>
                  <Pill
                    small
                    label="Settled"
                    icon="checkmark"
                    color={colors.emerald}
                    onPress={() => {
                      success();
                      put('settlements', { id: uid('st-'), tripId: trip.id, from: t.from, to: t.to, amountInrMinor: t.amount, settledAt: new Date().toISOString(), updatedBy: me?.id });
                    }}
                  />
                </Row>
              </Card>
            );
          })
        )}

        <SectionTitle title="Balances" />
        <Card>
          {bals.map((b) => {
            const t = trip.travelers.find((x) => x.id === b.travelerId);
            if (!t) return null;
            return (
              <Row key={b.travelerId} style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
                <Row>
                  <Avatar t={t} size={26} />
                  <Txt v="body">{t.shortName}</Txt>
                </Row>
                <View style={{ alignItems: 'flex-end' }}>
                  <Txt v="h3" color={b.net > 50 ? colors.emerald : b.net < -50 ? colors.rose : colors.textDim}>
                    {b.net > 50 ? '+' : ''}
                    {inr(b.net / 100)}
                  </Txt>
                  <Txt v="small" color={colors.textMute} style={{ fontSize: 11 }}>
                    paid {inr(b.paid / 100, true)} · share {inr(b.share / 100, true)}
                  </Txt>
                </View>
              </Row>
            );
          })}
        </Card>

        <SectionTitle title="Converter" />
        <CurrencyConverter currency={trip.currency} />

        <SectionTitle title={`Expenses (${expenses.length})`} />
        {expenses.length === 0 ? (
          <Empty icon="receipt-outline" title="No expenses yet" body="Tap + to log one. Everyone's phone updates live when you're online." />
        ) : (
          expenses.map((e) => {
            const meta = CATEGORY_META[e.category];
            const cur = e.currency === trip.currency.code ? trip.currency : { symbol: '₹', decimals: 2, code: 'INR' };
            const payer = trip.travelers.find((t) => t.id === e.paidBy);
            return (
              <Pressable key={e.id} onPress={() => router.push({ pathname: '/trip/[id]/expense', params: { id: trip.id, eid: e.id } })}>
                <Row style={{ paddingVertical: space.md, borderBottomWidth: 1, borderColor: colors.border }} gap={space.md}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={meta.icon} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt v="h3" numberOfLines={1}>
                      {e.title}
                    </Txt>
                    <Txt v="small" color={colors.textDim}>
                      {payer?.shortName ?? e.paidBy} paid · {e.splitWith.length === trip.travelers.length ? 'everyone' : `${e.splitWith.length} people`} · {shortDate(e.spentAt.slice(0, 10))}
                      {e.receiptPath ? ' · 🧾' : ''}
                    </Txt>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Txt v="h3">{formatMoney(fromMinor(e.amountMinor, cur), cur, { compact: true })}</Txt>
                    {e.currency !== 'INR' && (
                      <Txt v="small" color={colors.textDim}>
                        {inr(expenseInrMinor(e, cur) / 100)}
                      </Txt>
                    )}
                  </View>
                </Row>
              </Pressable>
            );
          })
        )}

        <SectionTitle title="Planned & prepaid" action={showBudget ? 'Hide' : 'Show'} onAction={() => setShowBudget((v) => !v)} />
        {showBudget &&
          trip.budget.map((b) => (
            <Row key={b.id} style={{ paddingVertical: space.sm, borderBottomWidth: 1, borderColor: colors.border }} gap={space.md}>
              <Icon name={CATEGORY_META[b.category].icon} color={CATEGORY_META[b.category].color} size={16} />
              <View style={{ flex: 1 }}>
                <Txt v="small">{b.label}</Txt>
                {b.note && (
                  <Txt v="small" color={colors.textMute} style={{ fontSize: 11 }}>
                    {b.note}
                  </Txt>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Txt v="small" style={{ fontWeight: '700' }}>
                  {b.amountInr ? inr(b.amountInr) : '—'}
                </Txt>
                <Txt v="tiny" style={{ fontSize: 9 }} color={b.status === 'paid' ? colors.emerald : b.status === 'placeholder' ? colors.rose : colors.gold}>
                  {b.status}
                </Txt>
              </View>
            </Row>
          ))}
        {showBudget && (
          <Txt v="small" color={colors.textMute} style={{ marginTop: space.sm }}>
            Prepaid bookings are not counted in the split until someone logs them as an expense with who paid.
          </Txt>
        )}
      </ScrollView>

      <View style={{ position: 'absolute', right: space.xl, bottom: space.xl }}>
        <Button label="Add" icon="add" onPress={() => router.push({ pathname: '/trip/[id]/expense', params: { id: trip.id } })} style={{ borderRadius: radius.pill, paddingHorizontal: space.xl, elevation: 6 }} />
      </View>
    </View>
  );
}
