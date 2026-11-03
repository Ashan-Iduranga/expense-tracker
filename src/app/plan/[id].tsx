import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { IconButton, PrimaryButton } from '@/components/controls';
import { formStyles } from '@/components/form';
import { SpendPills } from '@/components/home-widgets';
import { BlockMeter, CountUp, Enter } from '@/components/motion';
import { PlanEditor } from '@/components/plan-editor';
import { EmptyState, Screen, SectionHead, StackHeader } from '@/components/screen';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/txt';
import { TxRow } from '@/components/tx-row';
import { ListReflow, RowEnter, RowExit } from '@/constants/motion';
import { Radius } from '@/constants/theme';
import { isExpenseCategory, type ExpenseCategory } from '@/data/categories';
import { planDates, usePlans } from '@/data/plans';
import { useToast } from '@/data/toast';
import { useTransactions } from '@/data/transactions';
import { useColors } from '@/hooks/use-colors';
import { useProfile } from '@/hooks/use-profile';
import { formatMoney, startOfDay } from '@/lib/format';
import { daysUntil } from '@/lib/recurring';
import { splitByCategory } from '@/lib/stats';

export default function PlanScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile: p } = useProfile();
  const { plans, deletePlan } = usePlans();
  const { transactions, deleteTransaction } = useTransactions();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const plan = plans.find((x) => x.id === id);
  const cur = p.currency;

  const txs = useMemo(() => transactions.filter((t) => t.planId === id && t.type === 'expense'), [transactions, id]);
  const spent = txs.reduce((a, t) => a + t.amount, 0);
  const split = useMemo(() => {
    const byCat: Partial<Record<ExpenseCategory, number>> = {};
    for (const t of txs) {
      const k = isExpenseCategory(t.category) ? t.category : 'other';
      byCat[k] = (byCat[k] ?? 0) + t.amount;
    }
    return splitByCategory(byCat);
  }, [txs]);

  if (!plan) {
    return (
      <Screen withNav={false}>
        <StackHeader title="Plan" />
        <EmptyState icon="map" title="This plan isn’t here" body="It may have been deleted. Go back to see your other plans." />
      </Screen>
    );
  }

  const left = plan.budget - spent;
  const over = left < 0;
  const pct = plan.budget ? spent / plan.budget : 0;
  // Per day only makes sense while it's running and has an end.
  const daysLeft = plan.end ? daysUntil(plan.end) + 1 : null;
  const running = startOfDay(plan.start) <= startOfDay(new Date()) && daysLeft != null && daysLeft > 0;

  let i = 0;
  return (
    <Screen withNav={false}>
      <Enter index={i++}>
        <StackHeader
          title={plan.name}
          action={
            <>
              <IconButton icon="edit" label="Edit plan" onPress={() => setEditing(true)} />
              <IconButton icon="trash" label="Delete plan" tone="danger" onPress={() => setConfirmDelete(true)} />
            </>
          }
        />
      </Enter>

      <Enter index={i++} style={[styles.hero, { backgroundColor: c.hero }]}>
        <View style={styles.heroTop}>
          <Txt variant="label" color={c.heroInk2}>
            Spent · {planDates(plan)}
          </Txt>
          <View style={[styles.pill, { backgroundColor: over ? '#FF6B5E' : c.lime }]}>
            <Txt variant="smallBold" color={over ? '#1F0402' : c.inkFixed}>
              {Math.round(pct * 100)}%
            </Txt>
          </View>
        </View>
        <CountUp value={spent} currency={cur} variant="display" color={c.lime} />
        <BlockMeter value={pct} on={over ? '#FF6B5E' : c.lime} off={c.heroOff} label={`${Math.round(pct * 100)}% of the plan's budget used`} />
        <View style={styles.stats}>
          <Stat label="Budget" value={formatMoney(plan.budget, cur)} />
          <Stat label={over ? 'Over' : 'Left'} value={formatMoney(Math.abs(left), cur)} warn={over} />
          {running && <Stat label="Per day" value={formatMoney(Math.max(0, left) / daysLeft!, cur)} />}
        </View>
      </Enter>

      <Enter index={i++}>
        <PrimaryButton label="Add an expense to this plan" icon="plus" onPress={() => router.push({ pathname: '/add', params: { planId: plan.id } })} />
      </Enter>

      {split.length > 0 && (
        <Enter index={i++}>
          <SpendPills items={split} month={plan.name} />
        </Enter>
      )}

      <Enter index={i++} style={{ gap: 6 }}>
        <SectionHead title={`Expenses · ${txs.length}`} />
        {txs.length ? (
          txs.map((t) => (
            <Animated.View key={t.id} entering={RowEnter} exiting={RowExit} layout={ListReflow}>
              <TxRow tx={t} currency={cur} onPress={(tid) => router.push({ pathname: '/add', params: { id: tid } })} onDelete={deleteTransaction} />
            </Animated.View>
          ))
        ) : (
          <EmptyState icon="map" title="Nothing tagged yet" body="When you add an expense, pick this plan under “Part of a plan?” and it shows up here." />
        )}
      </Enter>

      <PlanEditor plan={plan} visible={editing} currency={cur} onClose={() => setEditing(false)} />
      <Sheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete plan?">
        <Txt variant="body" color="ink2">
          Delete “{plan.name}”? Its {txs.length} expense{txs.length === 1 ? '' : 's'} stay in History, just without the plan tag.
        </Txt>
        <View style={formStyles.row}>
          <PrimaryButton label="Keep it" tone="soft" onPress={() => setConfirmDelete(false)} style={{ flex: 1 }} />
          <PrimaryButton
            label="Delete"
            tone="danger"
            style={{ flex: 1 }}
            onPress={() => {
              setConfirmDelete(false);
              deletePlan(plan.id);
              showToast(`Deleted ${plan.name}`);
              router.back();
            }}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  const c = useColors();
  return (
    <View style={[styles.stat, { backgroundColor: c.heroTile }]}>
      <Txt variant="caption" color={c.heroInk2}>
        {label}
      </Txt>
      <Txt variant="bodyBold" color={warn ? '#FF8A7E' : c.heroInk} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: Radius.card, padding: 18, gap: 10 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, padding: 10, borderRadius: 14, gap: 2 },
});
