import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Chip, IconButton, PrimaryButton, Segmented, Switch } from '@/components/controls';
import { DateField, FieldLabel, FormError, formStyles, MoneyField, TextField } from '@/components/form';
import { Icon } from '@/components/icon';
import { CountUp, Enter, ProgressBar } from '@/components/motion';
import { PressableScale } from '@/components/pressable-scale';
import { EmptyState, NewButton, Screen, StackHeader } from '@/components/screen';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/txt';
import { ListReflow, RowEnter, RowExit } from '@/constants/motion';
import { displayType, Radius } from '@/constants/theme';
import { digitsOnly, MaxAmount } from '@/data/account';
import { hasInstallment, installmentsPaid, isSettled, remaining, useLoans, type Loan, type LoanDirection, type NewLoan } from '@/data/loans';
import { useToast } from '@/data/toast';
import { useColors } from '@/hooks/use-colors';
import { useProfile } from '@/hooks/use-profile';
import { formatMoney } from '@/lib/format';
import { hapticSuccess } from '@/lib/haptics';
import { daysUntil, dueLabel } from '@/lib/recurring';
import { ensurePermission } from '@/lib/reminders';

type Tab = 'lent' | 'borrowed' | 'settled';

/** Two ledgers, like the IOU apps: money people owe you and money you owe. */
export default function Loans() {
  const { profile: p } = useProfile();
  const { loans, totals } = useLoans();
  const params = useLocalSearchParams<{ open?: string }>();
  const [tab, setTab] = useState<Tab>('lent');
  const [selected, setSelected] = useState<Loan | null>(null);
  const [creating, setCreating] = useState(false);
  const cur = p.currency;

  // Opened from a "Due soon" row: show that loan straight away (once loans have loaded).
  const [handled, setHandled] = useState<string | undefined>();
  if (params.open && params.open !== handled) {
    const l = loans.find((x) => x.id === params.open);
    if (l) {
      setHandled(params.open);
      setTab(isSettled(l) ? 'settled' : l.direction);
      setSelected(l);
    }
  }

  const shown = loans.filter((l) => (tab === 'settled' ? isSettled(l) : !isSettled(l) && l.direction === tab));
  const live = selected ? loans.find((l) => l.id === selected.id) ?? null : null;

  return (
    <Screen withNav={false}>
      <Enter index={0}>
        <StackHeader title="Loans" action={<NewButton label="Add" onPress={() => setCreating(true)} />} />
      </Enter>

      <Enter index={1} style={styles.totals}>
        <Total label="Owed to you" value={totals.owedToYou} currency={cur} tone="pos" onPress={() => setTab('lent')} />
        <Total label="You owe" value={totals.youOwe} currency={cur} tone="neg" onPress={() => setTab('borrowed')} />
      </Enter>

      {loans.length ? (
        <>
          <Enter index={2}>
            <Segmented<Tab>
              label="Show"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'lent', label: 'Lent' },
                { value: 'borrowed', label: 'Borrowed' },
                { value: 'settled', label: 'Settled' },
              ]}
            />
          </Enter>
          <Enter index={3} style={{ gap: 6 }}>
            {shown.length ? (
              shown.map((l) => (
                <Animated.View key={l.id} entering={RowEnter} exiting={RowExit} layout={ListReflow}>
                  <LoanRow loan={l} currency={cur} onPress={() => setSelected(l)} />
                </Animated.View>
              ))
            ) : (
              <Txt variant="small" color="ink3" style={{ textAlign: 'center', paddingVertical: 16 }}>
                {tab === 'settled' ? 'Settled loans show up here.' : tab === 'lent' ? 'Nobody owes you anything right now.' : 'You don’t owe anyone. Nice.'}
              </Txt>
            )}
          </Enter>
        </>
      ) : (
        <Enter index={2}>
          <EmptyState
            icon="handshake"
            title="No loans yet"
            body="Lent a friend some money, or borrowed from someone? Keep track here and tick off repayments as they come in. Monthly payments on money you borrowed come out of your budget."
            action="Add a loan"
            onAction={() => setCreating(true)}
          />
        </Enter>
      )}

      <LoanSheet loan={live} currency={cur} onClose={() => setSelected(null)} />
      <LoanEditor visible={creating} currency={cur} onClose={() => setCreating(false)} />
    </Screen>
  );
}

function Total({ label, value, currency, tone, onPress }: { label: string; value: number; currency: string; tone: 'pos' | 'neg'; onPress: () => void }) {
  const c = useColors();
  return (
    <PressableScale role="button" aria-label={`${label} ${formatMoney(value, currency)}`} onPress={onPress} containerStyle={{ flex: 1 }} style={[styles.total, { backgroundColor: c.surface }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={tone === 'pos' ? 'down' : 'up'} size={14} color={tone === 'pos' ? c.posInk : c.neg} />
        <Txt variant="label" color="ink2">
          {label}
        </Txt>
      </View>
      <CountUp value={value} currency={currency} style={displayType(30)} color={tone === 'pos' ? c.posInk : c.ink} numberOfLines={1} adjustsFontSizeToFit />
    </PressableScale>
  );
}

function LoanRow({ loan, currency, onPress }: { loan: Loan; currency: string; onPress: () => void }) {
  const c = useColors();
  const done = isSettled(loan);
  const late = !done && loan.due && daysUntil(loan.due) < 0;
  const lent = loan.direction === 'lent';
  return (
    <PressableScale role="button" aria-label={`${loan.person}, ${formatMoney(remaining(loan), currency)} left of ${formatMoney(loan.amount, currency)}. Open`} onPress={onPress} scaleTo={0.98} style={[styles.row, { backgroundColor: c.surface }]}>
      <View style={[styles.avatar, { backgroundColor: lent ? c.accentSoft : c.negSoft }]}>
        <Txt variant="bodyBold" color={lent ? c.accentInk : c.neg}>
          {loan.person.slice(0, 1).toUpperCase()}
        </Txt>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Txt variant="bodySemi" numberOfLines={1} style={{ flex: 1 }}>
            {loan.person}
          </Txt>
          <Txt variant="smallBold" color={done ? c.posInk : c.ink}>
            {done ? 'Settled' : `${formatMoney(remaining(loan), currency)} left`}
          </Txt>
        </View>
        <ProgressBar value={loan.amount ? loan.paid / loan.amount : 0} color={done ? c.pos : c.bar} track={c.track} height={6} />
        <Txt variant="caption" color={late ? c.neg : 'ink3'} numberOfLines={1}>
          {formatMoney(loan.paid, currency)} of {formatMoney(loan.amount, currency)} back
          {hasInstallment(loan) && !done ? ` · ${formatMoney(loan.installment!, currency)}/month` : ''}
          {loan.due && !done ? ` · ${dueLabel(loan.due)}` : ''}
          {loan.note ? ` · ${loan.note}` : ''}
        </Txt>
      </View>
    </PressableScale>
  );
}

/** One loan: record a repayment, or edit / delete it. */
function LoanSheet({ loan: open, currency, onClose }: { loan: Loan | null; currency: string; onClose: () => void }) {
  const c = useColors();
  const { recordPayment, deleteLoan } = useLoans();
  const { showToast } = useToast();
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'pay' | 'edit' | 'delete'>('pay');
  // Keeps showing the last loan while the sheet slides away.
  const [kept, setKept] = useState<Loan | null>(null);
  if (open && open !== kept) {
    if (open.id !== kept?.id) {
      setAmount('');
      setMode('pay');
    }
    setKept(open);
  }
  const loan = open ?? kept;
  if (!loan) return null;

  const left = remaining(loan);
  const value = Number(amount) || 0;
  const lent = loan.direction === 'lent';
  const done = isSettled(loan);

  return (
    <Sheet
      visible={!!open}
      onClose={onClose}
      title={loan.person}
      headerExtra={
        mode === 'pay' ? (
          <>
            <IconButton icon="edit" label="Edit loan" size={40} onPress={() => setMode('edit')} />
            <IconButton icon="trash" label="Delete loan" tone="danger" size={40} onPress={() => setMode('delete')} />
          </>
        ) : undefined
      }>
      {mode === 'edit' && <LoanForm loan={loan} currency={currency} onDone={() => setMode('pay')} />}
      {mode === 'delete' && (
        <>
          <Txt variant="body" color="ink2">
            Delete the loan with {loan.person}? Its {formatMoney(loan.paid, currency)} of repayments go with it.
          </Txt>
          <View style={formStyles.row}>
            <PrimaryButton label="Keep it" tone="soft" onPress={() => setMode('pay')} style={{ flex: 1 }} />
            <PrimaryButton
              label="Delete"
              tone="danger"
              style={{ flex: 1 }}
              onPress={() => {
                deleteLoan(loan.id);
                showToast(`Deleted the loan with ${loan.person}`);
                onClose();
              }}
            />
          </View>
        </>
      )}
      {mode === 'pay' && (
        <>
          <View style={[styles.detail, { backgroundColor: c.surface }]}>
            <Txt variant="small" color="ink2">
              {lent ? `You lent ${loan.person}` : `You borrowed from ${loan.person}`} {formatMoney(loan.amount, currency)}
            </Txt>
            <Txt style={displayType(36)} color={done ? c.posInk : c.ink}>
              {done ? 'All settled' : `${formatMoney(left, currency)} left`}
            </Txt>
            <ProgressBar value={loan.amount ? loan.paid / loan.amount : 0} color={done ? c.pos : c.bar} track={c.track} height={10} />
            <Txt variant="caption" color="ink3">
              {formatMoney(loan.paid, currency)} paid back{loan.due ? ` · ${dueLabel(loan.due)}` : ''}
              {loan.note ? ` · ${loan.note}` : ''}
            </Txt>
            {hasInstallment(loan) && (
              <Txt variant="smallBold">
                {formatMoney(loan.installment!, currency)} a month
                {loan.months ? ` · ${installmentsPaid(loan)} of ${loan.months} months paid` : ''} · set aside from your budget
              </Txt>
            )}
          </View>
          {!done && (
            <>
              <FieldLabel>{lent ? `How much did ${loan.person} pay back?` : `How much did you pay ${loan.person}?`}</FieldLabel>
              <View style={formStyles.chips}>
                {hasInstallment(loan) && loan.installment! < left && (
                  <Chip label={`Installment ${formatMoney(loan.installment!, currency)}`} selected={value === loan.installment} onPress={() => setAmount(String(loan.installment))} />
                )}
                <Chip label={`All ${formatMoney(left, currency)}`} selected={value === left} onPress={() => setAmount(String(left))} />
                {left >= 200 && <Chip label={`Half ${formatMoney(Math.round(left / 2), currency)}`} selected={value === Math.round(left / 2)} onPress={() => setAmount(String(Math.round(left / 2)))} />}
              </View>
              <MoneyField value={amount} onChange={setAmount} currency={currency} label="Repayment amount" />
              {value > left && <FormError>{`That’s more than the ${formatMoney(left, currency)} left.`}</FormError>}
              <PrimaryButton
                label={value > 0 ? `Record ${formatMoney(value, currency)}` : 'Choose an amount'}
                disabled={!(value > 0 && value <= left)}
                onPress={() => {
                  recordPayment(loan, value);
                  hapticSuccess();
                  setAmount('');
                  if (value >= left) onClose();
                }}
              />
            </>
          )}
        </>
      )}
    </Sheet>
  );
}

function LoanEditor({ visible, currency, onClose }: { visible: boolean; currency: string; onClose: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="New loan">
      {visible && <LoanForm currency={currency} onDone={onClose} />}
    </Sheet>
  );
}

/** Add or edit form, shared by the new-loan sheet and the loan sheet's edit mode. */
function LoanForm({ loan, currency, onDone }: { loan?: Loan; currency: string; onDone: () => void }) {
  const c = useColors();
  const { addLoan, updateLoan } = useLoans();
  const { showToast } = useToast();
  const [direction, setDirection] = useState<LoanDirection>(loan?.direction ?? 'lent');
  const [person, setPerson] = useState(loan?.person ?? '');
  const [amount, setAmount] = useState(loan ? String(loan.amount) : '');
  const [due, setDue] = useState<Date | null>(loan?.due ?? null);
  const [note, setNote] = useState(loan?.note ?? '');
  const [remind, setRemind] = useState(loan?.remind ?? false);
  const [monthly, setMonthly] = useState(!!loan && hasInstallment(loan));
  const [months, setMonths] = useState(loan?.months ? String(loan.months) : '');
  const [installment, setInstallment] = useState(loan?.installment ? String(loan.installment) : '');
  // Pre-filled from amount ÷ months until the user types their own installment.
  const [ownInstallment, setOwnInstallment] = useState(!!loan?.installment);
  const [error, setError] = useState('');

  const borrowed = direction === 'borrowed';
  const m = Number(months) || 0;
  const inst = Number(installment) || 0;
  const amt = Number(amount) || 0;

  function suggest(nextAmount: string, nextMonths: string) {
    if (ownInstallment) return;
    const a = Number(nextAmount) || 0;
    const n = Number(nextMonths) || 0;
    setInstallment(a > 0 && n > 0 ? String(Math.ceil(a / n)) : '');
  }

  function save() {
    const a = Number(amount);
    if (!person.trim()) return setError('Who is it with?');
    if (!(a > 0 && a <= MaxAmount)) return setError('Add the amount.');
    if (loan && a < loan.paid) return setError(`${formatMoney(loan.paid, currency)} is already paid back, so the amount can’t be lower than that.`);
    const withMonthly = borrowed && monthly;
    if (withMonthly && !(m >= 1 && m <= 120)) return setError('How many months will you take to pay it back? (1 to 120)');
    if (withMonthly && !(inst > 0 && inst <= a)) return setError('Add the monthly installment.');
    const next: NewLoan = {
      direction,
      person: person.trim(),
      amount: a,
      due,
      note: note.trim(),
      remind: remind && !!due,
      months: withMonthly ? m : null,
      installment: withMonthly ? inst : null,
    };
    if (loan) updateLoan(loan.id, next);
    else addLoan(next);
    hapticSuccess();
    showToast(loan ? 'Loan saved' : direction === 'lent' ? `${next.person} owes you ${formatMoney(a, currency)}` : `You owe ${next.person} ${formatMoney(a, currency)}`);
    onDone();
  }

  async function toggleRemind(v: boolean) {
    if (v && !(await ensurePermission())) return setError('Notifications are off for this app. Turn them on in your phone’s settings to get reminders.');
    setRemind(v);
  }

  return (
    <>
      <Segmented<LoanDirection>
        label="Direction"
        value={direction}
        onChange={setDirection}
        options={[
          { value: 'lent', label: 'I lent' },
          { value: 'borrowed', label: 'I borrowed' },
        ]}
      />
      <FieldLabel>{direction === 'lent' ? 'Who did you lend to?' : 'Who did you borrow from?'}</FieldLabel>
      <TextField value={person} onChangeText={(t) => { setPerson(t); setError(''); }} maxLength={40} placeholder="e.g. Kasun" aria-label="Person" autoCapitalize="words" />
      <FieldLabel>Amount</FieldLabel>
      <MoneyField value={amount} onChange={(v) => { setAmount(v); suggest(v, months); setError(''); }} currency={currency} label="Amount" />
      {borrowed && (
        <View style={[formStyles.row, styles.remind, { borderColor: c.line }]}>
          <Icon name="calendar" size={20} color={c.ink2} />
          <View style={{ flex: 1 }}>
            <Txt variant="bodySemi">Pay back monthly</Txt>
            <Txt variant="caption" color="ink3">
              The installment is set aside from your monthly budget.
            </Txt>
          </View>
          <Switch value={monthly} onChange={(v) => { setMonthly(v); setError(''); }} label="Pay back monthly" />
        </View>
      )}
      {borrowed && monthly && (
        <>
          <FieldLabel>Over how many months?</FieldLabel>
          <View style={formStyles.chips}>
            {[3, 6, 12, 24].map((n) => (
              <Chip key={n} role="radio" label={`${n} months`} selected={m === n} onPress={() => { setMonths(String(n)); suggest(amount, String(n)); setError(''); }} />
            ))}
          </View>
          <TextField
            value={months}
            onChangeText={(t) => { const v = digitsOnly(t).slice(0, 3); setMonths(v); suggest(amount, v); setError(''); }}
            keyboardType="number-pad"
            placeholder="Or type the months, e.g. 10"
            aria-label="Months"
          />
          <FieldLabel>Monthly installment</FieldLabel>
          <MoneyField value={installment} onChange={(v) => { setInstallment(v); setOwnInstallment(v !== ''); setError(''); }} currency={currency} label="Monthly installment" />
          {inst > 0 && m > 0 && amt > 0 && (
            <Txt variant="caption" color={inst * m < amt ? c.neg : 'ink2'}>
              {inst * m < amt
                ? `${m} × ${formatMoney(inst, currency)} is ${formatMoney(inst * m, currency)}, less than the ${formatMoney(amt, currency)} you owe.`
                : `${formatMoney(inst, currency)} a month for ${m} months.`}
            </Txt>
          )}
        </>
      )}
      <FieldLabel>Pay-back date (optional)</FieldLabel>
      <DateField value={due} onChange={setDue} label="Pay-back date" optional />
      <FieldLabel>Note (optional)</FieldLabel>
      <TextField value={note} onChangeText={setNote} maxLength={80} placeholder="e.g. Movie tickets" aria-label="Note" />
      {due && (
        <View style={[formStyles.row, styles.remind, { borderColor: c.line }]}>
          <Icon name="bell" size={20} color={c.ink2} />
          <View style={{ flex: 1 }}>
            <Txt variant="bodySemi">Remind me</Txt>
            <Txt variant="caption" color="ink3">
              A notification the day before.
            </Txt>
          </View>
          <Switch value={remind} onChange={toggleRemind} label="Remind me" />
        </View>
      )}
      <FormError>{error}</FormError>
      <PrimaryButton label={loan ? 'Save changes' : 'Add loan'} onPress={save} />
    </>
  );
}

const styles = StyleSheet.create({
  totals: { flexDirection: 'row', gap: 10 },
  total: { padding: 14, gap: 4, borderRadius: Radius.card - 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: Radius.row },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  detail: { padding: 16, gap: 8, borderRadius: Radius.card - 4 },
  remind: { paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1 },
});
