export const MonthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const DayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function shortMonth(month: number) {
  return MonthNames[month].slice(0, 3);
}

/** "24,680" — whole units with grouping. */
export function formatNumber(amount: number) {
  return Math.round(Math.abs(amount)).toLocaleString('en-US');
}

/** "Rs 24,680", "−Rs 900", "+Rs 145,000", "$1,200". Letters get a space, symbols don't. */
export function formatMoney(amount: number, currency = 'Rs', sign: '' | '+' | '−' = '') {
  const lead = amount < -0.5 ? '−' : sign;
  const gap = /^[A-Za-z]/.test(currency) ? ' ' : '';
  return `${lead}${currency}${gap}${formatNumber(amount)}`;
}

/** "12.5k" for chart labels. */
export function formatK(n: number) {
  if (n < 1000) return String(Math.round(n));
  return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}k`;
}

/** Same number grouping as formatNumber, but runs on the UI thread for animated counters. */
export function groupDigits(value: number) {
  'worklet';
  const n = Math.round(Math.abs(value));
  const s = String(n);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ',';
    out += s[i];
  }
  return out;
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Today" · "Yesterday" · "Mon 27 Oct" */
export function dayLabel(date: Date, now = new Date()) {
  if (sameDay(date, now)) return 'Today';
  if (sameDay(date, addDays(now, -1))) return 'Yesterday';
  return `${DayNames[date.getDay()]} ${date.getDate()} ${shortMonth(date.getMonth())}`;
}

/** "8:35 am" */
export function timeLabel(date: Date) {
  let h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

/** "Today, 8:35 am" · "Mon 27 Oct" */
export function whenLabel(date: Date, now = new Date()) {
  const day = dayLabel(date, now);
  return day === 'Today' || day === 'Yesterday' ? `${day}, ${timeLabel(date)}` : day;
}

export function ordinal(n: number) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${n}${s}`;
}

export function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
