import type { IconName } from '@/components/icon';

export type ExpenseCategory = 'food' | 'transport' | 'study' | 'bills' | 'shopping' | 'fun' | 'health' | 'other';
export type IncomeCategory = 'allowance' | 'salary' | 'freelance' | 'gift' | 'otherinc';
export type CategoryId = ExpenseCategory | IncomeCategory;
export type TxType = 'expense' | 'income';

type CategoryInfo = { name: string; short: string; icon: IconName };

export const ExpenseCategories: Record<ExpenseCategory, CategoryInfo> = {
  food: { name: 'Food & drinks', short: 'Food', icon: 'food' },
  transport: { name: 'Transport', short: 'Transport', icon: 'transport' },
  study: { name: 'Study', short: 'Study', icon: 'study' },
  bills: { name: 'Bills & reloads', short: 'Bills', icon: 'bills' },
  shopping: { name: 'Shopping', short: 'Shopping', icon: 'shopping' },
  fun: { name: 'Fun', short: 'Fun', icon: 'fun' },
  health: { name: 'Health', short: 'Health', icon: 'health' },
  other: { name: 'Other', short: 'Other', icon: 'other' },
};
export const ExpenseIds = Object.keys(ExpenseCategories) as ExpenseCategory[];

export const IncomeCategories: Record<IncomeCategory, CategoryInfo> = {
  allowance: { name: 'Allowance', short: 'Allowance', icon: 'wallet' },
  salary: { name: 'Salary', short: 'Salary', icon: 'briefcase' },
  freelance: { name: 'Freelance', short: 'Freelance', icon: 'laptop' },
  gift: { name: 'Gift', short: 'Gift', icon: 'gift' },
  otherinc: { name: 'Other income', short: 'Other', icon: 'sparkle' },
};

export function isExpenseCategory(id: string): id is ExpenseCategory {
  return id in ExpenseCategories;
}

export function categoryInfo(id: CategoryId): CategoryInfo {
  return isExpenseCategory(id) ? ExpenseCategories[id] : IncomeCategories[id] ?? ExpenseCategories.other;
}

/** The colour key in the palette's `cat` map. */
export function categoryColorKey(type: TxType, id: CategoryId) {
  return type === 'income' ? 'income' : isExpenseCategory(id) ? id : 'other';
}

/**
 * Who the user is. It only changes wording and defaults: income is optional for
 * everyone, and a student never has to add any.
 */
export type Status = 'student' | 'employee' | 'self' | 'other';

/** How often money comes in. Only 'monthly' has a payday reminder. */
export type IncomeFrequency = 'monthly' | 'few' | 'weekly' | 'irregular';

export const IncomeFrequencies: Record<IncomeFrequency, { label: string }> = {
  monthly: { label: 'Once a month' },
  few: { label: '2–3 times a month' },
  weekly: { label: 'Every week' },
  irregular: { label: 'Whenever I get paid' },
};
export const FrequencyIds = Object.keys(IncomeFrequencies) as IncomeFrequency[];

/** Label for the usual-amount field, which is per payment. */
export function usualAmountLabel(word: string, freq: IncomeFrequency) {
  return freq === 'monthly' ? `Usual ${word.toLowerCase()} a month` : 'Usual amount each time';
}

export const Statuses: Record<
  Status,
  {
    label: string;
    icon: IconName;
    blurb: string;
    /** What money coming in is called. */
    word: string;
    incomeCats: IncomeCategory[];
    incomeDefault: boolean;
    frequencyDefault: IncomeFrequency;
    question: string;
    budgetSuggestions: number[];
  }
> = {
  student: {
    label: 'Student',
    icon: 'cap',
    blurb: 'My family supports me. I might get pocket money.',
    word: 'Allowance',
    incomeCats: ['allowance', 'gift', 'freelance', 'otherinc'],
    incomeDefault: false,
    frequencyDefault: 'few',
    question: 'Do you get pocket money or an allowance?',
    budgetSuggestions: [15000, 25000, 40000],
  },
  employee: {
    label: 'Employee',
    icon: 'briefcase',
    blurb: 'I get a salary every month.',
    word: 'Salary',
    incomeCats: ['salary', 'freelance', 'gift', 'otherinc'],
    incomeDefault: true,
    frequencyDefault: 'monthly',
    question: 'Track your monthly salary?',
    budgetSuggestions: [50000, 100000, 150000],
  },
  self: {
    label: 'Self-employed',
    icon: 'laptop',
    blurb: 'Freelance or business. My income changes.',
    word: 'Income',
    incomeCats: ['freelance', 'salary', 'gift', 'otherinc'],
    incomeDefault: true,
    frequencyDefault: 'irregular',
    question: 'Track the money you earn?',
    budgetSuggestions: [50000, 100000, 150000],
  },
  other: {
    label: 'Other',
    icon: 'user',
    blurb: 'Something else, or I would rather not say.',
    word: 'Income',
    incomeCats: ['otherinc', 'allowance', 'salary', 'gift'],
    incomeDefault: false,
    frequencyDefault: 'irregular',
    question: 'Do you have any income to track?',
    budgetSuggestions: [25000, 50000, 100000],
  },
};
export const StatusIds = Object.keys(Statuses) as Status[];

export const GoalIcons: IconName[] = ['laptop', 'mountain', 'shield', 'phone', 'gift', 'cap', 'health', 'transport'];
