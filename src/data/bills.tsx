import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAccount } from '@/data/account';
import { isExpenseCategory, type ExpenseCategory } from '@/data/categories';
import { clearCollection, reportFailure, toDate, userCollection } from '@/data/store';
import { useToast } from '@/data/toast';
import { useTransactions } from '@/data/transactions';
import { formatMoney } from '@/lib/format';
import { advance, monthlyCost, type Cycle } from '@/lib/recurring';

export type BillKind = 'bill' | 'subscription';

export type Bill = {
  id: string;
  name: string;
  amount: number;
  category: ExpenseCategory;
  kind: BillKind;
  cycle: Cycle;
  nextDue: Date;
  /** Day of the month it's due, so month-end bills don't drift. */
  anchor: number;
  remind: boolean;
};

export type NewBill = Omit<Bill, 'id' | 'anchor'>;

type BillsContextValue = {
  /** Soonest due first. */
  bills: Bill[];
  /** Everything, as a monthly figure. */
  monthly: { total: number; subscriptions: number; bills: number };
  addBill: (bill: NewBill) => void;
  updateBill: (id: string, bill: NewBill) => void;
  deleteBill: (id: string) => void;
  /** Logs the expense and moves the due date on one cycle, with Undo. */
  markPaid: (bill: Bill) => void;
  clearAll: () => Promise<void>;
};

const BillsContext = createContext<BillsContextValue | null>(null);
const Name = 'bills';

function toFirestore(b: NewBill) {
  return {
    name: b.name,
    amount: b.amount,
    category: b.category,
    kind: b.kind,
    cycle: b.cycle,
    nextDue: Timestamp.fromDate(b.nextDue),
    anchor: b.nextDue.getDate(),
    remind: b.remind,
  };
}

/** Bills, subscriptions and other repeating charges: users/{uid}/bills. */
export function BillsProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAccount();
  const { addTransaction, removeTransaction } = useTransactions();
  const { showToast } = useToast();
  const [bills, setBills] = useState<Bill[]>([]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(userCollection(user.uid, Name), (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data();
        const nextDue = toDate(data.nextDue) ?? new Date();
        return {
          id: d.id,
          name: String(data.name ?? ''),
          amount: Number(data.amount) || 0,
          category: isExpenseCategory(data.category) ? data.category : 'other',
          kind: data.kind === 'subscription' ? 'subscription' : 'bill',
          cycle: data.cycle === 'weekly' || data.cycle === 'yearly' ? data.cycle : 'monthly',
          nextDue,
          anchor: typeof data.anchor === 'number' ? data.anchor : nextDue.getDate(),
          remind: data.remind === true,
        } satisfies Bill;
      });
      setBills(list.sort((a, b) => a.nextDue.getTime() - b.nextDue.getTime()));
    });
  }, [user]);

  const monthly = useMemo(() => {
    let subscriptions = 0;
    let other = 0;
    for (const b of bills) {
      const m = monthlyCost(b.amount, b.cycle);
      if (b.kind === 'subscription') subscriptions += m;
      else other += m;
    }
    return { total: subscriptions + other, subscriptions, bills: other };
  }, [bills]);

  function addBill(bill: NewBill) {
    if (!user) return;
    setDoc(doc(userCollection(user.uid, Name)), { ...toFirestore(bill), createdAt: serverTimestamp() }).catch(reportFailure('Save bill'));
  }

  function updateBill(id: string, bill: NewBill) {
    if (!user) return;
    updateDoc(doc(userCollection(user.uid, Name), id), toFirestore(bill)).catch(reportFailure('Save bill'));
  }

  function deleteBill(id: string) {
    if (!user) return;
    deleteDoc(doc(userCollection(user.uid, Name), id)).catch(reportFailure('Delete bill'));
  }

  function markPaid(bill: Bill) {
    if (!user) return;
    const ref = doc(userCollection(user.uid, Name), bill.id);
    const txId = addTransaction({ type: 'expense', amount: bill.amount, category: bill.category, note: bill.name, date: new Date() });
    const next = advance(bill.nextDue, bill.cycle, bill.anchor);
    updateDoc(ref, { nextDue: Timestamp.fromDate(next) }).catch(reportFailure('Update bill'));
    showToast(`Paid ${bill.name} · ${formatMoney(bill.amount, profile?.currency)}`, () => {
      if (txId) removeTransaction(txId);
      updateDoc(ref, { nextDue: Timestamp.fromDate(bill.nextDue) }).catch(reportFailure('Undo'));
    });
  }

  return (
    <BillsContext value={{ bills, monthly, addBill, updateBill, deleteBill, markPaid, clearAll: async () => { if (user) await clearCollection(user.uid, Name); } }}>
      {children}
    </BillsContext>
  );
}

export function useBills() {
  const value = use(BillsContext);
  if (!value) throw new Error('useBills must be used inside <BillsProvider>');
  return value;
}
