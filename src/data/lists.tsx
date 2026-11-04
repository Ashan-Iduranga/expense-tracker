import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { useAccount } from '@/data/account';
import { clearCollection, toDate, userCollection, userDoc } from '@/data/store';
import { newId, patch, put, remove, serverTime, watchCollection } from '@/data/sync';

export type ListItem = { id: string; name: string; qty: number; price: number | null; done: boolean };

export type ShoppingList = {
  id: string;
  name: string;
  budget: number | null;
  items: ListItem[];
  createdAt: Date;
};

/** Firestore rules allow up to this many items in one list. */
export const MaxItems = 100;

export function listTotals(list: ShoppingList) {
  let total = 0;
  let inCart = 0;
  let unpriced = 0;
  for (const i of list.items) {
    const line = (i.price ?? 0) * i.qty;
    total += line;
    if (i.done) inCart += line;
    if (i.price == null) unpriced++;
  }
  return { total, inCart, toBuy: total - inCart, left: list.budget != null ? list.budget - total : null, unpriced, doneCount: list.items.filter((i) => i.done).length };
}

type ListsContextValue = {
  lists: ShoppingList[];
  addList: (name: string, budget: number | null) => string | undefined;
  updateList: (id: string, changes: Partial<Pick<ShoppingList, 'name' | 'budget' | 'items'>>) => void;
  deleteList: (id: string) => void;
  clearAll: () => Promise<void>;
};

const ListsContext = createContext<ListsContextValue | null>(null);
const Name = 'lists';

function readItems(v: unknown): ListItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((i) => i && typeof i === 'object' && typeof i.name === 'string')
    .map((i) => ({
      id: String(i.id ?? Math.random().toString(36).slice(2)),
      name: i.name,
      qty: typeof i.qty === 'number' && i.qty > 0 ? i.qty : 1,
      price: typeof i.price === 'number' ? i.price : null,
      done: i.done === true,
    }));
}

/** Shopping lists with prices: users/{uid}/lists. Items live inside the list document. */
export function ListsProvider({ children }: { children: ReactNode }) {
  const { user } = useAccount();
  const [lists, setLists] = useState<ShoppingList[]>([]);

  useEffect(() => {
    if (!user) return;
    return watchCollection(userCollection(user.uid, Name), (docs) => {
      const all = docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: String(data.name ?? ''),
          budget: typeof data.budget === 'number' ? data.budget : null,
          items: readItems(data.items),
          createdAt: toDate(data.createdAt) ?? new Date(),
        } satisfies ShoppingList;
      });
      setLists(all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    });
  }, [user]);

  function addList(name: string, budget: number | null) {
    if (!user) return;
    const id = newId(userCollection(user.uid, Name));
    put(userDoc(user.uid, Name, id), { name, budget, items: [], createdAt: serverTime() });
    return id;
  }

  function updateList(id: string, changes: Partial<Pick<ShoppingList, 'name' | 'budget' | 'items'>>) {
    if (!user) return;
    patch(userDoc(user.uid, Name, id), changes);
  }

  function deleteList(id: string) {
    if (!user) return;
    remove(userDoc(user.uid, Name, id));
  }

  return (
    <ListsContext value={{ lists, addList, updateList, deleteList, clearAll: async () => { if (user) clearCollection(userCollection(user.uid, Name)); } }}>{children}</ListsContext>
  );
}

export function useLists() {
  const value = use(ListsContext);
  if (!value) throw new Error('useLists must be used inside <ListsProvider>');
  return value;
}
