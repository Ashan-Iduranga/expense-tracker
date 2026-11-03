import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';

import type { IconName } from '@/components/icon';
import { useAccount } from '@/data/account';
import { db } from '@/lib/firebase';

export type Goal = {
  id: string;
  name: string;
  icon: IconName;
  target: number;
  saved: number;
};

type GoalsContextValue = {
  goals: Goal[];
  /** Returns the new goal's id. `saved` starts it with money already in it. */
  addGoal: (goal: Omit<Goal, 'id' | 'saved'> & { saved?: number }) => string | undefined;
  /** Adds money to a goal. Uses a server-side increment so two phones can't overwrite each other. */
  addToGoal: (id: string, amount: number) => void;
  deleteGoal: (id: string) => void;
  clearAll: () => Promise<void>;
};

const GoalsContext = createContext<GoalsContextValue | null>(null);

/** Firestore path: users/{uid}/goals. */
function goalsCollection(uid: string) {
  return collection(db, 'users', uid, 'goals');
}

function fail(action: string) {
  return (error: unknown) => {
    console.error(`${action} failed`, error);
    Alert.alert(`Couldn’t ${action.toLowerCase()}`, 'The server rejected the change. Please try again.');
  };
}

export function GoalsProvider({ children }: { children: ReactNode }) {
  const { user } = useAccount();
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(query(goalsCollection(user.uid), orderBy('createdAt', 'asc')), (snapshot) => {
      setGoals(
        snapshot.docs.map((d) => {
          const data = d.data();
          return { id: d.id, name: data.name, icon: data.icon, target: data.target, saved: data.saved ?? 0 };
        })
      );
    });
  }, [user]);

  function addGoal({ saved = 0, ...goal }: Omit<Goal, 'id' | 'saved'> & { saved?: number }) {
    if (!user) return;
    const ref = doc(goalsCollection(user.uid));
    setDoc(ref, { ...goal, saved, createdAt: serverTimestamp() }).catch(fail('Create goal'));
    return ref.id;
  }

  function addToGoal(id: string, amount: number) {
    if (!user) return;
    updateDoc(doc(goalsCollection(user.uid), id), { saved: increment(amount) }).catch(fail('Add to goal'));
  }

  function deleteGoal(id: string) {
    if (!user) return;
    deleteDoc(doc(goalsCollection(user.uid), id)).catch(fail('Delete goal'));
  }

  async function clearAll() {
    if (!user) return;
    const snap = await getDocs(goalsCollection(user.uid));
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  return <GoalsContext value={{ goals, addGoal, addToGoal, deleteGoal, clearAll }}>{children}</GoalsContext>;
}

export function useGoals() {
  const value = use(GoalsContext);
  if (!value) throw new Error('useGoals must be used inside <GoalsProvider>');
  return value;
}
