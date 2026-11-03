import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { Enter, ProgressRing } from '@/components/motion';
import { PressableScale } from '@/components/pressable-scale';
import { Screen, SectionHead } from '@/components/screen';
import { Txt } from '@/components/txt';
import { Radius } from '@/constants/theme';
import { useBills } from '@/data/bills';
import { useGoals } from '@/data/goals';
import { listTotals, useLists } from '@/data/lists';
import { useLoans } from '@/data/loans';
import { isActive, usePlans } from '@/data/plans';
import { useColors } from '@/hooks/use-colors';
import { useDueSoon, type DueItem } from '@/hooks/use-due-soon';
import { useProfile } from '@/hooks/use-profile';
import { formatMoney } from '@/lib/format';
import { dueLabel } from '@/lib/recurring';

/** Everything that's about money ahead of you: bills, loans, lists, plans and goals. */
export default function Hub() {
  const c = useColors();
  const { profile: p } = useProfile();
  const { bills, monthly, markPaid } = useBills();
  const { loans, totals } = useLoans();
  const { lists } = useLists();
  const { plans, spent } = usePlans();
  const { goals } = useGoals();
  const due = useDueSoon();
  const cur = p.currency;

  const toBuy = lists.reduce((a, l) => a + listTotals(l).toBuy, 0);
  const active = plans.filter((pl) => isActive(pl));
  const lead = active[0];
  const goalSaved = goals.reduce((a, g) => a + g.saved, 0);
  const goalTarget = goals.reduce((a, g) => a + g.target, 0);
  const openLoans = loans.filter((l) => l.paid < l.amount).length;

  const tiles: { key: string; icon: IconName; title: string; line: string; href: Href; tint: string }[] = [
    {
      key: 'bills',
      icon: 'repeat',
      title: 'Bills & subs',
      line: bills.length ? `${formatMoney(monthly.total, cur)} a month · ${bills.length} active` : 'Rent, reloads, Netflix…',
      href: '/bills',
      tint: c.cat.bills,
    },
    {
      key: 'loans',
      icon: 'handshake',
      title: 'Loans',
      line: openLoans ? `Owed to you ${formatMoney(totals.owedToYou, cur)} · You owe ${formatMoney(totals.youOwe, cur)}` : 'Money lent and borrowed',
      href: '/loans',
      tint: c.cat.transport,
    },
    {
      key: 'lists',
      icon: 'cart',
      title: 'Shopping lists',
      line: lists.length ? `${lists.length} list${lists.length === 1 ? '' : 's'} · ${formatMoney(toBuy, cur)} to buy` : 'Groceries with prices',
      href: '/lists',
      tint: c.cat.shopping,
    },
    {
      key: 'plans',
      icon: 'map',
      title: 'Spending plans',
      line: lead
        ? `${lead.name} · ${Math.round(((spent[lead.id] ?? 0) / Math.max(1, lead.budget)) * 100)}% used`
        : plans.length
          ? `${plans.length} plan${plans.length === 1 ? '' : 's'}`
          : 'Trips, parties, events',
      href: '/plans',
      tint: c.cat.fun,
    },
  ];

  let i = 0;
  return (
    <Screen>
      <Enter index={i++}>
        <Txt variant="title" role="heading">
          Plan
        </Txt>
        <Txt variant="small" color="ink2">
          Money that’s coming up, owed, or set aside.
        </Txt>
      </Enter>

      {due.length > 0 && (
        <Enter index={i++} style={{ gap: 6 }}>
          <SectionHead title="Due soon" />
          {due.slice(0, 4).map((d) => (
            <DueRow key={d.key} item={d} currency={cur} onAction={() => (d.kind === 'bill' ? markPaid(d.bill) : router.push({ pathname: '/loans', params: { open: d.loan.id } }))} />
          ))}
        </Enter>
      )}

      <Enter index={i++} style={styles.grid}>
        {tiles.map((t) => (
          <PressableScale key={t.key} role="link" aria-label={`${t.title}. ${t.line}`} onPress={() => router.push(t.href)} containerStyle={styles.tileWrap} style={[styles.tile, { backgroundColor: c.surface }]}>
            <View style={[styles.tileIc, { backgroundColor: t.tint + '24' }]}>
              <Icon name={t.icon} size={22} color={t.tint} />
            </View>
            <Txt variant="bodyBold" numberOfLines={1}>
              {t.title}
            </Txt>
            <Txt variant="caption" color="ink2" numberOfLines={2}>
              {t.line}
            </Txt>
          </PressableScale>
        ))}
      </Enter>

      <Enter index={i++}>
        <PressableScale role="link" aria-label="Goals" onPress={() => router.push('/goals')} style={[styles.goals, { backgroundColor: c.surface }]}>
          <ProgressRing value={goalTarget ? goalSaved / goalTarget : 0} size={58} stroke={5} color={c.ink} track={c.track}>
            <Icon name="target" size={22} color={c.ink} />
          </ProgressRing>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Txt variant="bodyBold">Goals</Txt>
            <Txt variant="small" color="ink2" numberOfLines={1}>
              {goals.length ? `${formatMoney(goalSaved, cur)} of ${formatMoney(goalTarget, cur)} · ${goals.length} goal${goals.length === 1 ? '' : 's'}` : 'Save up for a laptop, a trip…'}
            </Txt>
          </View>
          <Icon name="right" size={18} color={c.ink3} />
        </PressableScale>
      </Enter>
    </Screen>
  );
}

function DueRow({ item, currency, onAction }: { item: DueItem; currency: string; onAction: () => void }) {
  const c = useColors();
  const late = item.days < 0;
  return (
    <View style={[styles.due, { backgroundColor: late ? c.negSoft : c.surface }]}>
      <Icon name={item.kind === 'bill' ? 'repeat' : 'handshake'} size={20} color={late ? c.neg : c.ink2} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt variant="bodySemi" numberOfLines={1}>
          {item.title}
        </Txt>
        <Txt variant="caption" color={late ? c.neg : c.ink3}>
          {formatMoney(item.amount, currency)} · {dueLabel(item.due)}
        </Txt>
      </View>
      <PressableScale role="button" aria-label={item.kind === 'bill' ? `Mark ${item.title} paid` : `Record a payment for ${item.title}`} onPress={onAction} style={[styles.dueBtn, { backgroundColor: c.accent }]}>
        <Txt variant="smallBold" color={c.onAccent}>
          {item.kind === 'bill' ? 'Paid' : 'Record'}
        </Txt>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tileWrap: { width: '48%', flexGrow: 1 },
  tile: { minHeight: 140, padding: 14, gap: 6, borderRadius: Radius.card - 4 },
  tileIc: { width: 42, height: 42, borderRadius: Radius.icon, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  goals: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: Radius.card },
  due: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingLeft: 14, borderRadius: Radius.row },
  dueBtn: { minHeight: 38, paddingHorizontal: 14, borderRadius: 99, justifyContent: 'center' },
});
