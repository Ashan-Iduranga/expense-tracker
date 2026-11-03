import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Segmented } from '@/components/controls';
import { Icon } from '@/components/icon';
import { Enter } from '@/components/motion';
import { EmptyState, Screen } from '@/components/screen';
import { Txt } from '@/components/txt';
import { TxRow } from '@/components/tx-row';
import { ListReflow, RowEnter, RowExit } from '@/constants/motion';
import { Fonts } from '@/constants/theme';
import { categoryInfo, type TxType } from '@/data/categories';
import { useTransactions, type Transaction } from '@/data/transactions';
import { useColors } from '@/hooks/use-colors';
import { useProfile } from '@/hooks/use-profile';
import { dayLabel, formatMoney } from '@/lib/format';

type Filter = 'all' | TxType;

/** Show at most this many days, so a long history stays quick to scroll. */
const MaxDays = 60;

export default function History() {
  const c = useColors();
  const { profile: p, status: st } = useProfile();
  const { transactions, deleteTransaction } = useTransactions();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const hasIncome = p.incomeEnabled || transactions.some((t) => t.type === 'income');
  const active: Filter = !hasIncome && filter === 'income' ? 'all' : filter;

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter(
      (t) =>
        (active === 'all' || t.type === active) &&
        (!q || t.note.toLowerCase().includes(q) || categoryInfo(t.category).name.toLowerCase().includes(q))
    );
  }, [transactions, query, active]);

  const groups = useMemo(() => {
    const out: { key: string; date: Date; items: Transaction[]; spent: number; income: number }[] = [];
    for (const t of items) {
      const key = t.date.toDateString();
      let g = out[out.length - 1];
      if (!g || g.key !== key) {
        if (out.length >= MaxDays) break;
        g = { key, date: t.date, items: [], spent: 0, income: 0 };
        out.push(g);
      }
      g.items.push(t);
      if (t.type === 'income') g.income += t.amount;
      else g.spent += t.amount;
    }
    return out;
  }, [items]);

  const openTx = (id: string) => router.push({ pathname: '/add', params: { id } });

  return (
    <Screen>
      <Enter index={0}>
        <Txt variant="title" role="heading">
          History
        </Txt>
      </Enter>

      <Enter index={1} style={{ gap: 12 }}>
        <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.line2 }]}>
          <Icon name="search" size={20} color={c.ink3} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search notes or categories"
            placeholderTextColor={c.ink3}
            aria-label="Search transactions"
            returnKeyType="search"
            autoCorrect={false}
            style={[styles.searchInput, { color: c.ink }]}
          />
          {query.length > 0 && (
            <Pressable role="button" aria-label="Clear search" hitSlop={10} onPress={() => setQuery('')}>
              <Icon name="close" size={18} color={c.ink3} />
            </Pressable>
          )}
        </View>
        <Segmented<Filter>
          label="Show"
          value={active}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'expense', label: 'Expenses' },
            ...(hasIncome ? [{ value: 'income' as Filter, label: st.word }] : []),
          ]}
        />
        <View style={styles.hint}>
          <Icon name="back" size={14} color={c.ink3} />
          <Txt variant="caption" color="ink3">
            Swipe a row left to delete it, or tap it to edit.
          </Txt>
        </View>
      </Enter>

      <Enter index={2} style={{ gap: 14 }}>
        {!transactions.length ? (
          <EmptyState icon="list" title="No transactions yet" body="Everything you log shows up here, grouped by day." action="Add expense" onAction={() => router.push('/add')} />
        ) : !items.length ? (
          <EmptyState icon="search" title={`No results for “${query}”`} body="Try a shorter word, or search a category like “food”." action="Clear search" onAction={() => setQuery('')} />
        ) : (
          <>
            <Txt variant="caption" color="ink3">
              {items.length} transaction{items.length === 1 ? '' : 's'}
              {query ? ' found' : ''}
            </Txt>
            {groups.map((g) => (
              <Animated.View key={g.key} layout={ListReflow} style={{ gap: 6 }}>
                <View style={styles.dayHead}>
                  <Txt variant="smallBold" color="ink2">
                    {dayLabel(g.date)}
                  </Txt>
                  <Txt variant="smallBold" color="ink2">
                    {g.spent ? formatMoney(g.spent, p.currency, '−') : ''}
                    {g.income ? (
                      <Txt variant="smallBold" color={c.posInk}>
                        {'  '}
                        {formatMoney(g.income, p.currency, '+')}
                      </Txt>
                    ) : null}
                  </Txt>
                </View>
                {g.items.map((t) => (
                  <Animated.View key={t.id} entering={RowEnter} exiting={RowExit} layout={ListReflow}>
                    <TxRow tx={t} currency={p.currency} onPress={openTx} onDelete={deleteTransaction} />
                  </Animated.View>
                ))}
              </Animated.View>
            ))}
          </>
        )}
      </Enter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5 },
  searchInput: { flex: 1, minWidth: 0, fontFamily: Fonts.medium, fontSize: 16, paddingVertical: 10 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
});
