import type { Profile } from '@/data/account';
import { ExpenseCategories, type ExpenseCategory } from '@/data/categories';
import type { Transaction } from '@/data/transactions';
import { monthRange, sums } from '@/lib/stats';

export type SavingTip = { amount: number; reason: string };

/** Categories people can usually cut back on. */
const Flexible: ExpenseCategory[] = ['fun', 'shopping', 'food'];
const MinTip = 300;

const round100 = (n: number) => Math.floor(n / 100) * 100;

/**
 * How much the user could put aside each month, from the last (up to) three full months.
 * Half of what usually goes unspent; if nothing does, a 15% trim of the biggest flexible category.
 * Bills and loan payments are already in past spending, so they aren't subtracted again.
 */
export function suggestSaving(txs: Transaction[], profile: Profile, now = new Date()): SavingTip | null {
  const months = [1, 2, 3].map((o) => sums(txs, monthRange(o, now))).filter((m) => m.spent > 0 || m.income > 0);
  if (!months.length) return null;

  const n = months.length;
  const avgSpend = months.reduce((a, m) => a + m.spent, 0) / n;
  const avgIncome = months.reduce((a, m) => a + m.income, 0) / n;
  const base = profile.incomeEnabled && avgIncome > 0 ? avgIncome : profile.monthlyBudget ?? 0;
  const span = n === 1 ? 'last month' : `the last ${n} months`;

  const spare = base - avgSpend;
  if (spare > 0) {
    const amount = round100(spare / 2);
    if (amount >= MinTip) {
      const what = base === avgIncome && profile.incomeEnabled ? 'income' : 'budget';
      return { amount, reason: `About half of the ${what} you didn’t spend in ${span}.` };
    }
  }

  const byCat: Partial<Record<ExpenseCategory, number>> = {};
  for (const m of months) for (const [id, v] of Object.entries(m.byCat) as [ExpenseCategory, number][]) byCat[id] = (byCat[id] ?? 0) + v / n;
  const top = Flexible.map((id) => [id, byCat[id] ?? 0] as const).sort((a, b) => b[1] - a[1])[0];
  const amount = round100(top[1] * 0.15);
  if (amount < MinTip) return null;
  return { amount, reason: `Spend 15% less on ${ExpenseCategories[top[0]].short} than in ${span}.` };
}
