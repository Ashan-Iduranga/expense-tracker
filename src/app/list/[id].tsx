import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, PrimaryButton } from '@/components/controls';
import { FieldLabel, FormError, formStyles, MoneyField, TextField } from '@/components/form';
import { Icon } from '@/components/icon';
import { KeyboardBar } from '@/components/keyboard-bar';
import { EmptyState, StackHeader } from '@/components/screen';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/txt';
import { ListReflow, RowEnter, RowExit } from '@/constants/motion';
import { Fonts, Gutter, MaxContentWidth, Radius } from '@/constants/theme';
import { digitsOnly, MaxAmount } from '@/data/account';
import { listTotals, MaxItems, useLists, type ListItem } from '@/data/lists';
import { useToast } from '@/data/toast';
import { useTransactions } from '@/data/transactions';
import { useColors } from '@/hooks/use-colors';
import { useProfile } from '@/hooks/use-profile';
import { formatMoney } from '@/lib/format';
import { hapticSelection, hapticSuccess } from '@/lib/haptics';

const newId = () => Math.random().toString(36).slice(2, 10);

export default function ListScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile: p } = useProfile();
  const { lists, updateList, deleteList } = useLists();
  const { transactions } = useTransactions();
  const { showToast } = useToast();
  const navigation = useNavigation();
  const list = lists.find((l) => l.id === id);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [editing, setEditing] = useState<ListItem | null>(null);
  const [menu, setMenu] = useState<'none' | 'delete' | 'after'>('none');
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  // Set when "Done shopping" opens the Add screen; checked when we come back.
  const pending = useRef<number | null>(null);

  const txCount = useRef(transactions.length);
  useEffect(() => {
    txCount.current = transactions.length;
  }, [transactions.length]);
  useEffect(
    () =>
      navigation.addListener('focus', () => {
        if (pending.current != null && txCount.current > pending.current) setMenu('after');
        pending.current = null;
      }),
    [navigation]
  );

  // Still loading, or deleted on another phone.
  if (!list) {
    return (
      <View style={[styles.fill, { backgroundColor: c.bg, paddingTop: insets.top + 12, paddingHorizontal: Gutter, gap: 16 }]}>
        <StackHeader title="List" />
        <EmptyState icon="cart" title="This list isn’t here" body="It may have been deleted. Go back to see your other lists." />
      </View>
    );
  }

  const t = listTotals(list);
  const cur = p.currency;
  const items = list.items;
  const setItems = (next: ListItem[]) => updateList(list.id, { items: next });

  function add() {
    const n = name.trim();
    if (!n) return;
    if (items.length >= MaxItems) return showToast(`A list can hold ${MaxItems} items`);
    const pr = price ? Number(price) : null;
    setItems([...items, { id: newId(), name: n, qty: 1, price: pr && pr <= MaxAmount ? pr : null, done: false }]);
    setName('');
    setPrice('');
    nameRef.current?.focus();
  }

  const toggle = (it: ListItem) => setItems(items.map((i) => (i.id === it.id ? { ...i, done: !i.done } : i)));
  const changeQty = (it: ListItem, d: number) => setItems(items.map((i) => (i.id === it.id ? { ...i, qty: Math.max(1, Math.min(99, i.qty + d)) } : i)));

  function doneShopping() {
    pending.current = transactions.length;
    router.push({ pathname: '/add', params: { amount: String(t.inCart), cat: 'shopping', note: list!.name.slice(0, 60) } });
  }

  const ordered = [...items.filter((i) => !i.done), ...items.filter((i) => i.done)];

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <KeyboardAwareScrollView bottomOffset={62} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
        <StackHeader title={list.name} action={<IconButton icon="trash" label="Delete list" tone="danger" onPress={() => setMenu('delete')} />} />

        <View style={[styles.addRow, { backgroundColor: c.surface, borderColor: c.line2 }]}>
          <TextInput
            ref={nameRef}
            value={name}
            onChangeText={setName}
            placeholder="Add an item"
            placeholderTextColor={c.ink3}
            maxLength={40}
            returnKeyType="done"
            submitBehavior="submit"
            onSubmitEditing={add}
            aria-label="Item name"
            style={[styles.addName, { color: c.ink }]}
          />
          <View style={[styles.addPrice, { borderLeftColor: c.line2 }]}>
            <Txt variant="smallSemi" color="ink3">
              {cur}
            </Txt>
            <TextInput value={price} onChangeText={(v) => setPrice(digitsOnly(v))} keyboardType="number-pad" placeholder="Price" placeholderTextColor={c.ink3} aria-label="Item price" style={[styles.addPriceInput, { color: c.ink }]} />
          </View>
          <Pressable role="button" aria-label="Add item" disabled={!name.trim()} onPress={add} style={[styles.addBtn, { backgroundColor: name.trim() ? c.accent : c.surface2 }]}>
            <Icon name="plus" size={20} color={name.trim() ? c.onAccent : c.ink3} strokeWidth={2.4} />
          </Pressable>
        </View>

        {items.length ? (
          <View style={{ gap: 6 }}>
            {ordered.map((it) => (
              <Animated.View key={it.id} entering={RowEnter} exiting={RowExit} layout={ListReflow}>
                <ItemRow item={it} currency={cur} onToggle={() => toggle(it)} onQty={(d) => changeQty(it, d)} onEdit={() => setEditing(it)} />
              </Animated.View>
            ))}
            {t.unpriced > 0 && (
              <Txt variant="caption" color="ink3" style={{ textAlign: 'center', marginTop: 4 }}>
                {t.unpriced} item{t.unpriced === 1 ? ' has' : 's have'} no price yet. Tap one to add it.
              </Txt>
            )}
          </View>
        ) : (
          <EmptyState icon="cart" title="Nothing on the list" body="Type an item above and hit add. A price is optional, but it lets you see the total before you get to the shop." />
        )}
      </KeyboardAwareScrollView>

      <View style={[styles.foot, { backgroundColor: c.bg, borderTopColor: c.line, paddingBottom: Math.max(16, insets.bottom + 8) }]}>
        <View style={styles.sums}>
          <Sum label="Total" value={formatMoney(t.total, cur)} />
          <Sum label="In cart" value={formatMoney(t.inCart, cur)} />
          <Sum
            label={t.left == null ? 'To buy' : t.left < 0 ? 'Over budget' : 'Budget left'}
            value={formatMoney(t.left == null ? t.toBuy : Math.abs(t.left), cur)}
            tone={t.left != null && t.left < 0 ? 'neg' : undefined}
          />
        </View>
        <PrimaryButton label={t.inCart > 0 ? `Done shopping · log ${formatMoney(t.inCart, cur)}` : 'Tick items as you shop'} disabled={t.inCart <= 0} onPress={doneShopping} />
      </View>
      <KeyboardBar />

      <ItemSheet
        item={editing}
        currency={cur}
        onClose={() => setEditing(null)}
        onSave={(next) => {
          setItems(items.map((i) => (i.id === next.id ? next : i)));
          setEditing(null);
        }}
        onDelete={(it) => {
          setItems(items.filter((i) => i.id !== it.id));
          setEditing(null);
        }}
      />

      <Sheet visible={menu !== 'none'} onClose={() => setMenu('none')} title={menu === 'after' ? 'Logged. What now?' : 'Delete list?'}>
        {menu === 'after' ? (
          <>
            <Txt variant="body" color="ink2">
              The shopping is in your spending. Keep this list for next time without the ticked items, or delete it.
            </Txt>
            <PrimaryButton
              label={`Clear ${t.doneCount} ticked item${t.doneCount === 1 ? '' : 's'}`}
              onPress={() => {
                setItems(items.filter((i) => !i.done));
                setMenu('none');
                hapticSuccess();
              }}
            />
            <PrimaryButton label="Untick all and keep" tone="soft" onPress={() => { setItems(items.map((i) => ({ ...i, done: false }))); setMenu('none'); }} />
            <PrimaryButton label="Delete the list" tone="danger" onPress={() => setMenu('delete')} />
          </>
        ) : (
          <>
            <Txt variant="body" color="ink2">
              Delete “{list.name}” and its {items.length} item{items.length === 1 ? '' : 's'}? Anything you already logged stays in History.
            </Txt>
            <View style={formStyles.row}>
              <PrimaryButton label="Keep it" tone="soft" onPress={() => setMenu('none')} style={{ flex: 1 }} />
              <PrimaryButton
                label="Delete"
                tone="danger"
                style={{ flex: 1 }}
                onPress={() => {
                  setMenu('none');
                  deleteList(list.id);
                  showToast(`Deleted ${list.name}`);
                  router.back();
                }}
              />
            </View>
          </>
        )}
      </Sheet>
    </View>
  );
}

function Sum({ label, value, tone }: { label: string; value: string; tone?: 'neg' }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Txt variant="caption" color="ink3">
        {label}
      </Txt>
      <Txt variant="bodyBold" color={tone === 'neg' ? c.neg : c.ink} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Txt>
    </View>
  );
}

function ItemRow({ item, currency, onToggle, onQty, onEdit }: { item: ListItem; currency: string; onToggle: () => void; onQty: (d: number) => void; onEdit: () => void }) {
  const c = useColors();
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  const box = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  return (
    <View style={[styles.item, { backgroundColor: c.surface, opacity: item.done ? 0.6 : 1 }]}>
      <Pressable
        role="checkbox"
        aria-checked={item.done}
        aria-label={`${item.name}${item.done ? ', in cart' : ''}`}
        hitSlop={8}
        onPress={() => {
          hapticSelection();
          if (!reduced) s.set(withSequence(withTiming(0.8, { duration: 80 }), withSpring(1, { damping: 8, stiffness: 300 })));
          onToggle();
        }}>
        <Animated.View style={[styles.check, { borderColor: item.done ? c.accent : c.line2, backgroundColor: item.done ? c.accent : 'transparent' }, box]}>
          {item.done && <Icon name="check" size={16} color={c.onAccent} strokeWidth={2.8} />}
        </Animated.View>
      </Pressable>
      <Pressable role="button" aria-label={`Edit ${item.name}`} onPress={onEdit} style={{ flex: 1, minWidth: 0 }}>
        <Txt variant="bodySemi" numberOfLines={1} style={item.done ? { textDecorationLine: 'line-through' } : undefined}>
          {item.name}
        </Txt>
        <Txt variant="caption" color={item.price == null ? c.accentInk : 'ink3'}>
          {item.price == null ? 'Add price' : item.qty > 1 ? `${item.qty} × ${formatMoney(item.price, currency)} = ${formatMoney(item.price * item.qty, currency)}` : formatMoney(item.price, currency)}
        </Txt>
      </Pressable>
      <View style={[styles.stepper, { backgroundColor: c.surface2 }]}>
        <Pressable role="button" aria-label={`One less ${item.name}`} disabled={item.qty <= 1} onPress={() => onQty(-1)} hitSlop={6} style={styles.step}>
          <Icon name="minus" size={16} color={item.qty <= 1 ? c.ink3 : c.ink} />
        </Pressable>
        <Txt variant="smallBold" style={{ minWidth: 18, textAlign: 'center' }} aria-label={`Quantity ${item.qty}`}>
          {item.qty}
        </Txt>
        <Pressable role="button" aria-label={`One more ${item.name}`} onPress={() => onQty(1)} hitSlop={6} style={styles.step}>
          <Icon name="plus" size={16} color={c.ink} />
        </Pressable>
      </View>
    </View>
  );
}

function ItemSheet({ item, currency, onClose, onSave, onDelete }: { item: ListItem | null; currency: string; onClose: () => void; onSave: (i: ListItem) => void; onDelete: (i: ListItem) => void }) {
  const [kept, setKept] = useState<ListItem | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  if (item && item !== kept) {
    setKept(item);
    setName(item.name);
    setPrice(item.price != null ? String(item.price) : '');
    setError('');
  }
  const it = item ?? kept;
  if (!it) return null;
  return (
    <Sheet visible={!!item} onClose={onClose} title="Edit item" headerExtra={<IconButton icon="trash" label="Remove item" tone="danger" size={40} onPress={() => onDelete(it)} />}>
      <FieldLabel>Item</FieldLabel>
      <TextField value={name} onChangeText={(v) => { setName(v); setError(''); }} maxLength={40} aria-label="Item name" />
      <FieldLabel>Price for one (optional)</FieldLabel>
      <MoneyField value={price} onChange={setPrice} currency={currency} label="Price" placeholder="No price" />
      <FormError>{error}</FormError>
      <PrimaryButton
        label="Save"
        onPress={() => {
          if (!name.trim()) return setError('The item needs a name.');
          const pr = price ? Number(price) : null;
          onSave({ ...it, name: name.trim(), price: pr && pr <= MaxAmount ? pr : null });
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: Gutter, paddingBottom: 24, gap: 16, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderRadius: 18, borderWidth: 1.5, paddingLeft: 16, paddingRight: 6, gap: 6 },
  addName: { flex: 1, minWidth: 0, fontFamily: Fonts.semiBold, fontSize: 16 },
  addPrice: { flexDirection: 'row', alignItems: 'center', gap: 4, borderLeftWidth: 1, paddingLeft: 10, width: 100 },
  addPriceInput: { flex: 1, minWidth: 0, fontFamily: Fonts.semiBold, fontSize: 16 },
  addBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: Radius.row },
  check: { width: 28, height: 28, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: 99, paddingHorizontal: 2 },
  step: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  foot: { paddingHorizontal: Gutter, paddingTop: 12, gap: 10, borderTopWidth: 1, width: '100%', maxWidth: MaxContentWidth + Gutter * 2, alignSelf: 'center' },
  sums: { flexDirection: 'row', gap: 12 },
});
