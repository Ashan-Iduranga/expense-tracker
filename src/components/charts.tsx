import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Txt } from '@/components/txt';
import { EaseOut } from '@/constants/motion';
import { useColors } from '@/hooks/use-colors';
import { hapticSelection } from '@/lib/haptics';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/* ---------- Donut that sweeps round ---------- */

type Slice = { key: string; value: number; color: string; name: string };

function Arc({ start, len, color, progress, r, c }: { start: number; len: number; color: string; progress: { get: () => number }; r: number; c: number }) {
  const circumference = 2 * Math.PI * r;
  const props = useAnimatedProps(() => {
    const visible = Math.max(0, Math.min(len, progress.get() * 100 - start));
    return { strokeDasharray: [(visible / 100) * circumference, circumference] };
  });
  return (
    <AnimatedCircle
      cx={c}
      cy={c}
      r={r}
      stroke={color}
      strokeWidth={18}
      fill="none"
      strokeDashoffset={(-start / 100) * circumference}
      animatedProps={props}
      transform={`rotate(-90 ${c} ${c})`}
    />
  );
}

/** Spending split; the slices sweep round when it appears or the period changes. */
export function Donut({ slices, size = 128, sweepKey }: { slices: Slice[]; size?: number; sweepKey: string }) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return progress.set(1);
    progress.set(0);
    progress.set(withDelay(120, withTiming(1, { duration: 1100, easing: EaseOut })));
  }, [sweepKey, reduced, progress]);

  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const gap = slices.length > 1 ? 0.9 : 0;
  const c = size / 2;
  const r = c - 12;
  // Each slice starts where the ones before it end (percent of the ring).
  const arcs = slices.map((s, i) => ({
    ...s,
    start: slices.slice(0, i).reduce((a, prev) => a + (prev.value / total) * 100, 0),
    len: (s.value / total) * 100,
  }));
  return (
    <Svg width={size} height={size} role="img" aria-label={`Spending split: ${slices.map((s) => `${s.name} ${Math.round((s.value / total) * 100)}%`).join(', ')}`}>
      {arcs.map((a) => (
        <Arc key={a.key} start={a.start} len={Math.max(0.01, a.len - gap)} color={a.color} progress={progress} r={r} c={c} />
      ))}
    </Svg>
  );
}

/* ---------- Day-by-day bars ---------- */

function Bar({ value, index, color, future, onPress, label, selected, sweepKey }: { value: number; index: number; color: string; future: boolean; onPress: () => void; label: string; selected: boolean; sweepKey: string }) {
  const reduced = useReducedMotion();
  const h = useSharedValue(reduced ? value : 0);
  useEffect(() => {
    if (reduced) return h.set(value);
    h.set(0);
    h.set(withDelay(Math.min(index, 30) * 18, withSpring(value, { damping: 12, stiffness: 160 })));
  }, [value, index, reduced, sweepKey, h]);
  const a = useAnimatedStyle(() => ({ transform: [{ scaleY: Math.max(0, h.get()) }] }));
  return (
    <Pressable
      role="button"
      aria-label={label}
      aria-selected={selected}
      disabled={future}
      onPress={() => {
        hapticSelection();
        onPress();
      }}
      style={styles.barHit}>
      <View style={styles.barCol}>
        {!future && <Animated.View style={[styles.barFill, { backgroundColor: color, transformOrigin: 'bottom' }, a]} />}
      </View>
    </Pressable>
  );
}

export function TrendBars({
  values,
  labels,
  axis,
  futureFrom,
  selected,
  onSelect,
  budgetLine,
  budgetLabel,
  dailyBudget,
  sweepKey,
}: {
  values: number[];
  /** Screen-reader label per bar, e.g. "Mon 3 Nov: Rs 1,240". */
  labels: string[];
  /** Short text under some bars ('' for none). */
  axis: string[];
  /** Bars from this index on are in the future and stay empty. */
  futureFrom: number;
  selected: number;
  onSelect: (i: number) => void;
  /** 0–1 height of the daily budget line, or null to hide it. */
  budgetLine: number | null;
  budgetLabel: string;
  dailyBudget: number;
  sweepKey: string;
}) {
  const c = useColors();
  const max = Math.max(1, ...values);
  const dense = values.length > 10;
  return (
    <View>
      <View style={[styles.plot, { gap: dense ? 2 : 6 }]}>
        {budgetLine != null && (
          <View pointerEvents="none" style={[styles.budgetLine, { bottom: `${budgetLine * 100}%`, borderColor: c.ink3 }]}>
            <View style={[styles.budgetTag, { backgroundColor: c.surface }]}>
              <Txt variant="caption" color="ink2">
                {budgetLabel}
              </Txt>
            </View>
          </View>
        )}
        {values.map((v, i) => (
          <Bar
            key={i}
            index={i}
            value={v / max}
            future={i >= futureFrom}
            selected={i === selected}
            label={labels[i]}
            onPress={() => onSelect(i)}
            sweepKey={sweepKey}
            color={i === selected ? c.barSel : dailyBudget && v > dailyBudget && dense ? c.barHi : c.bar}
          />
        ))}
      </View>
      <View style={[styles.axis, { gap: dense ? 2 : 6 }]}>
        {axis.map((a, i) => (
          // A label can be wider than its bar, so it's centred and allowed to overflow its column.
          <View key={i} style={styles.axisCell}>
            {!!a && (
              <Txt variant="caption" color="ink3" style={styles.axisLabel}>
                {a}
              </Txt>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { height: 140, flexDirection: 'row', alignItems: 'flex-end' },
  barHit: { flex: 1, height: '100%' },
  barCol: { flex: 1, justifyContent: 'flex-end' },
  barFill: { height: '100%', borderTopLeftRadius: 5, borderTopRightRadius: 5, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  budgetLine: { position: 'absolute', left: 0, right: 0, height: 0, borderTopWidth: 1.5, borderStyle: 'dashed', zIndex: 1 },
  budgetTag: { position: 'absolute', right: 0, bottom: 3, paddingHorizontal: 4, borderRadius: 4 },
  axis: { flexDirection: 'row', marginTop: 6 },
  axisCell: { flex: 1, alignItems: 'center', overflow: 'visible' },
  axisLabel: { width: 28, textAlign: 'center', fontSize: 11 },
});
