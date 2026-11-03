import type { Bill } from '@/data/bills';
import { hasInstallment, isSettled, remaining, type Loan } from '@/data/loans';
import type { Plan } from '@/data/plans';
import type { Transaction } from '@/data/transactions';
import { startOfDay } from '@/lib/format';
import { advance } from '@/lib/recurring';
import { monthRange } from '@/lib/stats';

export type Commitments = { bills: number; loans: number; plans: number; total: number };

/**
 * Money already promised this month, set aside inside the monthly budget:
 * - bills and subscriptions still due before the month ends (overdue ones too). Marking one
 *   paid logs an expense and moves its due date on, so it moves from "set aside" to "spent";
 * - this month's installment on borrowed loans, less what was paid back this month;
 * - what's left of the budget of spending plans that haven't ended.
 */
export function monthCommitments({
  bills,
  loans,
  plans,
  planSpent,
  txs,
  now = new Date(),
}: {
  bills: Bill[];
  loans: Loan[];
  plans: Plan[];
  planSpent: Record<string, number>;
  txs: Transaction[];
  now?: Date;
}): Commitments {
  const [start, end] = monthRange(0, now);

  let billTotal = 0;
  for (const b of bills) {
    let due = b.nextDue;
    // Capped so a bill left unpaid for years can't loop for long.
    for (let i = 0; due < end && i < 60; i++) {
      billTotal += b.amount;
      due = advance(due, b.cycle, b.anchor);
    }
  }

  const paidThisMonth: Record<string, number> = {};
  for (const t of txs) {
    if (t.loanId && t.type === 'expense' && t.date >= start && t.date < end) paidThisMonth[t.loanId] = (paidThisMonth[t.loanId] ?? 0) + t.amount;
  }
  let loanTotal = 0;
  for (const l of loans) {
    if (!hasInstallment(l) || l.createdAt >= end) continue;
    const paid = paidThisMonth[l.id] ?? 0;
    if (isSettled(l) && !paid) continue;
    // remaining() is already down by this month's payments, so add them back before capping.
    loanTotal += Math.max(0, Math.min(l.installment!, remaining(l) + paid) - paid);
  }

  const today = startOfDay(now);
  let planTotal = 0;
  for (const p of plans) {
    const ended = p.end && startOfDay(p.end) < today;
    if (ended || p.start >= end) continue;
    planTotal += Math.max(0, p.budget - (planSpent[p.id] ?? 0));
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  return { bills: round(billTotal), loans: round(loanTotal), plans: round(planTotal), total: round(billTotal + loanTotal + planTotal) };
}
