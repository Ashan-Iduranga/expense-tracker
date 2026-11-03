import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Donut, TrendBars } from '@/components/charts';
import { Card, Segmented } from '@/components/controls';
import { Icon } from '@/components/icon';
import { CountUp, Enter, ProgressBar } from '@/components/motion';
import { EmptyState, Screen, SectionHead } from '@/components/screen';
import { Txt } from '@/components/txt';
import { displayType, Radius } from '@/constants/theme';
import { ExpenseCategories, type ExpenseCategory } from '@/data/categories';
import { useTransactions } from '@/data/transactions';
import { useMonth } from '@/data/month';
import { useColors } from '@/hooks/use-colors';
import { useProfile } from '@/hooks/use-profile';
import { addDays, dayLabel, DayNames, formatMoney, MonthNames, shortMonth, startOfDay } from '@/lib/format';
import { dailySpend, daysInMonth, monthRange, periodChange, splitByCategory, sums, type Period } from '@/lib/stats';

export default function Insights() {
  const c = useColors();
  const { profile: p, status: st } = useProfile();
  const { transactions } = useTransactions();
  const [period, setPeriod] = useState<Period>('month');
  const [picked, setPicked] = useState<number | null>(null);
  const now = new Date();

  // The React Compiler memoizes these; no manual useMemo needed.
  const data = periodChange(transactions, period);
  const split = splitByCategory(data.cur.byCat);
  const days = dailySpend(transactions, data.current);
  const start = data.current[0];
  const todayIndex = Math.floor((startOfDay(now).getTime() - start.getTime()) / 86_400_000);
  const futureFrom = Math.min(days.length, todayIndex + 1);
  const selected = picked ?? (todayIndex >= 0 && todayIndex < days.length ? todayIndex : days.indexOf(Math.max(...days)));
  const isMonth = period !== 'week';
  const budgetMonth = period === 'last' ? monthRange(1) : monthRange(0);
  const dailyBudget = p.monthlyBudget ? p.monthlyBudget / daysInMonth(budgetMonth[0]) : 0;
  const maxDay = Math.max(1, ...days);
  const budgetLine = isMonth && dailyBudget && dailyBudget < maxDay ? dailyBudget / maxDay : null;
  const budgetSums = useMemo(() => sums(transactions, period === 'last' ? monthRange(1) : monthRange(0)), [transactions, period]);
  const budgets = (Object.entries(p.catBudgets) as [ExpenseCategory, number][])
    .filter(([, l]) => l > 0)
    .map(([id, limit]) => ({ id, limit, spent: budgetSums.byCat[id] ?? 0 }))
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit);
  const dom = now.getDate();
  // This month's budget plus extra income chosen to spend, less what's set aside for bills, loans and plans.
  const { alloc, committed } = useMonth();
  const room = (p.monthlyBudget ?? 0) + alloc.spend - committed.total;
  const asideNote = committed.total > 0 ? ` after the ${formatMoney(committed.total, p.currency)} set aside` : '';
  const projected = (data.cur.spent / dom) * daysInMonth(now);
  const sweepKey = `${period}-${transactions.length}`;

  return (
    <Screen>
      <Enter index={0}>
        <Txt variant="title" role="heading">
          Stats
        </Txt>
      </Enter>
      <Enter index={1}>
        <Segmented<Period>
          label="Period"
          value={period}
          onChange={(v) => {
            setPeriod(v);
            setPicked(null);
          }}
          options={[
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
            { value: 'last', label: 'Last month' },
          ]}
        />
      </Enter>

      <Enter index={2}>
        <Card style={{ gap: 6 }}>
          <Txt variant="small" color="ink2">
            Spent {data.label}
          </Txt>
          <CountUp value={data.cur.spent} currency={p.currency} variant="display" />
          {data.delta == null ? (
            <Txt variant="smallSemi" color="ink2">
              No earlier data to compare yet
            </Txt>
          ) : (
            <View style={styles.delta}>
              <Icon name={data.delta > 0 ? 'up' : 'down'} size={15} color={data.delta > 0 ? c.neg : c.posInk} />
              <Txt variant="smallBold" color={data.delta > 0 ? c.neg : c.posInk}>
                {Math.abs(Math.round(data.delta * 100))}% {data.delta > 0 ? 'more' : 'less'} than {data.previousLabel}
                {data.full ? '' : ' at this point'}
              </Txt>
            </View>
          )}
          {p.incomeEnabled && data.cur.income > 0 && (
            <View style={[styles.trio, { borderTopColor: c.line }]}>
              {[
                [data.cur.incomeCount > 1 ? `${st.word} · ${data.cur.incomeCount}×` : st.word, formatMoney(data.cur.income, p.currency)],
                ['Spent', formatMoney(data.cur.spent, p.currency)],
                ['Kept', `${Math.max(0, Math.round(((data.cur.income - data.cur.spent) / data.cur.income) * 100))}%`],
              ].map(([l, v]) => (
                <View key={l} style={{ flex: 1 }}>
                  <Txt variant="caption" color="ink3">
                    {l}
                  </Txt>
                  <Txt variant="num" numberOfLines={1}>
                    {v}
                  </Txt>
                </View>
              ))}
            </View>
          )}
        </Card>
      </Enter>

      {data.cur.spent > 0 ? (
        <>
          <Enter index={3}>
            <Card>
              <SectionHead title="Where it went" />
              <View style={styles.split}>
                <View style={styles.donutWrap}>
                  <Donut sweepKey={sweepKey} slices={split.map((s) => ({ key: s.id, value: s.value, color: c.cat[s.id], name: s.name }))} />
                  <View style={styles.donutCenter} pointerEvents="none">
                    <Txt variant="caption" color="ink3">
                      Top
                    </Txt>
                    <Txt variant="smallBold">{split[0]?.name.split(' ')[0]}</Txt>
                    <Txt variant="caption" color="ink3">
                      {Math.round(((split[0]?.value ?? 0) / data.cur.spent) * 100)}%
                    </Txt>
                  </View>
                </View>
                <View style={styles.legend}>
                  {split.map((s) => (
                    <View key={s.id} style={styles.legendRow}>
                      <View style={[styles.dot, { backgroundColor: c.cat[s.id] }]} />
                      <Txt variant="small" color="ink2" style={{ flex: 1 }}>
                        {s.name}
                      </Txt>
                      <Txt variant="smallBold">{formatMoney(s.value, p.currency)}</Txt>
                    </View>
                  ))}
                </View>
              </View>
            </Card>
          </Enter>

          <Enter index={4}>
            <Card>
              <View style={styles.cardHead}>
                <Txt variant="section">Day by day</Txt>
                <Txt variant="small" color="ink2">
                  {dayLabel(addDays(start, selected))} · <Txt variant="smallBold">{formatMoney(days[selected] ?? 0, p.currency)}</Txt>
                </Txt>
              </View>
              <TrendBars
                values={days}
                sweepKey={sweepKey}
                futureFrom={futureFrom}
                selected={selected}
                onSelect={setPicked}
                dailyBudget={dailyBudget}
                budgetLine={budgetLine}
                budgetLabel={`Daily budget ${formatMoney(dailyBudget, p.currency)}`}
                labels={days.map((v, i) => `${dayLabel(addDays(start, i))}: ${formatMoney(v, p.currency)}`)}
                axis={days.map((_, i) => {
                  const d = addDays(start, i);
                  if (!isMonth) return DayNames[d.getDay()].slice(0, 1);
                  return [0, 7, 14, 21, 28].includes(i) ? String(d.getDate()) : '';
                })}
              />
            </Card>
          </Enter>

          {period === 'month' && p.monthlyBudget ? (
            <Enter index={5}>
              <View style={[styles.forecast, { backgroundColor: c.forecast }]}>
                <Icon name="sparkle" size={26} color={c.forecastInk} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt variant="name" color={c.forecastInk} style={displayType(26)}>
                    Month-end forecast
                  </Txt>
                  <Txt variant="small" color={c.forecastInk2}>
                    At this pace you will spend about <Txt variant="smallBold" color={c.forecastInk}>{formatMoney(projected, p.currency)}</Txt> by{' '}
                    {shortMonth(now.getMonth())} {daysInMonth(now)}.{' '}
                    {projected <= room
                      ? `That is ${formatMoney(room - projected, p.currency)} under your budget${asideNote}.`
                      : `That is ${formatMoney(projected - room, p.currency)} over your budget${asideNote}. Try keeping to ${formatMoney(
                          Math.max(0, (room - data.cur.spent) / (daysInMonth(now) - dom + 1)),
                          p.currency
                        )} a day.`}
                  </Txt>
                </View>
              </View>
            </Enter>
          ) : null}
        </>
      ) : (
        <Enter index={3}>
          <EmptyState icon="chart" title={`No spending ${data.label}`} body="Charts fill in as you log expenses." />
        </Enter>
      )}

      <Enter index={6}>
        <Card>
          <SectionHead
            title={period === 'last' ? `Budgets in ${MonthNames[budgetMonth[0].getMonth()]}` : 'This month’s budgets'}
            action={
              <Pressable role="link" hitSlop={10} onPress={() => router.push('/settings')}>
                <Txt variant="smallBold" color="accentInk">
                  Edit
                </Txt>
              </Pressable>
            }
          />
          {budgets.length ? (
            budgets.map((b) => {
              const info = ExpenseCategories[b.id];
              const pct = b.spent / b.limit;
              const over = pct > 1;
              const near = !over && pct > 0.85;
              const color = c.cat[b.id];
              return (
                <View key={b.id} style={styles.budgetRow}>
                  <View style={[styles.budgetIc, { backgroundColor: color + '24' }]}>
                    <Icon name={info.icon} size={18} color={color} />
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={styles.budgetTop}>
                      <Txt variant="smallBold">{info.name}</Txt>
                      <Txt variant="smallBold">
                        {formatMoney(b.spent, p.currency)}{' '}
                        <Txt variant="small" color="ink3">
                          of {formatMoney(b.limit, p.currency)}
                        </Txt>
                      </Txt>
                    </View>
                    <ProgressBar value={pct} color={over ? c.neg : near ? c.warn : color} track={c.track} />
                    <View style={styles.delta}>
                      {over && <Icon name="alert" size={14} color={c.neg} />}
                      <Txt variant="caption" color={over ? c.neg : near ? c.warnInk : c.ink3}>
                        {over
                          ? `${formatMoney(b.spent - b.limit, p.currency)} over budget`
                          : near
                            ? `${formatMoney(b.limit - b.spent, p.currency)} left, close to the limit`
                            : `${formatMoney(b.limit - b.spent, p.currency)} left`}
                      </Txt>
                    </View>
                  </View>
                </View>
              );
            })
          ) : (
            <Txt variant="small" color="ink2">
              No category limits yet. Set them in Settings to get a warning before you overspend.
            </Txt>
          )}
        </Card>
      </Enter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  delta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trio: { flexDirection: 'row', gap: 8, marginTop: 8, paddingTop: 12, borderTopWidth: 1 },
  split: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  donutWrap: { width: 128, height: 128 },
  donutCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  legend: { flex: 1, gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  forecast: { flexDirection: 'row', gap: 12, padding: 18, borderRadius: Radius.card },
  budgetRow: { flexDirection: 'row', gap: 12 },
  budgetIc: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  budgetTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
});
