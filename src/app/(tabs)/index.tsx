import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { PrimaryButton } from '@/components/controls';
import { BudgetStrip, HeroCard, SpendPills } from '@/components/home-widgets';
import { Icon } from '@/components/icon';
import { Enter } from '@/components/motion';
import { PressableScale } from '@/components/pressable-scale';
import { EmptyState, Screen, SectionHead } from '@/components/screen';
import { SurplusSheet } from '@/components/surplus-sheet';
import { Txt } from '@/components/txt';
import { TxRow } from '@/components/tx-row';
import { ListReflow, RowEnter, RowExit } from '@/constants/motion';
import { displayType, Fonts, Radius } from '@/constants/theme';
import { useAccount } from '@/data/account';
import { type ExpenseCategory } from '@/data/categories';
import { useGoals } from '@/data/goals';
import { useMonth } from '@/data/month';
import { useTransactions } from '@/data/transactions';
import { useColors } from '@/hooks/use-colors';
import { useDueSoon } from '@/hooks/use-due-soon';
import { useProfile } from '@/hooks/use-profile';
import { formatMoney, greeting, ordinal } from '@/lib/format';
import { dueLabel } from '@/lib/recurring';
import { heroData, monthRange, splitByCategory } from '@/lib/stats';
import { suggestSaving } from '@/lib/suggest';

export default function Home() {
  const c = useColors();
  const { profile: p, status: st } = useProfile();
  const { updateProfile } = useAccount();
  const { transactions, status, deleteTransaction } = useTransactions();
  const { alloc, committed, surplus, askSurplus, setAskSurplus, dismissTip } = useMonth();
  const { goals } = useGoals();
  const h = useMemo(() => heroData(transactions, p, { committed: committed.total, extraSpend: alloc.spend }), [transactions, p, committed, alloc.spend]);
  const tip = useMemo(() => suggestSaving(transactions, p), [transactions, p]);
  const showTip = !!tip && !alloc.tipDismissed && (goals.length === 0 || alloc.saved === 0);
  const [assigning, setAssigning] = useState(false);
  // Logging income above the budget (askSurplus) opens the sheet straight away.
  const surplusOpen = (assigning || askSurplus) && surplus > 0;
  const closeSurplus = () => {
    setAssigning(false);
    setAskSurplus(false);
  };
  const split = useMemo(() => splitByCategory(h.month0.byCat), [h]);
  const budgets = useMemo(
    () =>
      (Object.entries(p.catBudgets) as [ExpenseCategory, number][])
        .filter(([, limit]) => limit > 0)
        .map(([id, limit]) => ({ id, limit, spent: h.month0.byCat[id] ?? 0 }))
        .sort((a, b) => b.spent / b.limit - a.spent / a.limit),
    [p.catBudgets, h]
  );
  const recent = transactions.slice(0, 5);
  const due = useDueSoon();
  const first = due[0];
  const monthStart = monthRange(0)[0];
  const showPayday =
    p.incomeFrequency === 'monthly' &&
    p.incomeEnabled &&
    !!p.payday &&
    new Date().getDate() >= p.payday &&
    !transactions.some((t) => t.type === 'income' && t.date >= monthStart);
  // Money that comes in several times a month (pocket money, freelance) gets a one-tap log instead.
  const showGotMoney = p.incomeEnabled && p.incomeFrequency !== 'monthly';

  const openTx = (id: string) => router.push({ pathname: '/add', params: { id } });
  const addIncome = (amount?: number | null, cat?: string) =>
    router.push({ pathname: '/add', params: { type: 'income', ...(amount ? { amount: String(amount) } : {}), ...(cat ? { cat } : {}) } });

  let i = 0;
  return (
    <Screen>
      <Enter index={i++} style={styles.top}>
        <View style={{ flex: 1 }}>
          <Txt variant="label" color="ink2">
            {greeting()}
          </Txt>
          <Txt variant="name" numberOfLines={1}>
            {p.name || 'Hello'}
          </Txt>
        </View>
        <PressableScale role="button" aria-label="Settings" onPress={() => router.push('/settings')} style={[styles.avatar, { backgroundColor: c.lime }]}>
          <Txt style={styles.avatarText} color={c.inkFixed}>
            {(p.name || '?').slice(0, 1).toUpperCase()}
          </Txt>
        </PressableScale>
      </Enter>

      {status === 'error' && (
        <View style={[styles.banner, { backgroundColor: c.negSoft }]}>
          <Icon name="alert" size={20} color={c.neg} />
          <Txt variant="small" style={{ flex: 1 }}>
            Can’t reach the server. You’re seeing what’s saved on this phone; changes will sync when you’re back online.
          </Txt>
        </View>
      )}

      {showPayday && (
        <Enter index={i++} style={[styles.banner, { backgroundColor: c.accentSoft }]}>
          <Icon name="bell" size={20} color={c.accentInk} />
          <View style={{ flex: 1 }}>
            <Txt variant="smallBold" color={c.accentInk}>
              Payday was on the {ordinal(p.payday!)}.
            </Txt>
            <Txt variant="caption" color={c.accentInk}>
              Log this month’s {st.word.toLowerCase()} to see your net balance.
            </Txt>
          </View>
          <PressableScale role="button" onPress={() => addIncome(p.income, st.incomeCats[0])} style={[styles.smallBtn, { backgroundColor: c.accent }]}>
            <Txt variant="smallBold" color={c.onAccent}>
              Log {st.word.toLowerCase()}
            </Txt>
          </PressableScale>
        </Enter>
      )}

      {first && (
        <Enter index={i++}>
          <PressableScale
            role="link"
            aria-label={`${due.length} due soon. ${first.title}, ${dueLabel(first.due)}. Open Plan`}
            onPress={() => router.navigate('/hub')}
            style={[styles.banner, { backgroundColor: first.days < 0 ? c.negSoft : c.surface }]}>
            <Icon name="calendar" size={20} color={first.days < 0 ? c.neg : c.accentInk} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt variant="smallBold" numberOfLines={1}>
                {first.title} · {formatMoney(first.amount, p.currency)}
              </Txt>
              <Txt variant="caption" color={first.days < 0 ? c.neg : c.ink2}>
                {dueLabel(first.due)}
                {due.length > 1 ? ` · ${due.length - 1} more due soon` : ''}
              </Txt>
            </View>
            <Icon name="right" size={18} color={c.ink3} />
          </PressableScale>
        </Enter>
      )}

      <Enter index={i++}>
        {status === 'loading' ? (
          <View style={[styles.loading, { backgroundColor: c.hero }]}>
            <ActivityIndicator color={c.lime} />
          </View>
        ) : (
          <HeroCard h={h} currency={p.currency} word={st.word} onCommitted={() => router.navigate('/hub')} />
        )}
      </Enter>

      {surplus > 0 && (
        <Enter index={i++}>
          <PressableScale
            role="button"
            aria-label={`${formatMoney(surplus, p.currency)} above your budget not assigned yet. Choose to spend or save it`}
            onPress={() => setAssigning(true)}
            style={[styles.gotMoney, { backgroundColor: c.lime }]}>
            <View style={[styles.gotIc, { backgroundColor: c.inkFixed }]}>
              <Icon name="wallet" size={18} color={c.lime} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="smallBold" color={c.inkFixed}>
                {formatMoney(surplus, p.currency)} extra, not assigned yet
              </Txt>
              <Txt variant="caption" color={c.inkFixed}>
                Your {st.word.toLowerCase()} is above your budget. Spend it or save it?
              </Txt>
            </View>
            <Icon name="right" size={18} color={c.inkFixed} />
          </PressableScale>
        </Enter>
      )}

      {showTip && tip && (
        <Enter index={i++} style={[styles.tip, { backgroundColor: c.surface }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[styles.gotIc, { backgroundColor: c.accentSoft }]}>
              <Icon name="sparkle" size={18} color={c.accentInk} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="smallBold">You could save about {formatMoney(tip.amount, p.currency)} a month</Txt>
              <Txt variant="caption" color="ink2">
                {tip.reason} Want to put it towards something?
              </Txt>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <PrimaryButton label="Not now" tone="soft" onPress={dismissTip} style={{ flex: 1 }} />
            <PrimaryButton label={goals.length ? 'Add to a goal' : 'Start a goal'} onPress={() => router.push('/goals')} style={{ flex: 1 }} />
          </View>
        </Enter>
      )}

      {split.length > 0 && (
        <Enter index={i++}>
          <SpendPills items={split} month={h.month} />
        </Enter>
      )}

      {showGotMoney && (
        <Enter index={i++}>
          <PressableScale
            role="button"
            aria-label={`${p.status === 'student' ? 'Got pocket money?' : 'Got paid?'} Log ${st.word.toLowerCase()}`}
            onPress={() => addIncome(p.income, st.incomeCats[0])}
            style={[styles.gotMoney, { backgroundColor: c.accentSoft }]}>
            <View style={[styles.gotIc, { backgroundColor: c.accent }]}>
              <Icon name="plus" size={18} color={c.onAccent} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="smallBold" color={c.accentInk}>
                {p.status === 'student' ? 'Got pocket money?' : 'Got paid?'}
              </Txt>
              <Txt variant="caption" color={c.accentInk}>
                {h.month0.incomeCount
                  ? `Logged ${h.month0.incomeCount} ${h.month0.incomeCount === 1 ? 'time' : 'times'} in ${h.month}. Add it each time it comes in.`
                  : `Add it each time it comes in. ${h.month}’s total adds up on its own.`}
              </Txt>
            </View>
            <Icon name="right" size={18} color={c.accentInk} />
          </PressableScale>
        </Enter>
      )}

      {!p.incomeEnabled && (
        <Enter index={i++}>
          <Pressable
            role="button"
            onPress={() => {
              updateProfile({ incomeEnabled: true });
              addIncome(p.income);
            }}
            style={({ pressed }) => [styles.incomeChip, { borderColor: c.line2, backgroundColor: pressed ? c.surface2 : 'transparent' }]}>
            <Icon name="plus" size={20} color={c.accentInk} />
            <Txt variant="smallSemi" style={{ flex: 1 }}>
              {p.status === 'student' ? 'Get pocket money? Track your allowance' : 'Track income too'}
            </Txt>
            <View style={[styles.optional, { backgroundColor: c.surface2 }]}>
              <Txt variant="caption" color="ink3" style={{ fontFamily: Fonts.semiBold }}>
                Optional
              </Txt>
            </View>
          </Pressable>
        </Enter>
      )}

      <Enter index={i++} style={{ gap: 4 }}>
        <SectionHead
          title="Category budgets"
          action={
            budgets.length > 0 && (
              <Pressable role="link" hitSlop={10} onPress={() => router.navigate('/insights')}>
                <Txt variant="smallBold" color="accentInk">
                  Details
                </Txt>
              </Pressable>
            )
          }
        />
        {budgets.length ? (
          <BudgetStrip items={budgets} currency={p.currency} onPress={() => router.navigate('/insights')} />
        ) : (
          <Pressable
            role="button"
            onPress={() => router.push('/settings')}
            style={[styles.setLimits, { borderColor: c.line2 }]}>
            <Icon name="plus" size={18} color={c.ink} />
            <Txt variant="smallSemi">Set limits for food, transport and more</Txt>
          </Pressable>
        )}
      </Enter>

      <Enter index={i++} style={{ gap: 6 }}>
        <SectionHead
          title="Recent"
          action={
            transactions.length > 0 && (
              <Pressable role="link" hitSlop={10} onPress={() => router.navigate('/history')}>
                <Txt variant="smallBold" color="accentInk">
                  See all
                </Txt>
              </Pressable>
            )
          }
        />
        {recent.length ? (
          <View style={{ gap: 6 }}>
            {recent.map((t) => (
              <Animated.View key={t.id} entering={RowEnter} exiting={RowExit} layout={ListReflow}>
                <TxRow tx={t} currency={p.currency} onPress={openTx} onDelete={deleteTransaction} />
              </Animated.View>
            ))}
          </View>
        ) : status !== 'loading' ? (
          // No button here: the lime + in the nav does this, and a button at this height sat under the nav.
          <EmptyState icon="wallet" title="Nothing logged yet" body="Tap the lime + below to add your first expense. It takes two taps." />
        ) : null}
      </Enter>

      {transactions.length > 0 && transactions.length < 3 && (
        <PrimaryButton label="Add another" icon="plus" tone="soft" onPress={() => router.push('/add')} />
      )}

      <SurplusSheet visible={surplusOpen} amount={surplus} onClose={closeSurplus} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  avatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: displayType(26),
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: Radius.card - 6 },
  smallBtn: { minHeight: 40, paddingHorizontal: 14, borderRadius: 99, justifyContent: 'center' },
  loading: { height: 220, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  incomeChip: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1.5, borderStyle: 'dashed' },
  gotMoney: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 22 },
  gotIc: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tip: { gap: 12, padding: 14, borderRadius: 22 },
  optional: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  setLimits: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 56, borderRadius: 22, borderWidth: 1.5, borderStyle: 'dashed' },
});
