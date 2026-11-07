import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/controls';
import { Icon } from '@/components/icon';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/txt';
import { Radius } from '@/constants/theme';
import { useToast } from '@/data/toast';
import { txKey, useTransactions, type NewTransaction } from '@/data/transactions';
import { useColors } from '@/hooks/use-colors';
import { useProfile } from '@/hooks/use-profile';
import { parseCsv, pickCsvText, rowsToTransactions } from '@/lib/csv';
import { formatMoney } from '@/lib/format';

type Preview = { txs: NewTransaction[]; skipped: number; duplicates: number };

const day = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Import from an exported CSV: pick the file, see what's in it, then import.
 * Dates stay as they were in the file, so months the user didn't track simply stay empty.
 * Returns `start` to open the picker and `sheet` to render once on the screen.
 */
export function useCsvImport(onDone?: (added: number) => void) {
  const c = useColors();
  const { profile: p } = useProfile();
  const { transactions, importTransactions } = useTransactions();
  const { showToast } = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [open, setOpen] = useState(false);

  async function start() {
    let text: string | null;
    try {
      text = await pickCsvText();
    } catch {
      return showToast('Couldn’t open that file. Please try again.');
    }
    if (text === null) return;
    const { txs, skipped } = rowsToTransactions(parseCsv(text));
    if (txs.length === 0) return showToast('No transactions found. Use a CSV exported from Daily Strip.');
    const have = new Map<string, number>();
    for (const t of transactions) have.set(txKey(t), (have.get(txKey(t)) ?? 0) + 1);
    let duplicates = 0;
    for (const t of txs) {
      const n = have.get(txKey(t)) ?? 0;
      if (n > 0) {
        have.set(txKey(t), n - 1);
        duplicates++;
      }
    }
    setPreview({ txs, skipped, duplicates });
    setOpen(true);
  }

  function confirm() {
    if (!preview) return;
    const { added } = importTransactions(preview.txs);
    setOpen(false);
    showToast(added ? `Imported ${added} transaction${added === 1 ? '' : 's'}` : 'Everything in that file is already here');
    onDone?.(added);
  }

  let body = null;
  if (preview) {
    const { txs, skipped, duplicates } = preview;
    const times = txs.map((t) => t.date.getTime());
    const from = new Date(Math.min(...times));
    const to = new Date(Math.max(...times));
    const income = txs.filter((t) => t.type === 'income');
    const spent = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const fresh = txs.length - duplicates;
    body = (
      <View style={{ gap: 14 }}>
        <View style={[styles.card, { backgroundColor: c.surface2 }]}>
          <Txt variant="bodyBold">
            {txs.length} transaction{txs.length === 1 ? '' : 's'}
          </Txt>
          <Txt variant="small" color="ink2">
            {day(from)} – {day(to)}
          </Txt>
          <Txt variant="small" color="ink2">
            {txs.length - income.length} expenses · {formatMoney(spent, p.currency)} spent{income.length ? ` · ${income.length} income` : ''}
          </Txt>
        </View>
        {(duplicates > 0 || skipped > 0) && (
          <View style={{ gap: 4 }}>
            {duplicates > 0 && <Note icon="check" text={`${duplicates} already in the app, will be skipped`} />}
            {skipped > 0 && <Note icon="alert" text={`${skipped} row${skipped === 1 ? '' : 's'} couldn’t be read`} />}
          </View>
        )}
        <Txt variant="small" color="ink2">
          Dates are kept as they were. Months you didn’t track stay empty, and you carry on from today. You can still add older days from the Add screen.
        </Txt>
        <PrimaryButton label={fresh > 0 ? `Import ${fresh}` : 'Nothing new to import'} disabled={fresh === 0} icon="upload" onPress={confirm} />
      </View>
    );
  }

  const sheet = (
    <Sheet visible={open} onClose={() => setOpen(false)} title="Import CSV">
      {body}
    </Sheet>
  );
  return { start, sheet };
}

function Note({ icon, text }: { icon: 'check' | 'alert'; text: string }) {
  const c = useColors();
  return (
    <View style={styles.note}>
      <Icon name={icon} size={16} color={c.ink3} />
      <Txt variant="small" color="ink2" style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.row, padding: 16, gap: 2 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
