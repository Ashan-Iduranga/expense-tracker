import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { IncomeFrequencies, isExpenseCategory, Statuses, type ExpenseCategory, type IncomeFrequency, type Status } from '@/data/categories';
import { auth, db } from '@/lib/firebase';

export type ThemePref = 'system' | 'light' | 'dark';
export const Currencies = ['Rs', 'LKR', '₹', '$', '€', '£'] as const;

export type Profile = {
  name: string;
  status: Status;
  /** Optional for everyone. Off by default for students. */
  incomeEnabled: boolean;
  /** Usual amount per payment, used to pre-fill when it's logged. */
  income: number | null;
  /** How often money comes in; income can be logged any number of times a month. */
  incomeFrequency: IncomeFrequency;
  /** Day of the month monthly income arrives, for the reminder on Home. */
  payday: number | null;
  /** null means no monthly budget. */
  monthlyBudget: number | null;
  currency: string;
  theme: ThemePref;
  /** Monthly limit per expense category; missing means no limit. */
  catBudgets: Partial<Record<ExpenseCategory, number>>;
};

export const NameMaxLength = 24;
export const MaxAmount = 100_000_000;

/** Keeps only digits, for amount inputs. */
export function digitsOnly(text: string) {
  return text.replace(/[^0-9]/g, '').slice(0, 9);
}

/** Empty text means none (null); otherwise a positive whole amount, or undefined if invalid. */
export function parseAmount(text: string): number | null | undefined {
  if (text.trim() === '') return null;
  const value = Number(text);
  return Number.isInteger(value) && value > 0 && value <= MaxAmount ? value : undefined;
}

/** Reads a stored profile, filling in fields that older versions of the app didn't save. */
function fromFirestore(data: Record<string, unknown>): Profile {
  const status = (typeof data.status === 'string' && data.status in Statuses ? data.status : 'other') as Status;
  const catBudgets: Profile['catBudgets'] = {};
  if (data.catBudgets && typeof data.catBudgets === 'object') {
    for (const [id, v] of Object.entries(data.catBudgets as Record<string, unknown>)) {
      if (isExpenseCategory(id) && typeof v === 'number' && v > 0) catBudgets[id] = v;
    }
  }
  return {
    name: String(data.name ?? ''),
    status,
    incomeEnabled: typeof data.incomeEnabled === 'boolean' ? data.incomeEnabled : Statuses[status].incomeDefault,
    income: typeof data.income === 'number' ? data.income : null,
    incomeFrequency:
      typeof data.incomeFrequency === 'string' && data.incomeFrequency in IncomeFrequencies
        ? (data.incomeFrequency as IncomeFrequency)
        : Statuses[status].frequencyDefault,
    payday: typeof data.payday === 'number' ? data.payday : null,
    monthlyBudget: typeof data.monthlyBudget === 'number' ? data.monthlyBudget : null,
    currency: typeof data.currency === 'string' ? data.currency : 'Rs',
    theme: data.theme === 'light' || data.theme === 'dark' ? data.theme : 'system',
    catBudgets,
  };
}

type AccountContextValue = {
  user: User | null;
  /** null once loaded means a first launch: the user hasn't set up yet. */
  profile: Profile | null;
  status: 'loading' | 'ready' | 'error';
  /**
   * True from the moment setup saves the profile until the user leaves the
   * "Setting up your strip" checklist, so the router doesn't jump to Home mid-animation.
   */
  finishingSetup: boolean;
  /** First launch: creates the profile and starts the setup checklist. */
  saveProfile: (profile: Profile) => Promise<void>;
  finishSetup: () => void;
  /** Settings: changes some fields and keeps the rest. */
  updateProfile: (changes: Partial<Profile>) => Promise<void>;
  /** Removes the profile; the data providers clear their own collections first. */
  deleteProfile: () => Promise<void>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

/**
 * Signs in anonymously (the session is kept between launches) and keeps the
 * user's profile, stored at users/{uid}, in sync with Firestore.
 */
export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<AccountContextValue['status']>('loading');
  const [finishingSetup, setFinishingSetup] = useState(false);

  useEffect(
    () =>
      onAuthStateChanged(auth, (current) => {
        if (current) setUser(current);
        else signInAnonymously(auth).catch(() => setStatus('error'));
      }),
    []
  );

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      doc(db, 'users', user.uid),
      (snapshot) => {
        const data = snapshot.data();
        if (!data && snapshot.metadata.fromCache) {
          // Offline: we can't tell a first launch from a returning user yet,
          // so don't show onboarding. A server snapshot replaces this.
          setStatus('error');
          return;
        }
        setProfile(data ? fromFirestore(data) : null);
        setStatus('ready');
      },
      () => setStatus('error')
    );
  }, [user]);

  async function saveProfile(next: Profile) {
    if (!user) throw new Error('Not signed in yet');
    setFinishingSetup(true);
    await setDoc(doc(db, 'users', user.uid), { ...next, createdAt: serverTimestamp() });
  }

  async function updateProfile(changes: Partial<Profile>) {
    if (!user) throw new Error('Not signed in yet');
    await updateDoc(doc(db, 'users', user.uid), changes);
  }

  async function deleteProfile() {
    if (!user) throw new Error('Not signed in yet');
    await deleteDoc(doc(db, 'users', user.uid));
  }

  return (
    <AccountContext
      value={{
        user,
        profile,
        status,
        finishingSetup,
        saveProfile,
        finishSetup: () => setFinishingSetup(false),
        updateProfile,
        deleteProfile,
      }}>
      {children}
    </AccountContext>
  );
}

export function useAccount() {
  const value = use(AccountContext);
  if (!value) throw new Error('useAccount must be used inside <AccountProvider>');
  return value;
}
