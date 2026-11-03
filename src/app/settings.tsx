import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip, IconButton, PrimaryButton, Segmented, Switch } from '@/components/controls';
import { Icon, type IconName } from '@/components/icon';
import { KeyboardBar } from '@/components/keyboard-bar';
import { Enter } from '@/components/motion';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/txt';
import { displayType, Fonts, Gutter, MaxContentWidth, Radius } from '@/constants/theme';
import { Currencies, digitsOnly, parseAmount, useAccount, type ThemePref } from '@/data/account';
import { ExpenseCategories, ExpenseIds, FrequencyIds, IncomeFrequencies, Statuses, StatusIds, usualAmountLabel, type ExpenseCategory } from '@/data/categories';
import { useBills } from '@/data/bills';
import { useGoals } from '@/data/goals';
import { useLists } from '@/data/lists';
import { useLoans } from '@/data/loans';
import { useMonth } from '@/data/month';
import { usePlans } from '@/data/plans';
import { useToast } from '@/data/toast';
import { useTransactions } from '@/data/transactions';
import { useColors } from '@/hooks/use-colors';
import { useProfile } from '@/hooks/use-profile';
import { exportCsv } from '@/lib/csv';
import { ordinal } from '@/lib/format';

function Group({ title, children, index }: { title: string; children: ReactNode; index: number }) {
  const c = useColors();
  return (
    <Enter index={index} style={{ gap: 8 }}>
      <Txt variant="section" color="ink2" style={{ paddingHorizontal: 6 }} role="heading">
        {title}
      </Txt>
      <View style={[styles.group, { backgroundColor: c.surface }]}>{children}</View>
    </Enter>
  );
}

function Row({ icon, label, hint, right, onPress, danger, first }: { icon: IconName; label: string; hint?: string; right?: ReactNode; onPress?: () => void; danger?: boolean; first?: boolean }) {
  const c = useColors();
  const body = (
    <>
      <View style={[styles.rowIc, { backgroundColor: danger ? c.negSoft : c.surface2 }]}>
        <Icon name={icon} size={18} color={danger ? c.neg : c.ink2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt variant="bodySemi" color={danger ? c.neg : c.ink}>
          {label}
        </Txt>
        {hint && (
          <Txt variant="caption" color="ink3">
            {hint}
          </Txt>
        )}
      </View>
      {right}
    </>
  );
  const style = [styles.row, !first && { borderTopWidth: 1, borderTopColor: c.line }];
  return onPress ? (
    <Pressable role="button" onPress={onPress} style={({ pressed }) => [...style, pressed && { backgroundColor: c.surface2 }]}>
      {body}
    </Pressable>
  ) : (
    <View style={style}>{body}</View>
  );
}

/** A number box that saves when you leave it. Empty clears the value. */
function AmountInput({ value, onSave, label, placeholder = 'None' }: { value: number | null | undefined; onSave: (v: number | null) => void; label: string; placeholder?: string }) {
  const c = useColors();
  const { profile: p } = useProfile();
  const [text, setText] = useState(value ? String(value) : '');
  return (
    <View style={[styles.amountBox, { borderColor: c.line2, backgroundColor: c.bg }]}>
      <Txt variant="caption" color="ink3">
        {p.currency}
      </Txt>
      <TextInput
        value={text}
        onChangeText={(t) => setText(digitsOnly(t))}
        onEndEditing={() => {
          const v = parseAmount(text);
          if (v === undefined) setText(value ? String(value) : '');
          else if ((v ?? null) !== (value ?? null)) onSave(v);
        }}
        keyboardType="number-pad"
        returnKeyType="done"
        placeholder={placeholder}
        placeholderTextColor={c.ink3}
        aria-label={label}
        style={[styles.amountInput, { color: c.ink }]}
      />
    </View>
  );
}

export default function Settings() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { profile: p, status: st } = useProfile();
  const { updateProfile, deleteProfile } = useAccount();
  const { transactions, clearAll: clearTx } = useTransactions();
  const { clearAll: clearGoals } = useGoals();
  const { clearAll: clearBills } = useBills();
  const { clearAll: clearLoans } = useLoans();
  const { clearAll: clearLists } = useLists();
  const { clearAll: clearPlans } = usePlans();
  const { clearAll: clearMonths } = useMonth();
  const { showToast } = useToast();
  const [name, setName] = useState(p.name);
  const [budgetsOpen, setBudgetsOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const word = st.word.toLowerCase();
  const setCount = Object.values(p.catBudgets).filter((v) => (v ?? 0) > 0).length;

  const save = (changes: Parameters<typeof updateProfile>[0], message = 'Saved') => {
    updateProfile(changes).then(() => showToast(message), () => showToast('Couldn’t save. Check your connection.'));
  };

  async function reset() {
    setResetting(true);
    try {
      await clearTx();
      await Promise.all([clearGoals(), clearBills(), clearLoans(), clearLists(), clearPlans(), clearMonths()]);
      await deleteProfile();
      // The router moves to onboarding on its own once the profile is gone.
    } catch {
      setResetting(false);
      showToast('Couldn’t delete everything. Try again when you’re online.');
    }
  }

  let i = 0;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAwareScrollView bottomOffset={62} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: Math.max(28, insets.bottom + 20) }]} keyboardShouldPersistTaps="handled">
        <Enter index={i++} style={styles.head}>
          <IconButton icon="back" label="Back" onPress={() => router.back()} />
          <Txt variant="title" role="heading">
            Settings
          </Txt>
        </Enter>

        <Enter index={i++} style={[styles.profile, { backgroundColor: c.surface }]}>
          <View style={[styles.avatar, { backgroundColor: c.lime }]}>
            <Txt style={displayType(30)} color={c.inkFixed}>
              {(p.name || '?').slice(0, 1).toUpperCase()}
            </Txt>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Txt variant="name" style={displayType(30)} numberOfLines={1}>
              {p.name}
            </Txt>
            <View style={[styles.badge, { backgroundColor: c.accentSoft }]}>
              <Icon name={st.icon} size={14} color={c.accentInk} />
              <Txt variant="caption" color={c.accentInk} style={{ fontFamily: Fonts.bold }}>
                {st.label}
              </Txt>
            </View>
          </View>
        </Enter>

        <Group title="Account" index={i++}>
          <Row
            first
            icon="user"
            label="Name"
            right={
              <TextInput
                value={name}
                onChangeText={setName}
                onEndEditing={() => {
                  const n = name.trim();
                  if (!n) setName(p.name);
                  else if (n !== p.name) save({ name: n });
                }}
                maxLength={24}
                aria-label="Name"
                style={[styles.nameInput, { color: c.ink, borderColor: c.line2, backgroundColor: c.bg }]}
              />
            }
          />
          <View style={[styles.rowCol, { borderTopColor: c.line }]}>
            <Txt variant="bodySemi">I am</Txt>
            <Txt variant="caption" color="ink3">
              Changes how income is shown. Nothing is deleted.
            </Txt>
            <View style={styles.chips} role="radiogroup" aria-label="Status">
              {StatusIds.map((s) => (
                <Chip
                  key={s}
                  role="radio"
                  icon={Statuses[s].icon}
                  label={Statuses[s].label}
                  selected={p.status === s}
                  onPress={() =>
                    save(
                      {
                        status: s,
                        ...(Statuses[s].incomeDefault && !p.incomeEnabled ? { incomeEnabled: true } : {}),
                        // Follow the new status unless the user picked a frequency of their own.
                        ...(p.incomeFrequency === Statuses[p.status].frequencyDefault ? { incomeFrequency: Statuses[s].frequencyDefault } : {}),
                      },
                      `Status set to ${Statuses[s].label}`
                    )
                  }
                />
              ))}
            </View>
          </View>
          <Row
            icon="wallet"
            label={`Track ${word}`}
            hint={p.status === 'student' ? 'Optional. Turn on if you get pocket money.' : 'Shows money in and your net balance on Home.'}
            right={<Switch value={p.incomeEnabled} label={`Track ${word}`} onChange={(v) => save({ incomeEnabled: v, ...(v && p.incomeFrequency === 'monthly' && !p.payday ? { payday: 25 } : {}) })} />}
          />
          {p.incomeEnabled && (
            <Animated.View entering={FadeIn} exiting={FadeOut} layout={LinearTransition}>
              <View style={[styles.rowCol, { borderTopColor: c.line }]}>
                <Txt variant="bodySemi">How often it comes in</Txt>
                <Txt variant="caption" color="ink3">
                  Log it every time you get it. Home adds it all up for the month.
                </Txt>
                <View style={styles.chips} role="radiogroup" aria-label="How often money comes in">
                  {FrequencyIds.map((f) => (
                    <Chip
                      key={f}
                      role="radio"
                      label={IncomeFrequencies[f].label}
                      selected={p.incomeFrequency === f}
                      onPress={() => save({ incomeFrequency: f, ...(f === 'monthly' && !p.payday ? { payday: 25 } : {}) }, `Set to ${IncomeFrequencies[f].label.toLowerCase()}`)}
                    />
                  ))}
                </View>
              </View>
              <Row icon="down" label={usualAmountLabel(word, p.incomeFrequency)} hint="Pre-fills when you log it" right={<AmountInput value={p.income} label={usualAmountLabel(word, p.incomeFrequency)} placeholder="Optional" onSave={(v) => save({ income: v })} />} />
            </Animated.View>
          )}
          {p.incomeEnabled && p.incomeFrequency === 'monthly' && (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={[styles.rowCol, { borderTopColor: c.line }]}>
              <Txt variant="bodySemi">Payday</Txt>
              <Txt variant="caption" color="ink3">
                Home reminds you to log your {word.toLowerCase()} on {p.payday ? `the ${ordinal(p.payday)}` : 'payday'}.
              </Txt>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {Array.from({ length: 28 }, (_, d) => d + 1).map((d) => (
                  <Chip key={d} label={ordinal(d)} selected={p.payday === d} onPress={() => save({ payday: d }, `Payday set to the ${ordinal(d)}`)} />
                ))}
              </ScrollView>
            </Animated.View>
          )}
        </Group>

        <Group title="Budget" index={i++}>
          <Row first icon="flag" label="Monthly budget" right={<AmountInput value={p.monthlyBudget} label="Monthly budget" onSave={(v) => save({ monthlyBudget: v })} />} />
          <Row icon="chart" label="Category budgets" hint={`${setCount} of ${ExpenseIds.length} set`} onPress={() => setBudgetsOpen((o) => !o)} right={<Icon name={budgetsOpen ? 'down' : 'right'} size={18} color={c.ink3} />} />
          {budgetsOpen &&
            ExpenseIds.map((id: ExpenseCategory) => (
              <Animated.View key={id} entering={FadeIn}>
                <Row
                  icon={ExpenseCategories[id].icon}
                  label={ExpenseCategories[id].name}
                  right={
                    <AmountInput
                      value={p.catBudgets[id]}
                      label={`${ExpenseCategories[id].name} limit`}
                      placeholder="No limit"
                      onSave={(v) => {
                        const next = { ...p.catBudgets };
                        if (v) next[id] = v;
                        else delete next[id];
                        save({ catBudgets: next }, `${ExpenseCategories[id].name} limit ${v ? 'saved' : 'removed'}`);
                      }}
                    />
                  }
                />
              </Animated.View>
            ))}
        </Group>

        <Group title="Preferences" index={i++}>
          <View style={[styles.rowCol, { borderTopWidth: 0 }]}>
            <Txt variant="bodySemi">Appearance</Txt>
            <Segmented<ThemePref>
              small
              label="Appearance"
              value={p.theme}
              onChange={(v) => save({ theme: v }, v === 'system' ? 'Following your phone’s setting' : `${v === 'dark' ? 'Dark' : 'Light'} mode on`)}
              options={[
                { value: 'system', label: 'Auto' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </View>
          <View style={[styles.rowCol, { borderTopColor: c.line }]}>
            <Txt variant="bodySemi">Currency</Txt>
            <View style={styles.chips}>
              {Currencies.map((cur) => (
                <Chip key={cur} label={cur} selected={p.currency === cur} onPress={() => save({ currency: cur }, `Currency set to ${cur}`)} />
              ))}
            </View>
          </View>
        </Group>

        <Group title="Data" index={i++}>
          <Row
            first
            icon="download"
            label="Export as CSV"
            hint={`${transactions.length} transactions · opens the share sheet`}
            onPress={() => exportCsv(transactions).catch(() => showToast('Couldn’t export. Please try again.'))}
            right={<Icon name="right" size={18} color={c.ink3} />}
          />
        </Group>

        <Enter index={i++} style={[styles.group, { backgroundColor: c.surface }]}>
          <Row first danger icon="trash" label="Delete all data" hint="Transactions, goals and your profile" onPress={() => setConfirmReset(true)} />
        </Enter>

        <Txt variant="caption" color="ink3" style={{ textAlign: 'center' }}>
          Daily Strip · Volt
        </Txt>
      </KeyboardAwareScrollView>
      <KeyboardBar />

      <Sheet visible={confirmReset} onClose={() => !resetting && setConfirmReset(false)} title="Delete all data?">
        <Txt variant="body" color="ink2">
          This removes your {transactions.length} transactions, your goals, bills, loans, shopping lists, plans and your profile from this account, then starts setup again. It can’t be undone. Export a CSV first if you want a copy.
        </Txt>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <PrimaryButton label="Keep my data" tone="soft" onPress={() => setConfirmReset(false)} style={{ flex: 1 }} />
          <PrimaryButton label="Delete" tone="danger" busy={resetting} onPress={reset} style={{ flex: 1 }} />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Gutter, gap: 20, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: Radius.card },
  avatar: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  group: { borderRadius: Radius.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 10 },
  rowIc: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowCol: { gap: 8, padding: 14, borderTopWidth: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  nameInput: { width: 140, minHeight: 42, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 10, textAlign: 'right', fontFamily: Fonts.semiBold, fontSize: 15 },
  amountBox: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 128, minHeight: 42, borderWidth: 1.5, borderRadius: 12, paddingLeft: 10 },
  amountInput: { flex: 1, minWidth: 0, textAlign: 'right', paddingRight: 10, fontFamily: Fonts.semiBold, fontSize: 15 },
});
