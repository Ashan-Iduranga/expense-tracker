import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { KeyboardAwareScrollView, useKeyboardState } from 'react-native-keyboard-controller';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip, IconButton, PrimaryButton, Segmented } from '@/components/controls';
import { DateSheet } from '@/components/date-sheet';
import { Icon } from '@/components/icon';
import { KeyboardBar } from '@/components/keyboard-bar';
import { useBoing } from '@/components/motion';
import { PressableScale } from '@/components/pressable-scale';
import { Txt } from '@/components/txt';
import { SpringBouncy } from '@/constants/motion';
import { displayType, Fonts, Gutter, MaxContentWidth, Radius } from '@/constants/theme';
import { useAccount } from '@/data/account';
import { categoryInfo, ExpenseIds, type CategoryId, type TxType } from '@/data/categories';
import { useMonth } from '@/data/month';
import { isActive, usePlans } from '@/data/plans';
import { useToast } from '@/data/toast';
import { useTransactions } from '@/data/transactions';
import { useColors } from '@/hooks/use-colors';
import { useProfile } from '@/hooks/use-profile';
import { addDays, dayLabel, formatMoney, sameDay, startOfDay } from '@/lib/format';
import { hapticSelection, hapticSuccess } from '@/lib/haptics';
import { monthRange, sums } from '@/lib/stats';

const Keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const;
const KeyRows = [Keys.slice(0, 3), Keys.slice(3, 6), Keys.slice(6, 9), Keys.slice(9, 12)];

/** "12,480.5" while typing: grouped whole part, decimals as typed. */
function amountText(a: string) {
  if (!a) return '0';
  const [whole, frac] = a.split('.');
  return Number(whole || 0).toLocaleString('en-US') + (frac !== undefined ? `.${frac}` : '');
}

function CatChip({ id, type, selected, size, onPress }: { id: CategoryId; type: TxType; selected: boolean; size: number; onPress: () => void }) {
  const c = useColors();
  const reduced = useReducedMotion();
  const info = categoryInfo(id);
  const color = type === 'income' ? c.cat.income : c.cat[id as keyof typeof c.cat] ?? c.cat.other;
  const boing = useBoing(selected);
  const tilt = useSharedValue(0);
  useEffect(() => {
    tilt.set(reduced ? 0 : withSpring(selected ? 1 : 0, SpringBouncy));
  }, [selected, reduced, tilt]);
  const icon = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.12 * tilt.get() }, { rotate: `${-6 * tilt.get()}deg` }] }));
  return (
    <Pressable role="radio" aria-checked={selected} aria-label={info.name} onPress={onPress} style={[styles.cat, { paddingVertical: size > 46 ? 6 : 2 }]}>
      <Animated.View style={boing}>
        <Animated.View style={[styles.catIc, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: selected ? color : color + '24' }, icon]}>
          <Icon name={info.icon} size={22} color={selected ? c.onCat : color} />
        </Animated.View>
      </Animated.View>
      <Txt variant="caption" color={selected ? c.ink : c.ink2} style={{ fontFamily: selected ? Fonts.bold : Fonts.medium }} numberOfLines={1}>
        {info.short}
      </Txt>
    </Pressable>
  );
}

function Key({ k, height, onPress }: { k: (typeof Keys)[number]; height: number; onPress: () => void }) {
  const c = useColors();
  const [down, setDown] = useState(false);
  return (
    <PressableScale
      role="button"
      aria-label={k === 'del' ? 'Delete digit' : k === '.' ? 'Decimal point' : k}
      onPress={onPress}
      onPressIn={() => setDown(true)}
      onPressOut={() => setDown(false)}
      scaleTo={0.93}
      containerStyle={styles.keyWrap}
      style={[styles.key, { minHeight: height, backgroundColor: down ? c.keyPress : c.key }]}>
      {k === 'del' ? (
        <Icon name="backspace" size={24} color={down ? c.inkFixed : c.ink} />
      ) : (
        <Txt style={styles.keyText} color={down ? c.inkFixed : c.ink}>
          {k}
        </Txt>
      )}
    </PressableScale>
  );
}

export default function Add() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  // Sized from the screen height so the whole page fits without scrolling, on short
  // phones and with large display/font settings. The keypad takes whatever is left.
  const { height } = useWindowDimensions();
  const k = Math.min(1, Math.max(0.68, height / 820));
  const keyboardOpen = useKeyboardState((s) => s.isVisible);
  const params = useLocalSearchParams<{ id?: string; type?: string; amount?: string; cat?: string; note?: string; planId?: string }>();
  const { plans } = usePlans();
  const { profile: p, status: st } = useProfile();
  const { updateProfile } = useAccount();
  const { transactions, addTransaction, updateTransaction, deleteTransaction } = useTransactions();
  const { showToast } = useToast();
  const { alloc, setAskSurplus } = useMonth();
  const editing = params.id ? transactions.find((t) => t.id === params.id) : undefined;

  const [type, setType] = useState<TxType>(editing?.type ?? (params.type === 'income' ? 'income' : 'expense'));
  const [amount, setAmount] = useState(editing ? String(editing.amount) : params.amount ?? '');
  const [cat, setCat] = useState<CategoryId>(editing?.category ?? (params.cat as CategoryId) ?? (type === 'income' ? st.incomeCats[0] : 'food'));
  const [note, setNote] = useState(editing?.note ?? params.note ?? '');
  const [planId, setPlanId] = useState<string | undefined>(editing?.planId ?? params.planId);
  const [date, setDate] = useState(editing?.date ?? new Date());
  const [picking, setPicking] = useState(false);
  const [saved, setSaved] = useState(false);
  const [incomeOn, setIncomeOn] = useState(p.incomeEnabled || type === 'income');

  // Amount feedback: a bump per digit, a shake when a key can't be used.
  const bump = useSharedValue(1);
  const shake = useSharedValue(0);
  const caret = useSharedValue(1);
  useEffect(() => {
    if (!reduced) caret.set(withRepeat(withSequence(withTiming(0, { duration: 1 }), withTiming(0, { duration: 499 }), withTiming(1, { duration: 1 }), withTiming(1, { duration: 499 })), -1));
  }, [reduced, caret]);
  const amountStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.get() }, { translateX: shake.get() }] }));
  const caretStyle = useAnimatedStyle(() => ({ opacity: caret.get() }));

  const kick = (bad: boolean) => {
    if (reduced) return;
    if (bad) shake.set(withSequence(withTiming(-6, { duration: 50 }), withTiming(6, { duration: 50 }), withTiming(-6, { duration: 50 }), withTiming(0, { duration: 50 })));
    else bump.set(withSequence(withTiming(1.05, { duration: 70 }), withSpring(1, { damping: 10, stiffness: 300 })));
  };

  function press(k: (typeof Keys)[number]) {
    let a = amount;
    if (k === 'del') a = a.slice(0, -1);
    else if (k === '.') {
      if (a.includes('.')) return kick(true);
      a = (a || '0') + '.';
    } else {
      if (a === '0') a = '';
      const [whole, frac] = a.split('.');
      if (frac !== undefined ? frac.length >= 2 : whole.length >= 8) return kick(true);
      a += k;
    }
    setAmount(a);
    kick(false);
  }

  const value = Math.round(parseFloat(amount || '0') * 100) / 100;
  // Active plans, plus the one this expense already belongs to even if it has ended.
  const planChoices = plans.filter((pl) => isActive(pl, date) || pl.id === planId);
  const cats: CategoryId[] = type === 'income' ? st.incomeCats : ExpenseIds;
  const placeholder = categoryInfo(cat).name;
  const isToday = sameDay(date, new Date());
  const isYesterday = sameDay(date, addDays(new Date(), -1));
  const title = editing ? (type === 'income' ? `Edit ${st.word.toLowerCase()}` : 'Edit expense') : type === 'income' ? `Add ${st.word.toLowerCase()}` : 'Add expense';

  function changeType(t: TxType) {
    setType(t);
    setCat(t === 'income' ? st.incomeCats[0] : 'food');
  }

  function pickDay(d: Date) {
    const keep = editing?.date ?? new Date();
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), keep.getHours(), keep.getMinutes());
    setDate(next);
  }

  function save() {
    if (!(value > 0)) return kick(true);
    const tx = { type, amount: value, category: cat, note: note.trim() || placeholder, date, planId: type === 'expense' ? planId : undefined };
    if (editing) updateTransaction(editing.id, tx);
    else addTransaction(tx);
    // New income this month that takes it above the budget: Home asks what to do with the extra.
    const thisMonth = date.getFullYear() === new Date().getFullYear() && date.getMonth() === new Date().getMonth();
    if (!editing && type === 'income' && thisMonth && p.monthlyBudget) {
      const income = sums(transactions, monthRange(0)).income + value;
      if (income > p.monthlyBudget + alloc.spend + alloc.saved) setAskSurplus(true);
    }
    hapticSuccess();
    setSaved(true);
    setTimeout(
      () => {
        router.back();
        showToast(`${editing ? 'Updated' : 'Added'} ${tx.note} · ${formatMoney(value, p.currency)}`);
      },
      reduced ? 0 : 480
    );
  }

  const closing = useRef(false);
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    router.back();
  };

  return (
    <View style={[styles.fill, { backgroundColor: c.sheet, paddingTop: insets.top + 8 }]}>
      <KeyboardAwareScrollView
        bottomOffset={62}
        scrollEnabled={keyboardOpen}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { gap: Math.max(8, Math.round(14 * k)), paddingBottom: Math.max(16, insets.bottom + 10) }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Txt variant="name" style={[{ flex: 1 }, displayType(Math.max(26, Math.round(32 * k)))]} role="heading">
            {title}
          </Txt>
          {editing && (
            <IconButton
              icon="trash"
              tone="danger"
              label="Delete this transaction"
              onPress={() => {
                deleteTransaction(editing.id);
                close();
              }}
            />
          )}
          <IconButton icon="close" label="Close" onPress={close} />
        </View>

        {incomeOn ? (
          <Segmented<TxType>
            label="Type"
            value={type}
            onChange={changeType}
            options={[
              { value: 'expense', label: 'Expense' },
              { value: 'income', label: st.word },
            ]}
          />
        ) : (
          <Pressable
            role="button"
            onPress={() => {
              setIncomeOn(true);
              updateProfile({ incomeEnabled: true });
              changeType('income');
            }}
            style={[styles.miniLink, { backgroundColor: c.accentSoft }]}>
            <Icon name="plus" size={16} color={c.accentInk} />
            <Txt variant="smallBold" color={c.accentInk}>
              {p.status === 'student' ? 'Got pocket money? Log allowance' : 'Log income instead'}
            </Txt>
          </Pressable>
        )}

        <Animated.View style={[styles.amountRow, amountStyle]} aria-live="polite" aria-label={`Amount ${formatMoney(value, p.currency)}`}>
          <Txt style={displayType(Math.round(34 * k))} color="ink3">
            {p.currency}
          </Txt>
          <Txt style={[styles.amount, displayType(Math.round(82 * k))]} color={type === 'income' ? c.posInk : c.ink} numberOfLines={1} adjustsFontSizeToFit>
            {amountText(amount)}
          </Txt>
          <Animated.View style={[styles.caret, { height: Math.round(56 * k), backgroundColor: c.lime }, caretStyle]} />
        </Animated.View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catsOuter} contentContainerStyle={styles.cats} role="radiogroup" aria-label="Category">
          {cats.map((id) => (
            <CatChip
              key={id}
              id={id}
              type={type}
              selected={id === cat}
              size={Math.max(40, Math.round(50 * k))}
              onPress={() => {
                hapticSelection();
                setCat(id);
              }}
            />
          ))}
        </ScrollView>

        <View style={[styles.note, { backgroundColor: c.surface2 }]}>
          <Icon name="edit" size={18} color={c.ink3} />
          <TextInput maxFontSizeMultiplier={1.2} value={note} onChangeText={setNote} maxLength={60} placeholder={placeholder} placeholderTextColor={c.ink3} aria-label="Note" style={[styles.noteInput, { color: c.ink }]} />
        </View>

        {type === 'expense' && planChoices.length > 0 && (
          <View style={{ gap: 6 }}>
            <Txt variant="smallSemi" color="ink2">
              Part of a plan?
            </Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.noGrow} contentContainerStyle={{ gap: 8 }} role="radiogroup" aria-label="Spending plan">
              <Chip role="radio" label="No plan" selected={!planId} onPress={() => setPlanId(undefined)} />
              {planChoices.map((pl) => (
                <Chip key={pl.id} role="radio" icon={pl.icon} label={pl.name} selected={planId === pl.id} onPress={() => setPlanId(pl.id)} />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.dates}>
          <Chip label="Today" selected={isToday} onPress={() => pickDay(new Date())} />
          <Chip label="Yesterday" selected={isYesterday} onPress={() => pickDay(addDays(new Date(), -1))} />
          <View style={{ flex: 1 }}>
            <Chip icon="calendar" label={!isToday && !isYesterday ? dayLabel(date) : 'Pick a date'} selected={!isToday && !isYesterday} onPress={() => setPicking(true)} />
          </View>
        </View>

        <View style={styles.keypad}>
          {KeyRows.map((row) => (
            <View key={row.join('')} style={styles.keyRow}>
              {row.map((key) => (
                <Key key={key} k={key} height={Math.max(44, Math.round(54 * k))} onPress={() => press(key)} />
              ))}
            </View>
          ))}
        </View>

        {saved ? (
          <Animated.View entering={reduced ? undefined : ZoomIn.springify().damping(12)} style={[styles.done, { backgroundColor: c.pos }]}>
            <Icon name="check" size={22} color={c.white} strokeWidth={2.6} />
            <Txt variant="button" color={c.white}>
              {editing ? 'Saved' : 'Added'}
            </Txt>
          </Animated.View>
        ) : (
          <PrimaryButton label={editing ? 'Save changes' : type === 'income' ? `Add ${st.word.toLowerCase()}` : 'Add expense'} disabled={!(value > 0)} onPress={save} />
        )}
      </KeyboardAwareScrollView>
      <KeyboardBar />
      <DateSheet visible={picking} value={startOfDay(date)} onClose={() => setPicking(false)} onPick={pickDay} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: Gutter, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52 },
  miniLink: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, paddingHorizontal: 14, borderRadius: 99 },
  amountRow: { flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 4 },
  amount: { maxWidth: '78%' },
  caret: { width: 4, borderRadius: 2 },
  // ScrollView defaults to flexGrow/flexShrink 1; horizontal rows must keep their own height.
  noGrow: { flexGrow: 0, flexShrink: 0 },
  catsOuter: { flexGrow: 0, flexShrink: 0, marginHorizontal: -Gutter },
  cats: { paddingHorizontal: Gutter, gap: 6 },
  cat: { width: 70, alignItems: 'center', gap: 6 },
  catIc: { alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 16, borderRadius: Radius.pill },
  noteInput: { flex: 1, minWidth: 0, fontFamily: Fonts.medium, fontSize: 16, paddingVertical: 10 },
  dates: { flexDirection: 'row', gap: 8 },
  // Rows start at the key's min height and grow into spare space, up to 76pt each.
  keypad: { flexGrow: 1, gap: 8, justifyContent: 'flex-end' },
  keyRow: { flexGrow: 1, maxHeight: 76, flexDirection: 'row', gap: 8 },
  keyWrap: { flex: 1 },
  key: { flexGrow: 1, borderRadius: Radius.key, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontFamily: Fonts.semiBold, fontSize: 24, lineHeight: 28 },
  done: { minHeight: 56, borderRadius: Radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
