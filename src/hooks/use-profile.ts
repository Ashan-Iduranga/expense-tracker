import { useAccount, type Profile } from '@/data/account';
import { Statuses } from '@/data/categories';

const Fallback: Profile = {
  name: '',
  status: 'other',
  incomeEnabled: false,
  income: null,
  incomeFrequency: 'irregular',
  payday: null,
  monthlyBudget: null,
  currency: 'Rs',
  theme: 'system',
  catBudgets: {},
};

/**
 * The profile, or safe defaults while offline before the first server snapshot.
 * Also returns the wording for the user's status ("Allowance", "Salary"…).
 */
export function useProfile() {
  const { profile } = useAccount();
  const p = profile ?? Fallback;
  return { profile: p, status: Statuses[p.status], hasProfile: !!profile };
}
