import { Timestamp } from 'firebase/firestore';
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { useAccount } from '@/data/account';
import type { CategoryId, TxType } from '@/data/categories';
import { useToast } from '@/data/toast';
import { userCollection, userDoc } from '@/data/store';
import { clearCollection, newId, patch, put, remove, removeField, serverTime, watchCollection } from '@/data/sync';

export type Transaction = {
  id: string;
  type: TxType;
  amount: number;
  category: CategoryId;
  note: string;
  date: Date;
  /** The spending plan (trip, event) this expense belongs to, if any. */
  planId?: string;
  /** The borrowed loan this expense pays back, if any. */
  loanId?: string;
};

export type NewTransaction = Omit<Transaction, 'id'>;

type TransactionsContextValue = {
  /** Newest first. */
  transactions: Transaction[];
  status: 'loading' | 'ready' | 'error';
  /** Returns the new document's id, so callers can undo it. */
  addTransaction: (tx: NewTransaction) => string | undefined;
  updateTransaction: (id: string, tx: NewTransaction) => void;
  /** Deletes straight away and shows a toast with Undo. */
  deleteTransaction: (id: string) => void;
  /** Deletes without a toast, for another screen's own Undo. */
  removeTransaction: (id: string) => void;
  /** Removes every transaction (Settings → Delete all data). */
  clearAll: () => Promise<void>;
};

const TransactionsContext = createContext<TransactionsContextValue | null>(null);

/**
 * Firestore path: users/{uid}/expenses. The name is kept from the first version so
 * existing data still loads; documents without a `type` are expenses.
 */
const Name = 'expenses';

function toFirestore(tx: NewTransaction) {
  return {
    type: tx.type,
    amount: tx.amount,
    category: tx.category,
    note: tx.note,
    date: Timestamp.fromDate(tx.date),
    ...(tx.planId ? { planId: tx.planId } : {}),
    ...(tx.loanId ? { loanId: tx.loanId } : {}),
  };
}

export function TransactionsProvider({ children }: { children: ReactNode }) {
  const { user, status: accountStatus } = useAccount();
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [listStatus, setListStatus] = useState<TransactionsContextValue['status']>('loading');
  // Read by deleteTransaction, which stays stable so swipe gestures holding it aren't rebuilt mid-drag.
  const txRef = useRef(transactions);
  useEffect(() => {
    txRef.current = transactions;
  }, [transactions]);
  const status = accountStatus === 'error' ? 'error' : listStatus;

  useEffect(() => {
    if (!user) return;
    return watchCollection(userCollection(user.uid, Name), (docs) => {
      setTransactions(
        docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            type: data.type === 'income' ? 'income' : 'expense',
            amount: data.amount,
            category: data.category,
            note: data.note,
            date: (data.date as Timestamp).toDate(),
            ...(typeof data.planId === 'string' ? { planId: data.planId } : {}),
            ...(typeof data.loanId === 'string' ? { loanId: data.loanId } : {}),
          } satisfies Transaction;
        }).sort((x, y) => y.date.getTime() - x.date.getTime())
      );
      setListStatus('ready');
    });
  }, [user]);

  function addTransaction(tx: NewTransaction) {
    if (!user) return;
    const id = newId(userCollection(user.uid, Name));
    put(userDoc(user.uid, Name, id), { ...toFirestore(tx), createdAt: serverTime() });
    return id;
  }

  function updateTransaction(id: string, tx: NewTransaction) {
    if (!user) return;
    // Taking an expense out of a plan removes the field rather than leaving an empty one.
    patch(userDoc(user.uid, Name, id), { ...toFirestore(tx), ...(tx.planId ? {} : { planId: removeField() }) });
  }

  function removeTransaction(id: string) {
    if (!user) return;
    remove(userDoc(user.uid, Name, id));
  }

  const deleteTransaction = useCallback(
    (id: string) => {
      const tx = txRef.current.find((t) => t.id === id);
      if (!user || !tx) return;
      remove(userDoc(user.uid, Name, id));
      showToast(`Deleted ${tx.note}`, () => {
        const { id: keep, ...rest } = tx;
        // Same document id, so it comes back exactly where it was.
        put(userDoc(user.uid, Name, keep), { ...toFirestore(rest), createdAt: serverTime() });
      });
    },
    [user, showToast]
  );

  async function clearAll() {
    if (!user) return;
    clearCollection(userCollection(user.uid, Name));
  }

  return (
    <TransactionsContext
      value={{ transactions, status, addTransaction, updateTransaction, deleteTransaction, removeTransaction, clearAll }}>
      {children}
    </TransactionsContext>
  );
}

export function useTransactions() {
  const value = use(TransactionsContext);
  if (!value) throw new Error('useTransactions must be used inside <TransactionsProvider>');
  return value;
}
