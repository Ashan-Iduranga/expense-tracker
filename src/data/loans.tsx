import { Timestamp } from 'firebase/firestore';
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAccount } from '@/data/account';
import { clearCollection, toDate, userCollection, userDoc } from '@/data/store';
import { inc, newId, patch, put, remove, serverTime, watchCollection } from '@/data/sync';
import { useToast } from '@/data/toast';
import { useTransactions } from '@/data/transactions';
import { formatMoney } from '@/lib/format';

/** 'lent': they owe you. 'borrowed': you owe them. */
export type LoanDirection = 'lent' | 'borrowed';

export type Loan = {
  id: string;
  person: string;
  direction: LoanDirection;
  amount: number;
  /** Paid back so far. */
  paid: number;
  due: Date | null;
  note: string;
  remind: boolean;
  /** Borrowed loans paid back monthly: how many months, and how much each month. */
  months: number | null;
  installment: number | null;
  createdAt: Date;
};

export type NewLoan = Omit<Loan, 'id' | 'paid' | 'createdAt'>;

export const isSettled = (l: Loan) => l.paid >= l.amount;
export const remaining = (l: Loan) => Math.max(0, l.amount - l.paid);
/** A borrowed loan with a monthly installment comes out of the monthly budget. */
export const hasInstallment = (l: Loan) => l.direction === 'borrowed' && !!l.installment && l.installment > 0;
/** Whole installments covered so far, e.g. 3 of 12. */
export const installmentsPaid = (l: Loan) => (l.installment ? Math.min(l.months ?? Infinity, Math.floor(l.paid / l.installment)) : 0);

type LoansContextValue = {
  /** Newest first. */
  loans: Loan[];
  /** Open balances: what people owe you and what you owe. */
  totals: { owedToYou: number; youOwe: number };
  addLoan: (loan: NewLoan) => void;
  updateLoan: (id: string, loan: NewLoan) => void;
  deleteLoan: (id: string) => void;
  /**
   * A partial or full repayment, with Undo. Server-side increment, like goals.
   * Paying back money you borrowed is also logged as an expense, so it counts against the budget.
   */
  recordPayment: (loan: Loan, amount: number) => void;
  clearAll: () => Promise<void>;
};

const LoansContext = createContext<LoansContextValue | null>(null);
const Name = 'loans';

function toFirestore(l: NewLoan) {
  const monthly = l.direction === 'borrowed' && l.months && l.installment;
  return {
    person: l.person,
    direction: l.direction,
    amount: l.amount,
    due: l.due ? Timestamp.fromDate(l.due) : null,
    note: l.note,
    remind: l.remind,
    months: monthly ? l.months : null,
    installment: monthly ? l.installment : null,
  };
}

/** Money lent to and borrowed from people: users/{uid}/loans. */
export function LoansProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAccount();
  const { showToast } = useToast();
  const { addTransaction, removeTransaction } = useTransactions();
  const [loans, setLoans] = useState<Loan[]>([]);

  useEffect(() => {
    if (!user) return;
    return watchCollection(userCollection(user.uid, Name), (docs) => {
      const list = docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          person: String(data.person ?? ''),
          direction: data.direction === 'borrowed' ? 'borrowed' : 'lent',
          amount: Number(data.amount) || 0,
          paid: Number(data.paid) || 0,
          due: toDate(data.due),
          note: String(data.note ?? ''),
          remind: data.remind === true,
          months: typeof data.months === 'number' && data.months > 0 ? data.months : null,
          installment: typeof data.installment === 'number' && data.installment > 0 ? data.installment : null,
          // A pending server timestamp reads as null for a moment.
          createdAt: toDate(data.createdAt) ?? new Date(),
        } satisfies Loan;
      });
      setLoans(list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    });
  }, [user]);

  const totals = useMemo(() => {
    let owedToYou = 0;
    let youOwe = 0;
    for (const l of loans) {
      if (l.direction === 'lent') owedToYou += remaining(l);
      else youOwe += remaining(l);
    }
    return { owedToYou, youOwe };
  }, [loans]);

  function addLoan(loan: NewLoan) {
    if (!user) return;
    put(userDoc(user.uid, Name, newId(userCollection(user.uid, Name))), { ...toFirestore(loan), paid: 0, createdAt: serverTime() });
  }

  function updateLoan(id: string, loan: NewLoan) {
    if (!user) return;
    patch(userDoc(user.uid, Name, id), toFirestore(loan));
  }

  function deleteLoan(id: string) {
    if (!user) return;
    remove(userDoc(user.uid, Name, id));
  }

  function recordPayment(loan: Loan, amount: number) {
    if (!user || amount <= 0) return;
    const ref = userDoc(user.uid, Name, loan.id);
    patch(ref, { paid: inc(amount) });
    const txId =
      loan.direction === 'borrowed'
        ? addTransaction({ type: 'expense', amount, category: 'bills', note: `Loan · ${loan.person}`.slice(0, 80), date: new Date(), loanId: loan.id })
        : undefined;
    const money = formatMoney(amount, profile?.currency);
    const settles = loan.paid + amount >= loan.amount;
    const text = loan.direction === 'lent' ? `${loan.person} paid back ${money}` : `You paid ${loan.person} ${money}`;
    showToast(settles ? `${text}. All settled!` : text, () => {
      patch(ref, { paid: inc(-amount) });
      if (txId) removeTransaction(txId);
    });
  }

  return (
    <LoansContext value={{ loans, totals, addLoan, updateLoan, deleteLoan, recordPayment, clearAll: async () => { if (user) clearCollection(userCollection(user.uid, Name)); } }}>
      {children}
    </LoansContext>
  );
}

export function useLoans() {
  const value = use(LoansContext);
  if (!value) throw new Error('useLoans must be used inside <LoansProvider>');
  return value;
}
