import type { Profile } from '@/data/account';
import { ExpenseCategories, isExpenseCategory, type ExpenseCategory } from '@/data/categories';
import type { Transaction } from '@/data/transactions';
import { addDays, MonthNames, startOfDay } from '@/lib/format';

export type Range = [Date, Date];
export type Period = 'week' | 'month' | 'last';

export function monthRange(offset = 0, now = new Date()): Range {
  return [new Date(now.getFullYear(), now.getMonth() - offset, 1), new Date(now.getFullYear(), now.getMonth() - offset + 1, 1)];
}

/** Monday to Sunday. */
export function weekRange(offset = 0, now = new Date()): Range {
  const t = startOfDay(now);
  const start = addDays(t, -((t.getDay() + 6) % 7) - 7 * offset);
  return [start, addDays(start, 7)];
}

export function daysInMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export type Sums = { income: number; /** How many income entries; money can come in several times. */ incomeCount: number; spent: number; byCat: Partial<Record<ExpenseCategory, number>> };

export function sums(txs: Transaction[], [start, end]: Range): Sums {
  let income = 0;
  let incomeCount = 0;
  let spent = 0;
  const byCat: Sums['byCat'] = {};
  for (const t of txs) {
    if (t.date < start || t.date >= end) continue;
    if (t.type === 'income') {
      income += t.amount;
      incomeCount++;
    } else {
      spent += t.amount;
      const c = isExpenseCategory(t.category) ? t.category : 'other';
      byCat[c] = (byCat[c] ?? 0) + t.amount;
    }
  }
  return { income, incomeCount, spent, byCat };
}

/** Spending per day across a range, for the day-by-day bars. */
export function dailySpend(txs: Transaction[], [start, end]: Range) {
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  const values = Array.from({ length: days }, () => 0);
  for (const t of txs) {
    if (t.type !== 'expense' || t.date < start || t.date >= end) continue;
    const i = Math.floor((t.date.getTime() - start.getTime()) / 86_400_000);
    if (i >= 0 && i < days) values[i] += t.amount;
  }
  return values;
}

/** Categories sorted by spend, the top five plus everything else grouped. */
export function splitByCategory(byCat: Sums['byCat'], max = 5) {
  const all = (Object.entries(byCat) as [ExpenseCategory, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, value]) => ({ id, value, name: ExpenseCategories[id].name }));
  const top = all.slice(0, max);
  const rest = all.slice(max).reduce((a, e) => a + e.value, 0);
  if (rest > 0) top.push({ id: 'other', value: rest, name: 'Everything else' });
  return top;
}

export type Hero = {
  /** 'net' once income has been logged this month, otherwise spending against the budget. */
  mode: 'net' | 'spend';
  month: string;
  income: number;
  incomeCount: number;
  spent: number;
  net: number;
  /** The monthly budget plus any extra income the user chose to spend this month. */
  budget: number;
  /** Set aside for bills, loan installments and plans not yet paid this month. */
  committed: number;
  /** Budget minus spent minus set aside. */
  left: number;
  daysLeft: number;
  perDay: number;
  /** Share of the monthly budget spent or set aside; can pass 1. */
  pct: number;
  /** Share of this month's income not spent. */
  kept: number;
  month0: Sums;
};

export function heroData(
  txs: Transaction[],
  profile: Profile,
  { committed = 0, extraSpend = 0 }: { committed?: number; extraSpend?: number } = {},
  now = new Date()
): Hero {
  const range = monthRange(0, now);
  const m = sums(txs, range);
  const budget = profile.monthlyBudget ? profile.monthlyBudget + extraSpend : 0;
  const daysLeft = daysInMonth(now) - now.getDate() + 1;
  const left = budget - m.spent - committed;
  return {
    mode: profile.incomeEnabled && m.income > 0 ? 'net' : 'spend',
    month: MonthNames[now.getMonth()],
    income: m.income,
    incomeCount: m.incomeCount,
    spent: m.spent,
    net: m.income - m.spent,
    budget,
    committed,
    left,
    daysLeft,
    perDay: left > 0 ? left / daysLeft : 0,
    pct: budget ? (m.spent + committed) / budget : 0,
    kept: m.income ? Math.max(0, (m.income - m.spent) / m.income) : 0,
    month0: m,
  };
}

/** Ranges for the Insights period tabs, with the period to compare against. */
export function periodRanges(period: Period, now = new Date()) {
  if (period === 'week') return { current: weekRange(0, now), previous: weekRange(1, now), label: 'this week', previousLabel: 'last week', full: false };
  if (period === 'last') {
    const cur = monthRange(1, now);
    const prev = monthRange(2, now);
    return { current: cur, previous: prev, label: `in ${MonthNames[cur[0].getMonth()]}`, previousLabel: MonthNames[prev[0].getMonth()], full: true };
  }
  return { current: monthRange(0, now), previous: monthRange(1, now), label: `in ${MonthNames[now.getMonth()]}`, previousLabel: 'last month', full: false };
}

/**
 * Change against the previous period. For the current period, the previous one is
 * cut to the same elapsed time, so day 3 is compared with day 3.
 */
export function periodChange(txs: Transaction[], period: Period, now = new Date()) {
  const r = periodRanges(period, now);
  const cur = sums(txs, r.current);
  const prevRange: Range = r.full ? r.previous : [r.previous[0], new Date(r.previous[0].getTime() + (now.getTime() - r.current[0].getTime()))];
  const prev = sums(txs, prevRange);
  return { ...r, cur, delta: prev.spent ? (cur.spent - prev.spent) / prev.spent : null };
}
