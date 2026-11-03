import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { Enter, ProgressBar } from '@/components/motion';
import { PlanEditor } from '@/components/plan-editor';
import { PressableScale } from '@/components/pressable-scale';
import { EmptyState, NewButton, Screen, SectionHead, StackHeader } from '@/components/screen';
import { Txt } from '@/components/txt';
import { ListReflow, RowEnter, RowExit } from '@/constants/motion';
import { Radius } from '@/constants/theme';
import { isActive, planDates, usePlans, type Plan } from '@/data/plans';
import { useMonth } from '@/data/month';
import { useColors } from '@/hooks/use-colors';
import { useProfile } from '@/hooks/use-profile';
import { formatMoney, startOfDay } from '@/lib/format';

export default function Plans() {
  const { profile: pr } = useProfile();
  const { plans, spent } = usePlans();
  const { committed } = useMonth();
  const [creating, setCreating] = useState(false);
  const today = startOfDay(new Date());
  const groups: { title: string; items: Plan[] }[] = [
    { title: 'Now', items: plans.filter((p) => isActive(p)) },
    { title: 'Coming up', items: plans.filter((p) => startOfDay(p.start) > today) },
    { title: 'Finished', items: plans.filter((p) => p.end && startOfDay(p.end) < today) },
  ].filter((g) => g.items.length);

  let i = 1;
  return (
    <Screen withNav={false}>
      <Enter index={0}>
        <StackHeader title="Spending plans" action={<NewButton label="New plan" onPress={() => setCreating(true)} />} />
      </Enter>

      {committed.plans > 0 && (
        <Enter index={i++}>
          <Txt variant="caption" color="ink2">
            {formatMoney(committed.plans, pr.currency)} left in this month’s plans is set aside from your monthly budget.
          </Txt>
        </Enter>
      )}

      {plans.length ? (
        groups.map((g) => (
          <Enter key={g.title} index={i++} style={{ gap: 8 }}>
            <SectionHead title={g.title} />
            {g.items.map((p) => (
              <Animated.View key={p.id} entering={RowEnter} exiting={RowExit} layout={ListReflow}>
                <PlanCard plan={p} spent={spent[p.id] ?? 0} currency={pr.currency} />
              </Animated.View>
            ))}
          </Enter>
        ))
      ) : (
        <Enter index={1}>
          <EmptyState
            icon="map"
            title="No plans yet"
            body="Going on a trip, throwing a party, or starting a new semester? Set a budget for it, tag what you spend, and see what’s left."
            action="Make a plan"
            onAction={() => setCreating(true)}
          />
        </Enter>
      )}

      <PlanEditor visible={creating} currency={pr.currency} onClose={() => setCreating(false)} />
    </Screen>
  );
}

function PlanCard({ plan, spent, currency }: { plan: Plan; spent: number; currency: string }) {
  const c = useColors();
  const pct = plan.budget ? spent / plan.budget : 0;
  const over = pct > 1;
  return (
    <PressableScale
      role="link"
      aria-label={`${plan.name}, ${formatMoney(spent, currency)} of ${formatMoney(plan.budget, currency)}. Open`}
      onPress={() => router.push({ pathname: '/plan/[id]', params: { id: plan.id } })}
      scaleTo={0.98}
      style={[styles.card, { backgroundColor: c.surface }]}>
      <View style={styles.top}>
        <View style={[styles.ic, { backgroundColor: c.cat.fun + '24' }]}>
          <Icon name={plan.icon} size={20} color={c.cat.fun} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt variant="bodyBold" numberOfLines={1}>
            {plan.name}
          </Txt>
          <Txt variant="caption" color="ink3">
            {planDates(plan)}
          </Txt>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Txt variant="bodyBold" color={over ? c.neg : c.ink}>
            {formatMoney(spent, currency)}
          </Txt>
          <Txt variant="caption" color="ink3">
            of {formatMoney(plan.budget, currency)}
          </Txt>
        </View>
      </View>
      <ProgressBar value={pct} color={over ? c.neg : c.bar} track={c.track} height={8} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 10, borderRadius: Radius.card - 4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ic: { width: 42, height: 42, borderRadius: Radius.icon, alignItems: 'center', justifyContent: 'center' },
});
