import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';

import { useAccount } from '@/data/account';
import type { CategoryId, TxType } from '@/data/categories';
import { useToast } from '@/data/toast';
import { db } from '@/lib/firebase';

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
function txCollection(uid: string) {
  return collection(db, 'users', uid, 'expenses');
}

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

/**
 * Writes aren't awaited: the snapshot listener shows changes straight away, and
 * Firestore keeps retrying in the background if the phone is offline.
 * This reports the rare write the server rejects.
 */
function reportFailure(action: string) {
  return (error: unknown) => {
    console.error(`${action} failed`, error);
    Alert.alert(`Couldn’t ${action.toLowerCase()}`, 'The server rejected the change. Please try again.');
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
    const q = query(txCollection(user.uid), orderBy('date', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => {
        setTransactions(
          snapshot.docs.map((d) => {
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
            };
          })
        );
        setListStatus('ready');
      },
      () => setListStatus('error')
    );
  }, [user]);

  function addTransaction(tx: NewTransaction) {
    if (!user) return;
    const ref = doc(txCollection(user.uid));
    setDoc(ref, { ...toFirestore(tx), createdAt: serverTimestamp() }).catch(reportFailure('Save'));
    return ref.id;
  }

  function updateTransaction(id: string, tx: NewTransaction) {
    if (!user) return;
    // Taking an expense out of a plan removes the field rather than leaving an empty one.
    updateDoc(doc(txCollection(user.uid), id), { ...toFirestore(tx), ...(tx.planId ? {} : { planId: deleteField() }) }).catch(
      reportFailure('Save changes')
    );
  }

  function removeTransaction(id: string) {
    if (!user) return;
    deleteDoc(doc(txCollection(user.uid), id)).catch(reportFailure('Undo'));
  }

  const deleteTransaction = useCallback(
    (id: string) => {
      const tx = txRef.current.find((t) => t.id === id);
      if (!user || !tx) return;
      deleteDoc(doc(txCollection(user.uid), id)).catch(reportFailure('Delete'));
      showToast(`Deleted ${tx.note}`, () => {
        const { id: keep, ...rest } = tx;
        // Same document id, so it comes back exactly where it was.
        setDoc(doc(txCollection(user.uid), keep), { ...toFirestore(rest), createdAt: serverTimestamp() }).catch(
          reportFailure('Restore')
        );
      });
    },
    [user, showToast]
  );

  async function clearAll() {
    if (!user) return;
    const snap = await getDocs(txCollection(user.uid));
    // Firestore batches hold up to 500 writes.
    for (let i = 0; i < snap.docs.length; i += 450) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
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
