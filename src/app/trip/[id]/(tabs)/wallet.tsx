import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CurrencyConverter } from '@/components/converter';
import { Avatar, Button, Card, Empty, Icon, Pill, Row, SectionTitle, Sheet, Txt } from '@/components/ui';
import { budgetMarkId, budgetTotals, newCustomLineId, resolveBudget, type BudgetStatus, type BudgetView } from '@/lib/budget';
import { success } from '@/lib/haptics';
import { balances, expenseInrMinor, formatMoney, fromMinor, inr, settleUp } from '@/lib/money';
import { uid } from '@/lib/storage';
import { shortDate } from '@/lib/time';
import { travelerName, useMe } from '@/lib/trip';
import { useTripId } from '@/lib/trip-context';
import { useSyncRefresh } from '@/lib/use-sync-refresh';
import { liveRows, useLedger } from '@/store/ledger';
import { useTrip } from '@/store/trips';
import { colors, radius, space } from '@/theme';
import { CATEGORY_META } from '@/theme/categories';
import type { Expense } from '@/types/ledger';
import type { ExpenseCategory } from '@/types/trip';

const STATUS: Record<BudgetStatus, { label: string; color: string; soft: string }> = {
  paid: { label: 'Paid', color: colors.emerald, soft: colors.emeraldSoft },
  due: { label: 'To pay', color: colors.gold, soft: colors.goldSoft },
  estimate: { label: 'Estimate', color: colors.textDim, soft: 'rgba(148,163,184,0.14)' },
  placeholder: { label: 'Needs amount', color: colors.rose, soft: colors.roseSoft },
};

export default function Wallet() {
  const id = useTripId();
  const trip = useTrip(id)!;
  const insets = useSafeAreaInsets();
  const refreshControl = useSyncRefresh();
  const me = useMe(trip);
  const expensesRec = useLedger((s) => s.expenses);
  const settlementsRec = useLedger((s) => s.settlements);
  const marks = useLedger((s) => s.checklist);
  const put = useLedger((s) => s.put);
  const [tab, setTab] = useState<'spend' | 'plan'>('spend');
  const [showBalances, setShowBalances] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetView | 'new' | null>(null);

  const decimalsFor = (code: string) => (code === trip.currency.code ? trip.currency.decimals : 2);
  const expenses = useMemo(() => liveRows(expensesRec, trip.id).sort((a, b) => b.spentAt.localeCompare(a.spentAt) || b.updatedAt.localeCompare(a.updatedAt)), [expensesRec, trip.id]);
  const settlements = useMemo(() => liveRows(settlementsRec, trip.id), [settlementsRec, trip.id]);
  const bals = balances(trip.travelers.map((t) => t.id), expenses, settlements, decimalsFor);
  const transfers = settleUp(bals);
  const paise = (e: Expense) => expenseInrMinor(e, { decimals: decimalsFor(e.currency) });
  const totalPaise = expenses.reduce((n, e) => n + paise(e), 0);
  const myBal = bals.find((b) => b.travelerId === me?.id);

  const byCategory = useMemo(() => {
    const m = new Map<ExpenseCategory, number>();
    for (const e of expenses) m.set(e.category, (m.get(e.category) ?? 0) + paise(e));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses]);

  const byDay = useMemo(() => {
    const groups = new Map<string, Expense[]>();
    for (const e of expenses) {
      const d = e.spentAt.slice(0, 10);
      groups.set(d, [...(groups.get(d) ?? []), e]);
    }
    return [...groups.entries()];
  }, [expenses]);

  const lines = useMemo(() => resolveBudget(trip, marks), [trip, marks]);
  const totals = budgetTotals(lines);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView refreshControl={refreshControl} contentContainerStyle={{ padding: space.lg, paddingTop: insets.top + space.sm, paddingBottom: 130 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt v="h1">Wallet</Txt>
          <Pill small icon="swap-horizontal" label={`${trip.currency.code} ⇄ INR`} onPress={() => setConvertOpen(true)} />
        </Row>

        <Row style={{ marginTop: space.md, backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4 }} gap={4}>
          {(
            [
              ['spend', `Spending · ${expenses.length}`],
              ['plan', `Plan & prepaid · ${lines.length}`],
            ] as const
          ).map(([k, label]) => (
            <Pressable key={k} onPress={() => setTab(k)} style={{ flex: 1, paddingVertical: 9, borderRadius: radius.pill, alignItems: 'center', backgroundColor: tab === k ? colors.gold : 'transparent' }}>
              <Txt v="small" style={{ fontWeight: '700' }} color={tab === k ? colors.bg : colors.textDim}>
                {label}
              </Txt>
            </Pressable>
          ))}
        </Row>

        {tab === 'spend' ? (
          <>
            <Card style={{ marginTop: space.lg, backgroundColor: colors.surface2 }}>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                  <Txt v="tiny" color={colors.textDim}>
                    Spent together
                  </Txt>
                  <Txt v="display">{inr(totalPaise / 100)}</Txt>
                </View>
                {expenses.length > 0 && (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Txt v="tiny" color={colors.textDim}>
                      Per person
                    </Txt>
                    <Txt v="h3">{inr(totalPaise / 100 / Math.max(1, trip.travelers.length), true)}</Txt>
                  </View>
                )}
              </Row>
              {myBal && expenses.length > 0 && (
                <View style={{ marginTop: space.md, padding: space.sm, paddingHorizontal: space.md, borderRadius: radius.md, backgroundColor: myBal.net >= 0 ? colors.emeraldSoft : colors.roseSoft }}>
                  <Txt v="small" color={myBal.net >= 0 ? colors.emerald : colors.rose} style={{ fontWeight: '700' }}>
                    {me?.shortName}: {Math.abs(myBal.net) < 50 ? 'you are square' : myBal.net > 0 ? `you get back ${inr(myBal.net / 100)}` : `you owe ${inr(-myBal.net / 100)}`}
                  </Txt>
                </View>
              )}
              {byCategory.length > 0 && (
                <>
                  <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: space.md }}>
                    {byCategory.map(([c, v]) => (
                      <View key={c} style={{ flex: v, backgroundColor: CATEGORY_META[c].color }} />
                    ))}
                  </View>
                  <Row style={{ flexWrap: 'wrap', marginTop: space.sm, columnGap: space.md }}>
                    {byCategory.map(([c, v]) => (
                      <Row key={c} gap={4}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: CATEGORY_META[c].color }} />
                        <Txt v="small" color={colors.textDim} style={{ fontSize: 11 }}>
                          {CATEGORY_META[c].label} {inr(v / 100, true)}
                        </Txt>
                      </Row>
                    ))}
                  </Row>
                </>
              )}
            </Card>

            {transfers.length > 0 && (
              <>
                <SectionTitle title="Settle up" />
                <Card style={{ padding: space.md }}>
                  {transfers.map((t, i) => {
                    const from = trip.travelers.find((x) => x.id === t.from);
                    const to = trip.travelers.find((x) => x.id === t.to);
                    return (
                      <Row key={`${t.from}-${t.to}`} style={{ paddingVertical: space.sm, borderTopWidth: i ? 1 : 0, borderColor: colors.border }}>
                        {from && <Avatar t={from} size={28} />}
                        <Icon name="arrow-forward" size={13} color={colors.textDim} />
                        {to && <Avatar t={to} size={28} />}
                        <View style={{ flex: 1 }}>
                          <Txt v="small" style={{ fontWeight: '700' }}>
                            {travelerName(trip, t.from)} pays {travelerName(trip, t.to)}
                          </Txt>
                        </View>
                        <Txt v="h3">{inr(t.amount / 100)}</Txt>
                        <Pill
                          small
                          label="Done"
                          icon="checkmark"
                          color={colors.emerald}
                          onPress={() => {
                            success();
                            put('settlements', { id: uid('st-'), tripId: trip.id, from: t.from, to: t.to, amountInrMinor: t.amount, settledAt: new Date().toISOString(), updatedBy: me?.id });
                          }}
                        />
                      </Row>
                    );
                  })}
                </Card>
              </>
            )}

            <Pressable onPress={() => setShowBalances((v) => !v)}>
              <Row style={{ justifyContent: 'space-between', marginTop: space.lg }}>
                <Txt v="tiny" color={colors.textDim}>
                  Who paid what
                </Txt>
                <Icon name={showBalances ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textDim} />
              </Row>
            </Pressable>
            {showBalances && (
              <Card style={{ marginTop: space.sm, padding: space.md }}>
                {bals.map((b) => {
                  const t = trip.travelers.find((x) => x.id === b.travelerId);
                  if (!t) return null;
                  return (
                    <Row key={b.travelerId} style={{ justifyContent: 'space-between', paddingVertical: 5 }}>
                      <Row>
                        <Avatar t={t} size={24} />
                        <Txt v="small">{t.shortName}</Txt>
                      </Row>
                      <Txt v="small" color={colors.textDim}>
                        paid {inr(b.paid / 100, true)} · share {inr(b.share / 100, true)} ·{' '}
                        <Txt v="small" style={{ fontWeight: '700' }} color={b.net > 50 ? colors.emerald : b.net < -50 ? colors.rose : colors.textDim}>
                          {b.net > 50 ? '+' : ''}
                          {inr(b.net / 100, true)}
                        </Txt>
                      </Txt>
                    </Row>
                  );
                })}
              </Card>
            )}

            <SectionTitle title="Expenses" />
            {expenses.length === 0 ? (
              <Empty icon="receipt-outline" title="No expenses yet" body="Tap Add and type what you bought — the category is filled in for you. Everyone's phone updates live." />
            ) : (
              byDay.map(([date, list]) => {
                const dayIdx = trip.days.find((d) => d.date === date)?.index;
                const dayTotal = list.reduce((n, e) => n + paise(e), 0);
                return (
                  <View key={date} style={{ marginBottom: space.md }}>
                    <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                      <Txt v="small" color={colors.gold} style={{ fontWeight: '700' }}>
                        {dayIdx != null ? `Day ${dayIdx} · ` : ''}
                        {shortDate(date)}
                      </Txt>
                      <Txt v="small" color={colors.textDim}>
                        {inr(dayTotal / 100)}
                      </Txt>
                    </Row>
                    {list.map((e) => {
                      const meta = CATEGORY_META[e.category];
                      const cur = e.currency === trip.currency.code ? trip.currency : { symbol: '₹', decimals: 2, code: 'INR' };
                      const payer = trip.travelers.find((t) => t.id === e.paidBy);
                      return (
                        <Pressable key={e.id} onPress={() => router.push({ pathname: '/trip/[id]/expense', params: { id: trip.id, eid: e.id } })}>
                          <Row style={{ paddingVertical: space.sm, borderBottomWidth: 1, borderColor: colors.border }} gap={space.md}>
                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
                              <Icon name={meta.icon} color={meta.color} size={17} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Txt v="body" style={{ fontWeight: '600' }} numberOfLines={1}>
                                {e.title}
                              </Txt>
                              <Txt v="small" color={colors.textDim} style={{ fontSize: 12 }}>
                                {payer?.shortName ?? e.paidBy} paid · {e.splitWith.length === trip.travelers.length ? 'all' : `${e.splitWith.length} people`}
                                {e.receiptPath ? ' · 🧾' : ''}
                              </Txt>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Txt v="body" style={{ fontWeight: '700' }}>
                                {formatMoney(fromMinor(e.amountMinor, cur), cur, { compact: true })}
                              </Txt>
                              {e.currency !== 'INR' && (
                                <Txt v="small" color={colors.textMute} style={{ fontSize: 11 }}>
                                  {inr(paise(e) / 100)}
                                </Txt>
                              )}
                            </View>
                          </Row>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })
            )}
          </>
        ) : (
          <PlanTab lines={lines} totals={totals} onEdit={setEditing} />
        )}
      </ScrollView>

      <View style={{ position: 'absolute', right: space.xl, bottom: space.xl }}>
        {tab === 'spend' ? (
          <Button label="Add expense" icon="add" onPress={() => router.push({ pathname: '/trip/[id]/expense', params: { id: trip.id } })} style={{ borderRadius: radius.pill, paddingHorizontal: space.xl, elevation: 6 }} />
        ) : (
          <Button label="Add item" icon="add" onPress={() => setEditing('new')} style={{ borderRadius: radius.pill, paddingHorizontal: space.xl, elevation: 6 }} />
        )}
      </View>

      <Sheet visible={convertOpen} onClose={() => setConvertOpen(false)} title="Quick convert">
        <CurrencyConverter currency={trip.currency} bare />
      </Sheet>

      <LineSheet
        line={editing}
        onClose={() => setEditing(null)}
        onSave={(patch, line) => {
          const lineId = line === 'new' || !line ? newCustomLineId() : line.id;
          put('checklist', {
            id: budgetMarkId(trip.id, lineId),
            tripId: trip.id,
            itemId: `budget:${lineId}`,
            travelerId: '',
            done: false,
            updatedBy: me?.id,
            ...patch,
          });
          success();
          setEditing(null);
        }}
        onReset={(line) => {
          useLedger.getState().remove('checklist', line.markId);
          setEditing(null);
        }}
        onSplit={(line) => {
          setEditing(null);
          router.push({ pathname: '/trip/[id]/expense', params: { id: trip.id, title: line.label, amountInr: String(line.amountInr), cat: line.category } });
        }}
      />
    </View>
  );
}

function PlanTab({ lines, totals, onEdit }: { lines: BudgetView[]; totals: ReturnType<typeof budgetTotals>; onEdit: (l: BudgetView) => void }) {
  const groups: [BudgetStatus, string][] = [
    ['due', 'To pay'],
    ['placeholder', 'Needs an amount'],
    ['estimate', 'Estimates'],
    ['paid', 'Paid'],
  ];
  const pct = (n: number) => (totals.total ? n / totals.total : 0);
  return (
    <>
      <Card style={{ marginTop: space.lg, backgroundColor: colors.surface2 }}>
        <Txt v="tiny" color={colors.textDim}>
          Trip budget
        </Txt>
        <Txt v="display">{inr(totals.total)}</Txt>
        <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: space.md, backgroundColor: colors.border }}>
          <View style={{ flex: pct(totals.paid) || 0.0001, backgroundColor: colors.emerald }} />
          <View style={{ flex: pct(totals.due) || 0.0001, backgroundColor: colors.gold }} />
          <View style={{ flex: pct(totals.estimate) || 0.0001, backgroundColor: colors.textMute }} />
        </View>
        <Row style={{ marginTop: space.md, justifyContent: 'space-between' }}>
          <Stat color={colors.emerald} label="Paid" value={totals.paid} />
          <Stat color={colors.gold} label="To pay" value={totals.due} />
          <Stat color={colors.textDim} label="Estimate" value={totals.estimate} />
        </Row>
        {totals.needsAmount > 0 && (
          <Txt v="small" color={colors.rose} style={{ marginTop: space.sm }}>
            {totals.needsAmount} item{totals.needsAmount > 1 ? 's' : ''} still need an amount — tap them to fill in.
          </Txt>
        )}
      </Card>
      <Txt v="small" color={colors.textMute} style={{ marginTop: space.sm }}>
        Tap any line to change its amount or mark it paid. Edits sync to everyone.
      </Txt>

      {groups.map(([st, title]) => {
        const items = lines.filter((l) => l.status === st);
        if (!items.length) return null;
        return (
          <View key={st}>
            <SectionTitle title={`${title} · ${items.length}`} />
            {items.map((l) => (
              <Pressable key={l.id} onPress={() => onEdit(l)}>
                <Row style={{ paddingVertical: space.sm + 2, borderBottomWidth: 1, borderColor: colors.border }} gap={space.md}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: STATUS[l.status].soft, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={CATEGORY_META[l.category].icon} color={STATUS[l.status].color} size={17} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt v="body" style={{ fontWeight: '600' }} numberOfLines={2}>
                      {l.label}
                    </Txt>
                    {l.note && (
                      <Txt v="small" color={colors.textMute} style={{ fontSize: 12 }} numberOfLines={1}>
                        {l.note}
                      </Txt>
                    )}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Txt v="body" style={{ fontWeight: '700' }} color={l.amountInr ? colors.text : colors.rose}>
                      {l.amountInr ? inr(l.amountInr) : '—'}
                    </Txt>
                    {l.edited || l.custom ? (
                      <Txt v="tiny" color={colors.gold} style={{ fontSize: 9 }}>
                        {l.custom ? 'added' : 'edited'}
                      </Txt>
                    ) : null}
                  </View>
                  <Icon name="chevron-forward" size={14} color={colors.textMute} />
                </Row>
              </Pressable>
            ))}
          </View>
        );
      })}
    </>
  );
}

function Stat({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <View>
      <Row gap={5}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Txt v="small" color={colors.textDim} style={{ fontSize: 11 }}>
          {label}
        </Txt>
      </Row>
      <Txt v="h3">{inr(value, true)}</Txt>
    </View>
  );
}

type Patch = { amountInr: number; status: BudgetStatus; note?: string; label?: string; category?: ExpenseCategory };

function LineSheet({
  line,
  onClose,
  onSave,
  onReset,
  onSplit,
}: {
  line: BudgetView | 'new' | null;
  onClose: () => void;
  onSave: (p: Patch, line: BudgetView | 'new' | null) => void;
  onReset: (l: BudgetView) => void;
  onSplit: (l: BudgetView) => void;
}) {
  const isNew = line === 'new';
  const base = line && line !== 'new' ? line : null;
  return (
    <Sheet visible={line != null} onClose={onClose} title={isNew ? 'Add planned item' : 'Edit line'}>
      {line != null && <LineForm key={base?.id ?? 'new'} base={base} isNew={isNew} onSave={(p) => onSave(p, line)} onReset={onReset} onSplit={onSplit} />}
    </Sheet>
  );
}

function LineForm({ base, isNew, onSave, onReset, onSplit }: { base: BudgetView | null; isNew: boolean; onSave: (p: Patch) => void; onReset: (l: BudgetView) => void; onSplit: (l: BudgetView) => void }) {
  const [label, setLabel] = useState(base?.label ?? '');
  const [amount, setAmount] = useState(base?.amountInr ? String(base.amountInr) : '');
  const [status, setStatus] = useState<BudgetStatus>(base?.status === 'placeholder' ? 'estimate' : (base?.status ?? 'estimate'));
  const [category, setCategory] = useState<ExpenseCategory>(base?.category ?? 'other');
  const [note, setNote] = useState(base?.note ?? '');
  const value = Number(amount.replace(/,/g, '')) || 0;
  const editableLabel = isNew || base?.custom;
  const valid = (editableLabel ? label.trim().length > 0 : true) && value >= 0;

  return (
    <View>
      {editableLabel ? (
        <TextInput value={label} onChangeText={setLabel} placeholder="What is it? e.g. Travel pillow" placeholderTextColor={colors.textMute} style={inputStyle} />
      ) : (
        <Txt v="h3" style={{ marginBottom: space.sm }}>
          {base?.label}
        </Txt>
      )}
      <Row style={{ backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: space.lg, marginTop: space.sm, borderWidth: 1, borderColor: colors.border }}>
        <Txt v="h2" color={colors.gold}>
          ₹
        </Txt>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Amount" placeholderTextColor={colors.textMute} autoFocus={isNew || !base?.amountInr} style={{ flex: 1, color: colors.text, fontSize: 28, fontWeight: '800', paddingVertical: space.md }} />
      </Row>

      <Txt v="tiny" color={colors.textDim} style={{ marginTop: space.lg, marginBottom: space.sm }}>
        Status
      </Txt>
      <Row>
        {(['paid', 'due', 'estimate'] as const).map((s) => (
          <Pill key={s} label={STATUS[s].label} color={STATUS[s].color} active={status === s} onPress={() => setStatus(s)} icon={s === 'paid' ? 'checkmark-circle' : s === 'due' ? 'time-outline' : 'help-circle-outline'} />
        ))}
      </Row>

      {isNew && (
        <>
          <Txt v="tiny" color={colors.textDim} style={{ marginTop: space.lg, marginBottom: space.sm }}>
            Category
          </Txt>
          <Row style={{ flexWrap: 'wrap' }}>
            {(Object.keys(CATEGORY_META) as ExpenseCategory[]).map((c) => (
              <Pill key={c} small label={CATEGORY_META[c].label} icon={CATEGORY_META[c].icon} color={CATEGORY_META[c].color} active={category === c} onPress={() => setCategory(c)} />
            ))}
          </Row>
        </>
      )}

      <TextInput value={note} onChangeText={setNote} placeholder="Note (optional)" placeholderTextColor={colors.textMute} style={[inputStyle, { marginTop: space.lg }]} />

      <Button label="Save" icon="checkmark" disabled={!valid} onPress={() => onSave({ amountInr: value, status, note: note.trim() || undefined, ...(editableLabel ? { label: label.trim(), category } : {}) })} style={{ marginTop: space.lg }} />
      {base && value > 0 && (
        <Button kind="ghost" label="Split this between the family" icon="people" onPress={() => onSplit({ ...base, amountInr: value, label: editableLabel ? label : base.label })} style={{ marginTop: space.sm }} />
      )}
      {base && (base.edited || base.custom) && (
        <Button
          kind="ghost"
          label={base.custom ? 'Delete item' : 'Reset to original'}
          icon={base.custom ? 'trash-outline' : 'refresh'}
          onPress={() =>
            base.custom
              ? Alert.alert('Delete this item?', 'It disappears for everyone.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => onReset(base) },
                ])
              : onReset(base)
          }
          style={{ marginTop: space.sm }}
        />
      )}
    </View>
  );
}

const inputStyle = { color: colors.text, fontSize: 16, padding: space.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border } as const;
