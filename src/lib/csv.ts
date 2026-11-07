import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';

import { categoryInfo, ExpenseCategories, IncomeCategories, type CategoryId, type TxType } from '@/data/categories';
import type { NewTransaction, Transaction } from '@/data/transactions';

function toCsv(txs: Transaction[]) {
  const rows: (string | number)[][] = [['Date', 'Type', 'Category', 'Note', 'Amount']];
  for (const t of txs) {
    const d = t.date;
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    rows.push([date, t.type, categoryInfo(t.category).name, t.note, t.amount]);
  }
  return rows
    .map((r) => r.map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))).join(','))
    .join('\n');
}

/**
 * Writes daily-strip.csv to the cache folder and opens the share sheet, so it can go
 * to Drive, email or Sheets. Falls back to sharing the text where files can't be shared.
 */
export async function exportCsv(txs: Transaction[]) {
  const csv = toCsv(txs);
  if (Platform.OS !== 'web' && (await Sharing.isAvailableAsync())) {
    const file = new File(Paths.cache, 'daily-strip.csv');
    if (file.exists) file.delete();
    file.create();
    await file.write(csv);
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export transactions', UTI: 'public.comma-separated-values-text' });
    return;
  }
  await Share.share({ message: csv, title: 'daily-strip.csv' });
}

// ---------- Import ----------

/** Splits CSV text into rows of fields: quoted fields, "" escapes, commas and newlines inside quotes, CRLF, BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const s = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}

/** "2026-08-14" or "14/08/2026" → that day at noon (the export has no time). */
function parseDay(v: string): Date | null {
  const t = v.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (match) [y, m, d] = [+match[1], +match[2], +match[3]];
  else if ((match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t))) [d, m, y] = [+match[1], +match[2], +match[3]];
  else return null;
  const date = new Date(y, m - 1, d, 12, 0);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

function findCategory(v: string, type: TxType): CategoryId {
  const key = v.trim().toLowerCase();
  const table: Record<string, { name: string; short: string }> = type === 'income' ? IncomeCategories : ExpenseCategories;
  for (const [id, info] of Object.entries(table)) {
    if (key === id || key === info.name.toLowerCase() || key === info.short.toLowerCase()) return id as CategoryId;
  }
  return type === 'income' ? 'otherinc' : 'other';
}

export type CsvImport = { txs: NewTransaction[]; skipped: number };

/** Turns parsed rows (with a header row) into transactions. Rows that can't be read are counted, not thrown. */
export function rowsToTransactions(rows: string[][]): CsvImport {
  if (rows.length === 0) return { txs: [], skipped: 0 };
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => head.indexOf(name);
  const iDate = col('date');
  const iAmount = col('amount');
  if (iDate < 0 || iAmount < 0) return { txs: [], skipped: rows.length - 1 };
  const iType = col('type');
  const iCat = col('category');
  const iNote = col('note');
  const txs: NewTransaction[] = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const date = parseDay(r[iDate] ?? '');
    const amount = Math.round(parseFloat((r[iAmount] ?? '').replace(/[^0-9.]/g, '')) * 100) / 100;
    if (!date || !(amount > 0)) {
      skipped++;
      continue;
    }
    const type: TxType = (r[iType] ?? '').trim().toLowerCase() === 'income' ? 'income' : 'expense';
    const category = findCategory(r[iCat] ?? '', type);
    const note = (r[iNote] ?? '').trim().slice(0, 60) || categoryInfo(category).name;
    txs.push({ type, amount, category, note, date });
  }
  return { txs, skipped };
}

/** Opens the file picker for a CSV and returns its text, or null if the user cancelled. */
export async function pickCsvText(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'application/csv', 'application/vnd.ms-excel', 'text/plain'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  if (Platform.OS === 'web') return asset.file ? asset.file.text() : (await fetch(asset.uri)).text();
  return new File(asset.uri).text();
}
