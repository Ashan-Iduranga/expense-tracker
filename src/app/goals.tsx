import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Chip, IconButton, PrimaryButton } from '@/components/controls';
import { Icon, type IconName } from '@/components/icon';
import { CountUp, Enter, ProgressBar, ProgressRing } from '@/components/motion';
import { PressableScale } from '@/components/pressable-scale';
import { EmptyState, NewButton, Screen, StackHeader } from '@/components/screen';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/txt';
import { EaseOut } from '@/constants/motion';
import { Fonts, Radius } from '@/constants/theme';
import { digitsOnly, MaxAmount } from '@/data/account';
import { GoalIcons } from '@/data/categories';
import { useGoals, type Goal } from '@/data/goals';
import { useToast } from '@/data/toast';
import { useColors } from '@/hooks/use-colors';
import { useProfile } from '@/hooks/use-profile';
import { formatMoney } from '@/lib/format';
import { hapticSuccess } from '@/lib/haptics';

/** Eight dots flying out of a ring when a goal is reached. */
function Burst() {
  const c = useColors();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 8 }, (_, i) => (
        <BurstDot key={i} angle={(i * Math.PI) / 4} color={i % 2 ? c.pos : c.lime} />
      ))}
    </View>
  );
}

function BurstDot({ angle, color }: { angle: number; color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withTiming(1, { duration: 900, easing: EaseOut }));
  }, [p]);
  const a = useAnimatedStyle(() => ({
    opacity: 1 - p.get(),
    transform: [{ translateX: Math.cos(angle) * 46 * p.get() }, { translateY: Math.sin(angle) * 46 * p.get() }, { scale: 1 - 0.6 * p.get() }],
  }));
  return <Animated.View style={[styles.burstDot, { backgroundColor: color }, a]} />;
}

function GoalCard({ goal, currency, celebrate, onAdd }: { goal: Goal; currency: string; celebrate: boolean; onAdd: () => void }) {
  const c = useColors();
  const reduced = useReducedMotion();
  const p = goal.target ? goal.saved / goal.target : 0;
  const done = p >= 1;
  const s = useSharedValue(1);
  useEffect(() => {
    if (celebrate && !reduced) s.set(withSequence(withTiming(1.04, { duration: 160 }), withSpring(1, { damping: 8, stiffness: 220 })));
  }, [celebrate, reduced, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  return (
    <Animated.View style={[styles.goal, { backgroundColor: c.surface }, a]}>
      <View>
        <ProgressRing value={p} size={58} stroke={5} color={done ? c.pos : c.ink} track={c.track}>
          <Icon name={done ? 'check' : goal.icon} size={22} color={done ? c.posInk : c.ink} />
        </ProgressRing>
        {celebrate && !reduced && <Burst />}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Txt variant="bodyBold" numberOfLines={1}>
          {goal.name}
        </Txt>
        <Txt variant="small" color="ink2">
          <Txt variant="smallBold">{formatMoney(goal.saved, currency)}</Txt> of {formatMoney(goal.target, currency)}
        </Txt>
        <Txt variant="caption" color="ink3">
          {done ? 'Goal reached' : `${formatMoney(goal.target - goal.saved, currency)} to go`} · {Math.round(Math.min(1, p) * 100)}%
        </Txt>
      </View>
      <PressableScale role="button" aria-label={`Add money to ${goal.name}`} onPress={onAdd} style={[styles.addBtn, { backgroundColor: c.accentSoft }]}>
        <Icon name="plus" size={20} color={c.accentInk} />
        <Txt variant="caption" color={c.accentInk} style={{ fontFamily: Fonts.bold }}>
          Add
        </Txt>
      </PressableScale>
    </Animated.View>
  );
}

export default function Goals() {
  const c = useColors();
  const { profile: p } = useProfile();
  const { goals, addGoal, addToGoal, deleteGoal } = useGoals();
  const { showToast } = useToast();
  const [adding, setAdding] = useState<Goal | null>(null);
  const [amount, setAmount] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [icon, setIcon] = useState<IconName>('laptop');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [celebrate, setCelebrate] = useState<string | null>(null);

  const saved = goals.reduce((a, g) => a + g.saved, 0);
  const total = goals.reduce((a, g) => a + g.target, 0);
  const quick = p.status === 'student' ? [500, 1000, 2500, 5000] : [5000, 10000, 25000, 50000];
  const value = Number(amount) || 0;

  function saveAmount() {
    if (!adding || value <= 0) return;
    const reaching = adding.saved < adding.target && adding.saved + value >= adding.target;
    addToGoal(adding.id, value);
    hapticSuccess();
    if (reaching) {
      setCelebrate(adding.id);
      setTimeout(() => setCelebrate(null), 1200);
      showToast(`You reached ${adding.name}. Well done!`);
    } else showToast(`Added ${formatMoney(value, p.currency)} to ${adding.name}`);
    setAdding(null);
  }

  function create() {
    const t = Number(target);
    if (!name.trim()) return setError('Give your goal a name.');
    if (!(t > 0 && t <= MaxAmount)) return setError('Add a target amount above zero.');
    addGoal({ name: name.trim(), icon, target: t });
    hapticSuccess();
    showToast(`Created ${name.trim()}`);
    setCreating(false);
  }

  return (
    <Screen withNav={false}>
      <Enter index={0}>
        <StackHeader
          title="Goals"
          action={
            <NewButton
              label="New goal"
              onPress={() => {
                setName('');
                setTarget('');
                setIcon('laptop');
                setError('');
                setCreating(true);
              }}
            />
          }
        />
      </Enter>

      {goals.length ? (
        <>
          <Enter index={1} style={[styles.sum, { backgroundColor: c.surface }]}>
            <Txt variant="small" color="ink2">
              Saved across {goals.length} goal{goals.length === 1 ? '' : 's'}
            </Txt>
            <CountUp value={saved} currency={p.currency} variant="display" />
            <Txt variant="small" color="ink2">
              of {formatMoney(total, p.currency)}
            </Txt>
            <ProgressBar value={total ? saved / total : 0} color={c.bar} track={c.track} height={12} style={{ marginTop: 6 }} />
          </Enter>
          {goals.map((g, i) => (
            <Enter key={g.id} index={2 + i}>
              <GoalCard
                goal={g}
                currency={p.currency}
                celebrate={celebrate === g.id}
                onAdd={() => {
                  setAmount('');
                  setConfirmDelete(false);
                  setAdding(g);
                }}
              />
            </Enter>
          ))}
        </>
      ) : (
        <Enter index={1}>
          <EmptyState
            icon="target"
            title="No goals yet"
            body="Name something you are saving for, like a laptop or a trip. Every bit you add fills the ring."
            action="Create a goal"
            onAction={() => setCreating(true)}
          />
        </Enter>
      )}

      <Sheet
        visible={!!adding}
        onClose={() => setAdding(null)}
        title={adding ? `Add to ${adding.name}` : ''}
        headerExtra={<IconButton icon="trash" label="Delete this goal" tone="danger" size={40} onPress={() => setConfirmDelete(true)} />}>
        {adding && !confirmDelete && (
          <>
            <Txt variant="small" color="ink2">
              {formatMoney(adding.saved, p.currency)} saved · {formatMoney(Math.max(0, adding.target - adding.saved), p.currency)} to go
            </Txt>
            <View style={styles.quick}>
              {quick.map((q) => (
                <Chip key={q} big label={`+${formatMoney(q, p.currency)}`} selected={value === q} onPress={() => setAmount(String(q))} />
              ))}
            </View>
            <Txt variant="smallSemi" color="ink2">
              Or type an amount
            </Txt>
            <View style={[styles.input, { backgroundColor: c.surface, borderColor: c.line2 }]}>
              <Txt variant="bodySemi" color="ink3">
                {p.currency}
              </Txt>
              <TextInput maxFontSizeMultiplier={1.2}
                value={amount}
                onChangeText={(t) => setAmount(digitsOnly(t))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={c.ink3}
                aria-label="Amount"
                style={[styles.inputText, { color: c.ink }]}
              />
            </View>
            <PrimaryButton label={value > 0 ? `Add ${formatMoney(value, p.currency)}` : 'Choose an amount'} disabled={value <= 0} onPress={saveAmount} />
          </>
        )}
        {adding && confirmDelete && (
          <>
            <Txt variant="body" color="ink2">
              Delete “{adding.name}”? The {formatMoney(adding.saved, p.currency)} you’ve tracked for it is only a record here, so nothing leaves your account.
            </Txt>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <PrimaryButton label="Keep it" tone="soft" onPress={() => setConfirmDelete(false)} style={{ flex: 1 }} />
              <PrimaryButton
                label="Delete"
                tone="danger"
                style={{ flex: 1 }}
                onPress={() => {
                  deleteGoal(adding.id);
                  showToast(`Deleted ${adding.name}`);
                  setAdding(null);
                }}
              />
            </View>
          </>
        )}
      </Sheet>

      <Sheet visible={creating} onClose={() => setCreating(false)} title="New goal">
        <Txt variant="smallSemi" color="ink2">
          What are you saving for?
        </Txt>
        <TextInput maxFontSizeMultiplier={1.2}
          value={name}
          onChangeText={(t) => {
            setName(t);
            setError('');
          }}
          maxLength={28}
          placeholder="e.g. New laptop"
          placeholderTextColor={c.ink3}
          aria-label="Goal name"
          style={[styles.input, styles.inputText, { color: c.ink, backgroundColor: c.surface, borderColor: c.line2 }]}
        />
        <Txt variant="smallSemi" color="ink2">
          Target amount
        </Txt>
        <View style={[styles.input, { backgroundColor: c.surface, borderColor: c.line2 }]}>
          <Txt variant="bodySemi" color="ink3">
            {p.currency}
          </Txt>
          <TextInput maxFontSizeMultiplier={1.2}
            value={target}
            onChangeText={(t) => {
              setTarget(digitsOnly(t));
              setError('');
            }}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={c.ink3}
            aria-label="Target amount"
            style={[styles.inputText, { color: c.ink }]}
          />
        </View>
        <Txt variant="smallSemi" color="ink2">
          Icon
        </Txt>
        <View style={styles.icons} role="radiogroup" aria-label="Goal icon">
          {GoalIcons.map((n) => (
            <IconPick key={n} name={n} selected={icon === n} onPress={() => setIcon(n)} />
          ))}
        </View>
        {!!error && (
          <Txt variant="smallBold" color={c.neg} role="alert">
            {error}
          </Txt>
        )}
        <PrimaryButton label="Create goal" onPress={create} />
      </Sheet>
    </Screen>
  );
}

function IconPick({ name, selected, onPress }: { name: IconName; selected: boolean; onPress: () => void }) {
  const c = useColors();
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (selected && !reduced) s.set(withDelay(0, withSequence(withTiming(1.14, { duration: 110 }), withSpring(1.06, { damping: 9 }))));
    else s.set(withSpring(1));
  }, [selected, reduced, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  return (
    <Pressable role="radio" aria-checked={selected} aria-label={name} onPress={onPress} style={{ flex: 1 }}>
      <Animated.View style={[styles.iconPick, { backgroundColor: selected ? c.lime : c.surface2 }, a]}>
        <Icon name={name} size={20} color={selected ? c.inkFixed : c.ink2} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sum: { borderRadius: Radius.card, padding: 18, gap: 4 },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: Radius.card },
  addBtn: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 1 },
  burstDot: { position: 'absolute', left: 26, top: 26, width: 6, height: 6, borderRadius: 2 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 54, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1.5 },
  inputText: { flex: 1, minWidth: 0, fontFamily: Fonts.semiBold, fontSize: 17 },
  icons: { flexDirection: 'row', gap: 6 },
  iconPick: { aspectRatio: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
