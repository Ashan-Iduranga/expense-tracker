import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, {
  FadeInRight,
  FadeInDown,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { BrandMark } from '@/components/brand-mark';
import { Chip, IconButton, PrimaryButton, Switch } from '@/components/controls';
import { Icon } from '@/components/icon';
import { KeyboardBar } from '@/components/keyboard-bar';
import { Txt } from '@/components/txt';
import { EaseOut } from '@/constants/motion';
import { displayType, Fonts, Gutter, MaxContentWidth, Radius } from '@/constants/theme';
import { digitsOnly, NameMaxLength, useAccount } from '@/data/account';
import { ExpenseIds, FrequencyIds, IncomeFrequencies, Statuses, StatusIds, usualAmountLabel, type IncomeFrequency, type Status } from '@/data/categories';
import { useToast } from '@/data/toast';
import { useColors } from '@/hooks/use-colors';
import { formatMoney } from '@/lib/format';
import { hapticSuccess } from '@/lib/haptics';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** One checklist line: a dashed box that fills and draws its tick, then the text firms up. */
function CheckItem({ text, index, onDone }: { text: string; index: number; onDone?: () => void }) {
  const c = useColors();
  const reduced = useReducedMotion();
  const fill = useSharedValue(reduced ? 1 : 0);
  const draw = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      onDone?.();
      return;
    }
    const delay = 500 + index * 420;
    fill.set(withDelay(delay, withSequence(withTiming(1.15, { duration: 200 }), withSpring(1, { damping: 10 }))));
    draw.set(withDelay(delay + 140, withTiming(1, { duration: 300, easing: EaseOut })));
    const t = setTimeout(() => onDone?.(), delay + 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const box = useAnimatedStyle(() => ({ opacity: Math.min(1, fill.get() * 2), transform: [{ scale: fill.get() }] }));
  const textStyle = useAnimatedStyle(() => ({ opacity: 0.45 + 0.55 * Math.min(1, fill.get()), transform: [{ translateX: -4 * (1 - Math.min(1, fill.get())) }] }));
  const tick = useAnimatedProps(() => ({ strokeDashoffset: 24 * (1 - draw.get()) }));
  return (
    <View style={[styles.checkRow, { borderBottomColor: c.line2 }]}>
      <View style={[styles.checkBox, { borderColor: c.line2 }]}>
        <Animated.View style={[styles.checkFill, { backgroundColor: c.accent }, box]} />
        <Svg width={16} height={16} viewBox="0 0 24 24" style={{ zIndex: 1 }}>
          <AnimatedPath d="m5 12.5 4.5 4.5L19 7.5" stroke={c.onAccent} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="24" animatedProps={tick} />
        </Svg>
      </View>
      <Animated.View style={[{ flex: 1 }, textStyle]}>
        <Txt variant="bodySemi">{text}</Txt>
      </Animated.View>
    </View>
  );
}

/** Name → status → money, then a checklist that ticks itself off before Home opens. */
export default function Setup() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { saveProfile, finishSetup } = useAccount();
  const { showToast } = useToast();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [incomeOn, setIncomeOn] = useState(false);
  const [income, setIncome] = useState('');
  const [freq, setFreq] = useState<IncomeFrequency>('irregular');
  const [budget, setBudget] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [ticked, setTicked] = useState(0);
  const s = status ? Statuses[status] : null;

  function next() {
    if (step === 0) {
      if (!name.trim()) return setError('Add a name so we know what to call you.');
    } else if (step === 1) {
      if (!status) return setError('Pick the option closest to you. You can change it later.');
      setIncomeOn(Statuses[status].incomeDefault);
      setFreq(Statuses[status].frequencyDefault);
    } else if (step === 2) {
      return finish();
    }
    setError('');
    setStep(step + 1);
  }

  async function finish() {
    if (!status || !s) return;
    setSaving(true);
    const b = Number(budget) || null;
    const inc = Number(income) || null;
    try {
      await saveProfile({
        name: name.trim(),
        status,
        incomeEnabled: incomeOn,
        income: incomeOn ? inc : null,
        incomeFrequency: freq,
        payday: incomeOn && freq === 'monthly' ? 25 : null,
        monthlyBudget: b,
        currency: 'Rs',
        theme: 'system',
        catBudgets: {},
      });
      setChecklist([
        `${s.label} profile saved`,
        b ? `Monthly budget set to ${formatMoney(b)}` : 'No budget yet. Add one any time',
        incomeOn ? `${s.word} tracking on · ${IncomeFrequencies[freq].label.toLowerCase()}` : 'Income tracking off. Switch it on later if you need it',
        `${ExpenseIds.length} spending categories ready`,
        'Goals and charts waiting for your first spend',
      ]);
      setStep(3);
    } catch {
      setError('Couldn’t save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  const progress = (
    <View style={styles.progressRow}>
      {step > 0 && step < 3 ? <IconButton icon="back" label="Back" onPress={() => setStep(step - 1)} /> : <View style={{ width: 44 }} />}
      <View style={styles.steps} role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={Math.min(step + 1, 3)} aria-label="Setup progress">
        {[0, 1, 2].map((k) => (
          <StepBar key={k} on={k <= step} />
        ))}
      </View>
      <Txt variant="smallBold" color="ink3" style={{ minWidth: 44, textAlign: 'right' }}>
        {Math.min(step + 1, 3)} of 3
      </Txt>
    </View>
  );

  const enter = reduced ? undefined : FadeInRight.springify().damping(16);

  return (
    <View style={[styles.fill, { backgroundColor: c.bg, paddingTop: insets.top + 12, paddingBottom: Math.max(20, insets.bottom + 10) }]}>
      <KeyboardAwareScrollView bottomOffset={62} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step < 3 && progress}

        {step === 0 && (
          <Animated.View key="s0" entering={enter} style={styles.body}>
            <Txt variant="name" style={styles.h}>
              What should we call you?
            </Txt>
            <Txt variant="body" color="ink2">
              A first name is enough. It stays in your account.
            </Txt>
            <TextInput
              value={name}
              onChangeText={(t) => {
                setName(t);
                setError('');
              }}
              autoFocus
              autoComplete="given-name"
              maxLength={NameMaxLength}
              placeholder="e.g. Nethmi"
              placeholderTextColor={c.ink3}
              aria-label="First name"
              returnKeyType="next"
              onSubmitEditing={next}
              style={[styles.input, { color: c.ink, backgroundColor: c.surface, borderColor: c.line2 }]}
            />
          </Animated.View>
        )}

        {step === 1 && (
          <Animated.View key="s1" entering={enter} style={styles.body}>
            <Txt variant="name" style={styles.h}>
              Which fits you best, {name.trim()}?
            </Txt>
            <Txt variant="body" color="ink2">
              This sets how income works. Students never have to add income.
            </Txt>
            <View style={styles.grid} role="radiogroup" aria-label="Your status">
              {StatusIds.map((id) => (
                <StatusCard key={id} id={id} selected={status === id} onPress={() => { setStatus(id); setError(''); }} />
              ))}
            </View>
          </Animated.View>
        )}

        {step === 2 && s && (
          <Animated.View key="s2" entering={enter} style={styles.body}>
            <Txt variant="name" style={styles.h}>
              Money in and out
            </Txt>
            <Txt variant="body" color="ink2">
              Both are optional. You can change them later in Settings.
            </Txt>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <View style={styles.cardRow}>
                <Txt variant="bodySemi" style={{ flex: 1 }}>
                  {s.question}
                </Txt>
                <Switch value={incomeOn} onChange={setIncomeOn} label={s.question} />
              </View>
              {incomeOn ? (
                <Animated.View entering={reduced ? undefined : FadeInDown} style={{ gap: 8 }}>
                  <Txt variant="smallSemi" color="ink2">
                    How often does it come in?
                  </Txt>
                  <View style={styles.chips} role="radiogroup" aria-label="How often money comes in">
                    {FrequencyIds.map((f) => (
                      <Chip key={f} role="radio" label={IncomeFrequencies[f].label} selected={freq === f} onPress={() => setFreq(f)} />
                    ))}
                  </View>
                  <Txt variant="smallSemi" color="ink2" style={{ marginTop: 4 }}>
                    {usualAmountLabel(s.word, freq)} (optional)
                  </Txt>
                  <View style={[styles.money, { backgroundColor: c.bg, borderColor: c.line2 }]}>
                    <Txt variant="bodySemi" color="ink3">Rs</Txt>
                    <TextInput value={income} onChangeText={(t) => setIncome(digitsOnly(t))} keyboardType="number-pad" placeholder="0" placeholderTextColor={c.ink3} aria-label={usualAmountLabel(s.word, freq)} style={[styles.moneyInput, { color: c.ink }]} />
                  </View>
                </Animated.View>
              ) : (
                <Txt variant="small" color="ink2">
                  {status === 'student' ? 'No problem. You’ll see what you spend against your budget instead of a balance.' : 'Home will show spending against your budget.'}
                </Txt>
              )}
            </View>
            <View style={[styles.card, { backgroundColor: c.surface }]}>
              <Txt variant="bodySemi">Monthly spending budget</Txt>
              <View style={[styles.money, { backgroundColor: c.bg, borderColor: c.line2 }]}>
                <Txt variant="bodySemi" color="ink3">Rs</Txt>
                <TextInput value={budget} onChangeText={(t) => setBudget(digitsOnly(t))} keyboardType="number-pad" placeholder="No budget" placeholderTextColor={c.ink3} aria-label="Monthly budget" style={[styles.moneyInput, { color: c.ink }]} />
              </View>
              <View style={styles.chips}>
                {s.budgetSuggestions.map((b) => (
                  <Chip key={b} label={formatMoney(b)} selected={budget === String(b)} onPress={() => setBudget(String(b))} />
                ))}
              </View>
            </View>
          </Animated.View>
        )}

        {step === 3 && (
          <View style={[styles.body, { paddingTop: 24 }]}>
            <View style={styles.mark}>
              <BrandMark size={50} radius={16} />
            </View>
            <Txt variant="name" style={styles.h}>
              Setting up your strip
            </Txt>
            <Txt variant="body" color="ink2">
              One moment, {name.trim()}.
            </Txt>
            <View style={{ marginTop: 10 }} aria-label="Setup steps">
              {checklist.map((t, k) => (
                <CheckItem key={t} text={t} index={k} onDone={() => setTicked((n) => n + 1)} />
              ))}
            </View>
          </View>
        )}

        {!!error && (
          <Txt variant="smallBold" color={c.neg} role="alert">
            {error}
          </Txt>
        )}
      </KeyboardAwareScrollView>

      <View style={styles.foot}>
        {step < 3 ? (
          <PrimaryButton label={step < 2 ? 'Continue' : 'Start tracking'} busy={saving} onPress={next} icon="right" />
        ) : ticked >= checklist.length ? (
          <Animated.View entering={reduced ? undefined : FadeInDown.springify()}>
            <PrimaryButton
              label="Open my strip"
              icon="right"
              onPress={() => {
                hapticSuccess();
                finishSetup();
                showToast(`Welcome, ${name.trim()}. Tap + to log a spend.`);
              }}
            />
          </Animated.View>
        ) : (
          <View style={{ height: 56 }} />
        )}
        {step === 0 && (
          <Pressable role="button" onPress={() => router.back()} style={styles.backLink}>
            <Txt variant="smallBold" color="ink2">
              Back to intro
            </Txt>
          </Pressable>
        )}
      </View>
      <KeyboardBar />
    </View>
  );
}

function StepBar({ on }: { on: boolean }) {
  const c = useColors();
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    p.set(withTiming(on ? 1 : 0, { duration: 400, easing: EaseOut }));
  }, [on, p]);
  const a = useAnimatedStyle(() => ({ transform: [{ scaleX: p.get() }] }));
  return (
    <View style={[styles.stepBar, { backgroundColor: c.track }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.ink, transformOrigin: 'left', borderRadius: 3 }, a]} />
    </View>
  );
}

function StatusCard({ id, selected, onPress }: { id: Status; selected: boolean; onPress: () => void }) {
  const c = useColors();
  const reduced = useReducedMotion();
  const info = Statuses[id];
  const check = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    check.set(reduced ? (selected ? 1 : 0) : withSpring(selected ? 1 : 0, { damping: 11, stiffness: 260 }));
  }, [selected, reduced, check]);
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: check.get() }] }));
  return (
    <Pressable role="radio" aria-checked={selected} aria-label={`${info.label}. ${info.blurb}`} onPress={onPress} style={styles.statusWrap}>
      <View style={[styles.status, { backgroundColor: selected ? c.lime : c.surface, borderColor: selected ? c.inkFixed : c.line }]}>
        <View style={[styles.statusIc, { backgroundColor: selected ? c.inkFixed : c.surface2 }]}>
          <Icon name={info.icon} size={20} color={selected ? c.lime : c.ink} />
        </View>
        <Txt variant="bodyBold" color={selected ? c.inkFixed : c.ink}>
          {info.label}
        </Txt>
        <Txt variant="caption" color={selected ? '#2F3A06' : c.ink2}>
          {info.blurb}
        </Txt>
        <Animated.View style={[styles.statusCheck, { backgroundColor: c.inkFixed }, checkStyle]}>
          <Icon name="check" size={14} color={c.lime} strokeWidth={2.6} />
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: Gutter, gap: 18, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', flexGrow: 1 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  steps: { flex: 1, flexDirection: 'row', gap: 6 },
  stepBar: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  body: { gap: 12 },
  h: displayType(46),
  input: { minHeight: 56, borderRadius: 18, borderWidth: 1.5, paddingHorizontal: 16, fontFamily: Fonts.semiBold, fontSize: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statusWrap: { width: '48%', flexGrow: 1 },
  status: { minHeight: 150, padding: 14, gap: 6, borderRadius: Radius.card - 4, borderWidth: 1.5 },
  statusIc: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  statusCheck: { position: 'absolute', top: 12, right: 12, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  card: { padding: 16, borderRadius: Radius.card - 4, gap: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  money: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 54, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16 },
  moneyInput: { flex: 1, minWidth: 0, fontFamily: Fonts.semiBold, fontSize: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 58, borderBottomWidth: 1.5, borderStyle: 'dashed' },
  checkBox: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  checkFill: { position: 'absolute', top: -2, left: -2, right: -2, bottom: -2, borderRadius: 8 },
  mark: { alignSelf: 'flex-start', marginBottom: 6 },
  foot: { paddingHorizontal: Gutter, paddingTop: 10, gap: 6, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  backLink: { alignSelf: 'center', minHeight: 40, justifyContent: 'center', paddingHorizontal: 12 },
});
