import { useMemo } from 'react';

import { useBills, type Bill } from '@/data/bills';
import { isSettled, remaining, useLoans, type Loan } from '@/data/loans';
import { daysUntil, SoonDays } from '@/lib/recurring';

export type DueItem = { key: string; title: string; amount: number; due: Date; days: number } & ({ kind: 'bill'; bill: Bill } | { kind: 'loan'; loan: Loan });

/** Bills and open loans that are overdue or due within the next few days, most urgent first. */
export function useDueSoon() {
  const { bills } = useBills();
  const { loans } = useLoans();
  return useMemo(() => {
    const out: DueItem[] = [];
    for (const b of bills) {
      const days = daysUntil(b.nextDue);
      if (days <= SoonDays) out.push({ key: `b-${b.id}`, kind: 'bill', bill: b, title: b.name, amount: b.amount, due: b.nextDue, days });
    }
    for (const l of loans) {
      if (!l.due || isSettled(l)) continue;
      const days = daysUntil(l.due);
      if (days <= SoonDays) {
        out.push({ key: `l-${l.id}`, kind: 'loan', loan: l, title: l.direction === 'lent' ? `${l.person} owes you` : `Pay back ${l.person}`, amount: remaining(l), due: l.due, days });
      }
    }
    return out.sort((a, b) => a.days - b.days);
  }, [bills, loans]);
}
