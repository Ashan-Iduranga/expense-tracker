import { dayLabel, startOfDay } from '@/lib/format';

export type Cycle = 'weekly' | 'monthly' | 'yearly';

export const Cycles: Record<Cycle, { label: string; per: string }> = {
  weekly: { label: 'Weekly', per: 'a week' },
  monthly: { label: 'Monthly', per: 'a month' },
  yearly: { label: 'Yearly', per: 'a year' },
};
export const CycleIds = Object.keys(Cycles) as Cycle[];

/**
 * The next due date after `date`. Monthly and yearly bills keep their day of the month
 * (`anchor`), so one due on the 31st lands on 28 Feb and then back on 31 Mar.
 */
export function advance(date: Date, cycle: Cycle, anchor: number) {
  if (cycle === 'weekly') return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7);
  const months = cycle === 'monthly' ? 1 : 12;
  const y = date.getFullYear();
  const m = date.getMonth() + months;
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(anchor, last));
}

/** Roughly what a charge costs per month, for the "Rs X a month" total. */
export function monthlyCost(amount: number, cycle: Cycle) {
  return cycle === 'weekly' ? (amount * 52) / 12 : cycle === 'yearly' ? amount / 12 : amount;
}

/** Whole days from today to `date`; negative when it's past. */
export function daysUntil(date: Date, now = new Date()) {
  return Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / 86_400_000);
}

/** "Overdue by 2 days" · "Due today" · "Due tomorrow" · "Due in 5 days" · "Due Mon 27 Oct". */
export function dueLabel(date: Date, now = new Date()) {
  const d = daysUntil(date, now);
  if (d < 0) return `Overdue by ${-d} day${d === -1 ? '' : 's'}`;
  if (d === 0) return 'Due today';
  if (d === 1) return 'Due tomorrow';
  if (d <= 14) return `Due in ${d} days`;
  return `Due ${dayLabel(date, now)}`;
}

/** Shown in "Due soon" lists: overdue or within this many days. */
export const SoonDays = 3;
