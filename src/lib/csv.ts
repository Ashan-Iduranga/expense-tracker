import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';

import { categoryInfo } from '@/data/categories';
import type { Transaction } from '@/data/transactions';

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
