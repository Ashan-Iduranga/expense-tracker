import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAccount } from '@/data/account';
import { useBills } from '@/data/bills';
import { useLoans } from '@/data/loans';
import { usePlans } from '@/data/plans';
import { clearCollection, userCollection, userDoc } from '@/data/store';
import { inc, put, serverTime, watchDoc } from '@/data/sync';
import { useTransactions } from '@/data/transactions';
import { monthCommitments, type Commitments } from '@/lib/commitments';
import { monthRange, sums } from '@/lib/stats';

export type Allocation = {
  /** Income above the budget the user chose to spend this month: it raises the budget. */
  spend: number;
  /** Income above the budget put into savings goals this month. */
  saved: number;
  /** The savings tip was dismissed for this month. */
  tipDismissed: boolean;
};

const Empty: Allocation = { spend: 0, saved: 0, tipDismissed: false };
const Name = 'months';

/** "2026-11" */
export function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

type MonthContextValue = {
  alloc: Allocation;
  /** Set aside this month for bills, loan installments and spending plans. */
  committed: Commitments;
  /** This month's income above the budget that hasn't been assigned to spend or save yet. */
  surplus: number;
  /** Records part of the surplus as spending money and/or savings. */
  assign: (spend: number, saved: number) => void;
  dismissTip: () => void;
  /** Set right after income is logged that goes over the budget; Home opens the sheet. */
  askSurplus: boolean;
  setAskSurplus: (v: boolean) => void;
  clearAll: () => Promise<void>;
};

const MonthContext = createContext<MonthContextValue | null>(null);

/** The current month's budget picture: users/{uid}/months/{YYYY-MM}, plus commitments. */
export function MonthProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAccount();
  const { transactions } = useTransactions();
  const { bills } = useBills();
  const { loans } = useLoans();
  const { plans, spent: planSpent } = usePlans();
  const [alloc, setAlloc] = useState<Allocation>(Empty);
  const [askSurplus, setAskSurplus] = useState(false);
  // Re-subscribes when the month changes while the app stays open.
  const key = monthKey();

  useEffect(() => {
    if (!user) return;
    return watchDoc(userDoc(user.uid, Name, key), (d) => {
      setAlloc(
        d
          ? { spend: Number(d.spend) || 0, saved: Number(d.saved) || 0, tipDismissed: d.tipDismissed === true }
          : Empty
      );
    });
  }, [user, key]);

  const committed = useMemo(
    () => monthCommitments({ bills, loans, plans, planSpent, txs: transactions }),
    [bills, loans, plans, planSpent, transactions]
  );

  const surplus = useMemo(() => {
    const budget = profile?.monthlyBudget;
    if (!budget || !profile?.incomeEnabled) return 0;
    const income = sums(transactions, monthRange(0)).income;
    return Math.max(0, Math.round(income - budget - alloc.spend - alloc.saved));
  }, [transactions, profile, alloc]);

  function write(fields: Record<string, unknown>) {
    if (!user) return;
    put(userDoc(user.uid, Name, key), { ...fields, updatedAt: serverTime() }, { merge: true });
  }

  return (
    <MonthContext
      value={{
        alloc,
        committed,
        surplus,
        assign: (spend, saved) => write({ spend: inc(Math.max(0, spend)), saved: inc(Math.max(0, saved)) }),
        dismissTip: () => write({ tipDismissed: true }),
        askSurplus,
        setAskSurplus,
        clearAll: async () => {
          if (user) clearCollection(userCollection(user.uid, Name));
        },
      }}>
      {children}
    </MonthContext>
  );
}

export function useMonth() {
  const value = use(MonthContext);
  if (!value) throw new Error('useMonth must be used inside <MonthProvider>');
  return value;
}
