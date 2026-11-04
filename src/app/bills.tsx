import { useRef, useState, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Chip, IconButton, PrimaryButton, Segmented, Switch } from '@/components/controls';
import { DateField, FieldLabel, FormError, formStyles, MoneyField, TextField } from '@/components/form';
import { Icon } from '@/components/icon';
import { CountUp, Enter } from '@/components/motion';
import { PressableScale } from '@/components/pressable-scale';
import { EmptyState, NewButton, Screen, StackHeader } from '@/components/screen';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/txt';
import { ListReflow, RowEnter, RowExit } from '@/constants/motion';
import { Radius } from '@/constants/theme';
import { MaxAmount } from '@/data/account';
import { isPaid, useBills, type Bill, type BillKind, type NewBill } from '@/data/bills';
import { ExpenseCategories, ExpenseIds, type ExpenseCategory } from '@/data/categories';
import { useToast } from '@/data/toast';
import { useMonth } from '@/data/month';
import { useColors } from '@/hooks/use-colors';
import { useProfile } from '@/hooks/use-profile';
import { addDays, formatMoney } from '@/lib/format';
import { hapticSuccess } from '@/lib/haptics';
import { CycleIds, Cycles, daysUntil, dueLabel, monthlyCost, type Cycle } from '@/lib/recurring';
import { ensurePermission } from '@/lib/reminders';

/** Common charges, to fill the form in one tap. Plain names, no logos. A–Z, then "Other". */
type QuickBill = { name: string; kind: BillKind; category: ExpenseCategory };
const Quick = ([
  { name: 'Apple Subscriptions', kind: 'subscription', category: 'fun' },
  { name: 'Netflix', kind: 'subscription', category: 'fun' },
  { name: 'Spotify', kind: 'subscription', category: 'fun' },
  { name: 'YouTube Premium', kind: 'subscription', category: 'fun' },
  { name: 'Mobile reload', kind: 'bill', category: 'bills' },
  { name: 'Internet', kind: 'bill', category: 'bills' },
  { name: 'Electricity', kind: 'bill', category: 'bills' },
  { name: 'Water', kind: 'bill', category: 'bills' },
  { name: 'Rent', kind: 'bill', category: 'bills' },
  { name: 'Gym', kind: 'subscription', category: 'health' },
  { name: 'Bus pass', kind: 'bill', category: 'transport' },
] satisfies QuickBill[]).sort((a, b) => a.name.localeCompare(b.name)) as QuickBill[];

type BillsView = 'upcoming' | 'all';

export default function Bills() {
  const c = useColors();
  const { committed } = useMonth();
  const { profile: p } = useProfile();
  const { bills, monthly, markPaid } = useBills();
  const [view, setView] = useState<BillsView>('upcoming');
  const [editing, setEditing] = useState<Bill | 'new' | null>(null);
  const cur = p.currency;
  const shown = view === 'upcoming' ? bills.filter((b) => daysUntil(b.nextDue) <= 31) : bills;

  return (
    <Screen withNav={false}>
      <Enter index={0}>
        <StackHeader title="Bills & subs" action={<NewButton label="Add" onPress={() => setEditing('new')} />} />
      </Enter>

      {bills.length ? (
        <>
          <Enter index={1} style={[styles.sum, { backgroundColor: c.hero }]}>
            <Txt variant="label" color={c.heroInk2}>
              Repeating costs
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <CountUp value={monthly.total} currency={cur} variant="display" color={c.lime} />
              <Txt variant="smallBold" color={c.heroInk2}>
                a month
              </Txt>
            </View>
            <View style={styles.split}>
              <Split label="Subscriptions" value={formatMoney(monthly.subscriptions, cur)} />
              <Split label="Bills" value={formatMoney(monthly.bills, cur)} />
              <Split label="A year" value={formatMoney(monthly.total * 12, cur)} />
            </View>
            {committed.bills > 0 && (
              <Txt variant="caption" color={c.heroInk2}>
                {formatMoney(committed.bills, cur)} still due this month is set aside from your monthly budget.
              </Txt>
            )}
          </Enter>

          <Enter index={2}>
            <Segmented<BillsView>
              label="Show"
              value={view}
              onChange={setView}
              options={[
                { value: 'upcoming', label: 'Next 30 days' },
                { value: 'all', label: `All ${bills.length}` },
              ]}
            />
          </Enter>

          <Enter index={3} style={{ gap: 6 }}>
            {shown.length ? (
              shown.map((b) => (
                <Animated.View key={b.id} entering={RowEnter} exiting={RowExit} layout={ListReflow}>
                  <BillRow bill={b} currency={cur} onPress={() => setEditing(b)} onPaid={() => markPaid(b)} />
                </Animated.View>
              ))
            ) : (
              <Txt variant="small" color="ink3" style={{ textAlign: 'center', paddingVertical: 16 }}>
                Nothing due in the next 30 days.
              </Txt>
            )}
          </Enter>
        </>
      ) : (
        <Enter index={1}>
          <EmptyState
            icon="repeat"
            title="No bills yet"
            body="Add what comes round every week, month or year: reloads, internet, rent, Netflix. Tap Pay when it’s done and it goes into your spending."
            action="Add a bill"
            onAction={() => setEditing('new')}
          />
        </Enter>
      )}

      <BillEditor bill={editing} currency={cur} onClose={() => setEditing(null)} />
    </Screen>
  );
}

function Split({ label, value }: { label: string; value: string }) {
  const c = useColors();
  return (
    <View style={[styles.splitTile, { backgroundColor: c.heroTile }]}>
      <Txt variant="caption" color={c.heroInk2}>
        {label}
      </Txt>
      <Txt variant="smallBold" color={c.heroInk} numberOfLines={1}>
        {value}
      </Txt>
    </View>
  );
}

function BillRow({ bill, currency, onPress, onPaid }: { bill: Bill; currency: string; onPress: () => void; onPaid: () => void }) {
  const c = useColors();
  const days = daysUntil(bill.nextDue);
  const late = days < 0;
  const soon = days <= 3;
  const color = c.cat[bill.category];
  return (
    <PressableScale role="button" aria-label={`${bill.name}, ${formatMoney(bill.amount, currency)} ${Cycles[bill.cycle].per}, ${dueLabel(bill.nextDue)}. Edit`} onPress={onPress} scaleTo={0.98} style={[styles.row, { backgroundColor: c.surface }]}>
      <View style={[styles.ic, { backgroundColor: color + '24' }]}>
        <Icon name={bill.kind === 'subscription' ? 'repeat' : ExpenseCategories[bill.category].icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Txt variant="bodySemi" numberOfLines={1}>
          {bill.name}
        </Txt>
        <Txt variant="caption" color={late ? c.neg : soon ? c.accentInk : c.ink3} numberOfLines={1}>
          {formatMoney(bill.amount, currency)} {Cycles[bill.cycle].per} · {dueLabel(bill.nextDue)}
          {bill.remind ? ' · Reminder on' : ''}
        </Txt>
      </View>
      {isPaid(bill) ? (
        <View aria-label={`${bill.name} paid`} style={[styles.paid, styles.paidOn, { backgroundColor: c.pos + '24' }]}>
          <Icon name="check" size={15} color={c.posInk} strokeWidth={2.6} />
          <Txt variant="smallBold" color={c.posInk}>
            Paid
          </Txt>
        </View>
      ) : (
        <PressableScale role="button" aria-label={`Pay ${bill.name}`} onPress={onPaid} style={[styles.paid, { backgroundColor: c.negSoft }]}>
          <Txt variant="smallBold" color={c.neg}>
            Pay
          </Txt>
        </PressableScale>
      )}
    </PressableScale>
  );
}

function BillEditor({ bill, currency, onClose }: { bill: Bill | 'new' | null; currency: string; onClose: () => void }) {
  const c = useColors();
  const { addBill, updateBill, deleteBill } = useBills();
  const { showToast } = useToast();
  const isNew = bill === 'new';
  const existing = bill && bill !== 'new' ? bill : null;
  const [key, setKey] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<BillKind>('bill');
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [category, setCategory] = useState<ExpenseCategory>('bills');
  const [due, setDue] = useState<Date>(addDays(new Date(), 7));
  const [remind, setRemind] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [wasNew, setWasNew] = useState(true);
  const [other, setOther] = useState(false);
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);

  // Reset the form whenever a different bill (or "new") is opened.
  const openKey = bill === null ? null : isNew ? 'new' : existing!.id;
  // Closing keeps the fields as they were, so the sheet doesn't blank while it slides away.
  if (openKey === null && key !== null) setKey(null);
  if (openKey !== null && openKey !== key) {
    setKey(openKey);
    setWasNew(isNew);
    setName(existing?.name ?? '');
    setAmount(existing ? String(existing.amount) : '');
    setKind(existing?.kind ?? 'bill');
    setCycle(existing?.cycle ?? 'monthly');
    setCategory(existing?.category ?? 'bills');
    setDue(existing?.nextDue ?? addDays(new Date(), 7));
    setRemind(existing?.remind ?? false);
    setError('');
    setConfirmDelete(false);
    setOther(false);
  }

  function save() {
    const a = Number(amount);
    if (!name.trim()) return setError('Give it a name, like “Internet”.');
    if (!(a > 0 && a <= MaxAmount)) return setError('Add the amount it costs each time.');
    const next: NewBill = { name: name.trim(), amount: a, kind, cycle, category, nextDue: due, remind };
    if (existing) updateBill(existing.id, next);
    else addBill(next);
    hapticSuccess();
    showToast(`${existing ? 'Saved' : 'Added'} ${next.name} · ${formatMoney(monthlyCost(a, cycle), currency)} a month`);
    onClose();
  }

  async function toggleRemind(v: boolean) {
    if (v && !(await ensurePermission())) {
      setError('Notifications are off for this app. Turn them on in your phone’s settings to get reminders.');
      return;
    }
    setRemind(v);
  }

  return (
    <Sheet
      visible={!!bill}
      onClose={onClose}
      title={(bill ? isNew : wasNew) ? 'New bill' : 'Edit bill'}
      headerExtra={existing ? <IconButton icon="trash" label="Delete this bill" tone="danger" size={40} onPress={() => setConfirmDelete(true)} /> : undefined}>
      {confirmDelete && existing ? (
        <>
          <Txt variant="body" color="ink2">
            Delete “{existing.name}”? Payments you already logged stay in History.
          </Txt>
          <View style={formStyles.row}>
            <PrimaryButton label="Keep it" tone="soft" onPress={() => setConfirmDelete(false)} style={{ flex: 1 }} />
            <PrimaryButton
              label="Delete"
              tone="danger"
              style={{ flex: 1 }}
              onPress={() => {
                deleteBill(existing.id);
                showToast(`Deleted ${existing.name}`);
                onClose();
              }}
            />
          </View>
        </>
      ) : (
        <>
          {isNew && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {Quick.map((q) => (
                <Chip
                  key={q.name}
                  label={q.name}
                  selected={!other && name === q.name}
                  onPress={() => {
                    setOther(false);
                    setName(q.name);
                    setKind(q.kind);
                    setCategory(q.category);
                    setError('');
                  }}
                />
              ))}
              <Chip
                label="Other"
                icon="plus"
                selected={other}
                onPress={() => {
                  setOther(true);
                  setName('');
                  setCategory('other');
                  setError('');
                  nameRef.current?.focus();
                }}
              />
            </ScrollView>
          )}
          <FieldLabel>Name</FieldLabel>
          <TextField ref={nameRef} value={name} onChangeText={(t) => { setName(t); setError(''); }} maxLength={40} placeholder={other ? 'What is it?' : 'e.g. Internet'} aria-label="Bill name" />
          <FieldLabel>Amount each time</FieldLabel>
          <MoneyField value={amount} onChange={(v) => { setAmount(v); setError(''); }} currency={currency} label="Amount" />
          <Segmented<BillKind>
            label="Type"
            small
            value={kind}
            onChange={setKind}
            options={[
              { value: 'bill', label: 'Bill' },
              { value: 'subscription', label: 'Subscription' },
            ]}
          />
          <FieldLabel>How often</FieldLabel>
          <View style={formStyles.chips} role="radiogroup" aria-label="How often">
            {CycleIds.map((cy) => (
              <Chip key={cy} role="radio" label={Cycles[cy].label} selected={cycle === cy} onPress={() => setCycle(cy)} />
            ))}
          </View>
          <FieldLabel>Category</FieldLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {ExpenseIds.map((id) => (
              <Chip key={id} role="radio" icon={ExpenseCategories[id].icon} label={ExpenseCategories[id].short} selected={category === id} onPress={() => setCategory(id)} />
            ))}
          </ScrollView>
          <FieldLabel>Next due</FieldLabel>
          <DateField value={due} onChange={(d) => d && setDue(d)} label="Next due" />
          <View style={[formStyles.row, styles.remind, { borderColor: c.line }]}>
            <Icon name="bell" size={20} color={c.ink2} />
            <View style={{ flex: 1 }}>
              <Txt variant="bodySemi">Remind me</Txt>
              <Txt variant="caption" color="ink3">
                A notification the day before it’s due.
              </Txt>
            </View>
            <Switch value={remind} onChange={toggleRemind} label="Remind me" />
          </View>
          <FormError>{error}</FormError>
          <PrimaryButton label={existing ? 'Save changes' : 'Add bill'} onPress={save} />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sum: { borderRadius: Radius.card, padding: 18, gap: 6 },
  split: { flexDirection: 'row', gap: 8, marginTop: 6 },
  splitTile: { flex: 1, padding: 10, borderRadius: 14, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: Radius.row },
  ic: { width: 42, height: 42, borderRadius: Radius.icon, alignItems: 'center', justifyContent: 'center' },
  paid: { minHeight: 38, minWidth: 64, paddingHorizontal: 14, borderRadius: 99, alignItems: 'center', justifyContent: 'center' },
  paidOn: { flexDirection: 'row', gap: 4, paddingHorizontal: 12 },
  remind: { paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1 },
});
