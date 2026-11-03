import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { IconName } from '@/components/icon';
import { useAccount } from '@/data/account';
import { clearCollection, reportFailure, toDate, userCollection } from '@/data/store';
import { useTransactions } from '@/data/transactions';
import { shortMonth, startOfDay } from '@/lib/format';

/** A budget for one event or trip; expenses join it through their planId. */
export type Plan = {
  id: string;
  name: string;
  icon: IconName;
  budget: number;
  start: Date;
  /** null: open-ended. */
  end: Date | null;
  createdAt: Date;
};

export type NewPlan = Omit<Plan, 'id' | 'createdAt'>;

export const PlanIcons: IconName[] = ['map', 'mountain', 'gift', 'fun', 'food', 'cap', 'transport', 'sparkle'];

/** Today falls inside the plan's dates (or it has no end yet). */
export function isActive(p: Plan, now = new Date()) {
  const t = startOfDay(now);
  return startOfDay(p.start) <= t && (!p.end || startOfDay(p.end) >= t);
}

/** "12 Dec – 15 Dec" · "From 3 Nov" */
export function planDates(p: Plan) {
  const f = (d: Date) => `${d.getDate()} ${shortMonth(d.getMonth())}`;
  return p.end ? `${f(p.start)} – ${f(p.end)}` : `From ${f(p.start)}`;
}

type PlansContextValue = {
  plans: Plan[];
  /** Spent per plan id, from the tagged expenses. */
  spent: Record<string, number>;
  addPlan: (plan: NewPlan) => void;
  updatePlan: (id: string, plan: NewPlan) => void;
  deletePlan: (id: string) => void;
  clearAll: () => Promise<void>;
};

const PlansContext = createContext<PlansContextValue | null>(null);
const Name = 'plans';

function toFirestore(p: NewPlan) {
  return { name: p.name, icon: p.icon, budget: p.budget, start: Timestamp.fromDate(p.start), end: p.end ? Timestamp.fromDate(p.end) : null };
}

/** Spending plans for trips and events: users/{uid}/plans. */
export function PlansProvider({ children }: { children: ReactNode }) {
  const { user } = useAccount();
  const { transactions } = useTransactions();
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(userCollection(user.uid, Name), (snap) => {
      const all = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: String(data.name ?? ''),
          icon: (PlanIcons as string[]).includes(data.icon) ? (data.icon as IconName) : 'map',
          budget: Number(data.budget) || 0,
          start: toDate(data.start) ?? new Date(),
          end: toDate(data.end),
          createdAt: toDate(data.createdAt) ?? new Date(),
        } satisfies Plan;
      });
      setPlans(all.sort((a, b) => b.start.getTime() - a.start.getTime()));
    });
  }, [user]);

  const spent = useMemo(() => {
    const out: Record<string, number> = {};
    for (const t of transactions) if (t.planId && t.type === 'expense') out[t.planId] = (out[t.planId] ?? 0) + t.amount;
    return out;
  }, [transactions]);

  function addPlan(plan: NewPlan) {
    if (!user) return;
    setDoc(doc(userCollection(user.uid, Name)), { ...toFirestore(plan), createdAt: serverTimestamp() }).catch(reportFailure('Create plan'));
  }

  function updatePlan(id: string, plan: NewPlan) {
    if (!user) return;
    updateDoc(doc(userCollection(user.uid, Name), id), toFirestore(plan)).catch(reportFailure('Save plan'));
  }

  /** The expenses stay in History; they just lose their plan tag. */
  function deletePlan(id: string) {
    if (!user) return;
    deleteDoc(doc(userCollection(user.uid, Name), id)).catch(reportFailure('Delete plan'));
  }

  return (
    <PlansContext value={{ plans, spent, addPlan, updatePlan, deletePlan, clearAll: async () => { if (user) await clearCollection(user.uid, Name); } }}>
      {children}
    </PlansContext>
  );
}

export function usePlans() {
  const value = use(PlansContext);
  if (!value) throw new Error('usePlans must be used inside <PlansProvider>');
  return value;
}
