/**
 * Small animated building blocks shared by every screen.
 * Each one checks useReducedMotion() and shows the final state straight away when it's on.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Txt, type TxtProps } from '@/components/txt';
import { CountMs, EaseOut, SpringGrow, StaggerMs } from '@/constants/motion';
import { formatMoney } from '@/lib/format';

/* ---------- Entrance on focus ---------- */

/**
 * Pops its children up (rise + slight scale) each time the screen comes into focus,
 * staggered by `index`. Animates in place, so scroll position and inputs survive.
 */
export function Enter({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  useFocusEffect(
    useCallback(() => {
      if (reduced) return;
      p.set(0);
      p.set(withDelay(Math.min(index, 8) * StaggerMs, withSpring(1, { damping: 14, stiffness: 170 })));
    }, [index, p, reduced])
  );
  const a = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.get() * 1.6),
    transform: [{ translateY: (1 - p.get()) * 18 }, { scale: 0.96 + 0.04 * p.get() }],
  }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/* ---------- Counting numbers ---------- */

type CountProps = Omit<TxtProps, 'children'> & {
  value: number;
  currency?: string;
  sign?: '' | '+' | '−';
  /** Without the currency, e.g. a percentage built around it. */
  format?: (n: number) => string;
};

/**
 * A total that counts up to its value (and between values when it changes),
 * like Magic UI's Number Ticker. Screen readers get the final value only.
 */
export function CountUp({ value, currency = 'Rs', sign = '', format, ...rest }: CountProps) {
  const reduced = useReducedMotion();
  const fmt = useCallback((n: number) => (format ? format(n) : formatMoney(n, currency, sign)), [currency, format, sign]);
  const [shown, setShown] = useState(reduced ? value : 0);
  const from = useRef(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      from.current = value;
      return;
    }
    const start = from.current;
    const t0 = Date.now();
    let frame = 0;
    const tick = () => {
      const k = Math.min(1, (Date.now() - t0) / CountMs);
      const e = 1 - Math.pow(1 - k, 4);
      const next = start + (value - start) * e;
      from.current = next;
      setShown(next);
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);

  return (
    <Txt {...rest} accessibilityLabel={fmt(value)}>
      {fmt(reduced ? value : shown)}
    </Txt>
  );
}

/* ---------- Progress bar ---------- */

export function ProgressBar({
  value,
  color,
  track,
  height = 10,
  style,
}: {
  value: number;
  color: string;
  track: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const target = Math.max(0, Math.min(1, value));
  const p = useSharedValue(reduced ? target : 0);
  useEffect(() => {
    p.set(reduced ? target : withSpring(target, SpringGrow));
  }, [target, reduced, p]);
  const a = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0, p.get()) }] }));
  return (
    <View style={[{ height, borderRadius: 4, backgroundColor: track, overflow: 'hidden' }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: color, transformOrigin: 'left' }, a]} />
    </View>
  );
}

/* ---------- Progress ring ---------- */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function ProgressRing({
  value,
  size = 56,
  stroke = 5,
  color,
  track,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color: string;
  track: string;
  children?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const target = Math.max(0, Math.min(1, value));
  const p = useSharedValue(reduced ? target : 0);
  useEffect(() => {
    p.set(reduced ? target : withTiming(target, { duration: 1100, easing: EaseOut }));
  }, [target, reduced, p]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - p.get()) }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${len} ${len}`}
          animatedProps={props}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

/* ---------- Block meter ---------- */

function Block({ lit, index, on, off }: { lit: boolean; index: number; on: string; off: string }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced && lit ? 1 : 0);
  useEffect(() => {
    if (reduced) p.set(lit ? 1 : 0);
    else p.set(lit ? withDelay(200 + index * 28, withSpring(1, { damping: 12, stiffness: 240 })) : withTiming(0, { duration: 150 }));
  }, [lit, index, reduced, p]);
  const a = useAnimatedStyle(() => ({ opacity: p.get(), transform: [{ scaleY: 0.5 + 0.5 * p.get() }] }));
  return (
    <View style={[styles.block, { backgroundColor: off }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: on, borderRadius: 3 }, a]} />
    </View>
  );
}

/** The Volt budget meter: 24 blocks that light up one by one. */
export function BlockMeter({ value, on, off, label }: { value: number; on: string; off: string; label: string }) {
  const count = 24;
  const lit = Math.min(count, Math.round(Math.max(0, Math.min(1, value)) * count));
  return (
    <View style={styles.meter} role="progressbar" aria-label={label} aria-valuenow={Math.round(value * 100)}>
      {Array.from({ length: count }, (_, i) => (
        <Block key={i} index={i} lit={i < lit} on={on} off={off} />
      ))}
    </View>
  );
}

/* ---------- Boing: a quick overshoot when something gets selected ---------- */

export function useBoing(active: boolean) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (active && !reduced) s.set(withSequence(withTiming(1.08, { duration: 110, easing: Easing.out(Easing.quad) }), withSpring(1, { damping: 9, stiffness: 260 })));
  }, [active, reduced, s]);
  return useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
}


const styles = StyleSheet.create({
  meter: { flexDirection: 'row', gap: 3, height: 26 },
  block: { flex: 1, borderRadius: 3, overflow: 'hidden' },
});
