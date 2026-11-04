import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import type { IconName } from '@/components/icon';
import { useAccount } from '@/data/account';
import { userCollection, userDoc } from '@/data/store';
import { clearCollection, inc, newId, patch, put, remove, serverTime, watchCollection } from '@/data/sync';

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

const Name = 'goals';

export function GoalsProvider({ children }: { children: ReactNode }) {
  const { user } = useAccount();
  const [goals, setGoals] = useState<Goal[]>([]);

  useEffect(() => {
    if (!user) return;
    return watchCollection(userCollection(user.uid, Name), (docs) => {
      const created = (d: (typeof docs)[number]) => (d.data().createdAt?.toMillis?.() as number | undefined) ?? Infinity;
      setGoals(
        [...docs]
          .sort((x, y) => created(x) - created(y))
          .map((d) => {
            const data = d.data();
            return { id: d.id, name: data.name, icon: data.icon, target: data.target, saved: data.saved ?? 0 };
          })
      );
    });
  }, [user]);

  function addGoal({ saved = 0, ...goal }: Omit<Goal, 'id' | 'saved'> & { saved?: number }) {
    if (!user) return;
    const id = newId(userCollection(user.uid, Name));
    put(userDoc(user.uid, Name, id), { ...goal, saved, createdAt: serverTime() });
    return id;
  }

  function addToGoal(id: string, amount: number) {
    if (!user) return;
    patch(userDoc(user.uid, Name, id), { saved: inc(amount) });
  }

  function deleteGoal(id: string) {
    if (!user) return;
    remove(userDoc(user.uid, Name, id));
  }

  async function clearAll() {
    if (!user) return;
    clearCollection(userCollection(user.uid, Name));
  }

  return <GoalsContext value={{ goals, addGoal, addToGoal, deleteGoal, clearAll }}>{children}</GoalsContext>;
}

export function useGoals() {
  const value = use(GoalsContext);
  if (!value) throw new Error('useGoals must be used inside <GoalsProvider>');
  return value;
}
