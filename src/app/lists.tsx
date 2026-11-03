import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { PrimaryButton } from '@/components/controls';
import { FieldLabel, FormError, MoneyField, TextField } from '@/components/form';
import { Icon } from '@/components/icon';
import { Enter, ProgressBar } from '@/components/motion';
import { PressableScale } from '@/components/pressable-scale';
import { EmptyState, NewButton, Screen, StackHeader } from '@/components/screen';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/txt';
import { ListReflow, RowEnter, RowExit } from '@/constants/motion';
import { Radius } from '@/constants/theme';
import { MaxAmount } from '@/data/account';
import { listTotals, useLists, type ShoppingList } from '@/data/lists';
import { useColors } from '@/hooks/use-colors';
import { useProfile } from '@/hooks/use-profile';
import { formatMoney } from '@/lib/format';

const Suggestions = ['Groceries', 'Boarding essentials', 'Stationery', 'Party'];

export default function Lists() {
  const c = useColors();
  const { profile: p } = useProfile();
  const { lists, addList } = useLists();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [error, setError] = useState('');

  function create() {
    const b = budget ? Number(budget) : null;
    if (!name.trim()) return setError('Give the list a name.');
    if (b != null && !(b > 0 && b <= MaxAmount)) return setError('The budget needs to be above zero.');
    const id = addList(name.trim(), b);
    setCreating(false);
    if (id) router.push({ pathname: '/list/[id]', params: { id } });
  }

  return (
    <Screen withNav={false}>
      <Enter index={0}>
        <StackHeader
          title="Shopping lists"
          action={
            <NewButton
              label="New list"
              onPress={() => {
                setName('');
                setBudget('');
                setError('');
                setCreating(true);
              }}
            />
          }
        />
      </Enter>

      {lists.length ? (
        <Enter index={1} style={{ gap: 8 }}>
          {lists.map((l) => (
            <Animated.View key={l.id} entering={RowEnter} exiting={RowExit} layout={ListReflow}>
              <ListCard list={l} currency={p.currency} />
            </Animated.View>
          ))}
        </Enter>
      ) : (
        <Enter index={1}>
          <EmptyState
            icon="cart"
            title="No lists yet"
            body="Write down what you need before you go, add prices, and see the total against your budget. When you’re done, log it as one expense."
            action="Start a list"
            onAction={() => setCreating(true)}
          />
        </Enter>
      )}

      <Sheet visible={creating} onClose={() => setCreating(false)} title="New list">
        <FieldLabel>Name</FieldLabel>
        <TextField value={name} onChangeText={(t) => { setName(t); setError(''); }} maxLength={40} placeholder="e.g. Groceries" aria-label="List name" />
        <View style={styles.chips}>
          {Suggestions.map((s) => (
            <PressableScale key={s} role="button" onPress={() => setName(s)} style={[styles.suggest, { backgroundColor: c.accentSoft }]}>
              <Txt variant="smallBold" color="accentInk">
                {s}
              </Txt>
            </PressableScale>
          ))}
        </View>
        <FieldLabel>Budget (optional)</FieldLabel>
        <MoneyField value={budget} onChange={(v) => { setBudget(v); setError(''); }} currency={p.currency} label="Budget" placeholder="No budget" />
        <FormError>{error}</FormError>
        <PrimaryButton label="Create list" onPress={create} />
      </Sheet>
    </Screen>
  );
}

function ListCard({ list, currency }: { list: ShoppingList; currency: string }) {
  const c = useColors();
  const t = listTotals(list);
  const over = t.left != null && t.left < 0;
  return (
    <PressableScale
      role="link"
      aria-label={`${list.name}, ${list.items.length} items, ${formatMoney(t.total, currency)}. Open`}
      onPress={() => router.push({ pathname: '/list/[id]', params: { id: list.id } })}
      scaleTo={0.98}
      style={[styles.card, { backgroundColor: c.surface }]}>
      <View style={styles.cardTop}>
        <View style={[styles.ic, { backgroundColor: c.cat.shopping + '24' }]}>
          <Icon name="cart" size={20} color={c.cat.shopping} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt variant="bodyBold" numberOfLines={1}>
            {list.name}
          </Txt>
          <Txt variant="caption" color="ink3">
            {list.items.length ? `${t.doneCount} of ${list.items.length} in the cart` : 'Empty'}
          </Txt>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Txt variant="bodyBold">{formatMoney(t.total, currency)}</Txt>
          {list.budget != null && (
            <Txt variant="caption" color={over ? c.neg : 'ink3'}>
              {over ? `${formatMoney(-t.left!, currency)} over` : `of ${formatMoney(list.budget, currency)}`}
            </Txt>
          )}
        </View>
      </View>
      {list.budget != null && <ProgressBar value={list.budget ? t.total / list.budget : 0} color={over ? c.neg : c.bar} track={c.track} height={6} />}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 10, borderRadius: Radius.card - 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ic: { width: 42, height: 42, borderRadius: Radius.icon, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggest: { minHeight: 34, paddingHorizontal: 12, borderRadius: 99, justifyContent: 'center' },
});
