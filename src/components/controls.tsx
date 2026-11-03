/** Buttons, chips, the sliding segmented control and the switch, in the Volt style. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type LayoutRectangle, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

import { Icon, type IconName } from '@/components/icon';
import { useBoing } from '@/components/motion';
import { PressableScale } from '@/components/pressable-scale';
import { Txt } from '@/components/txt';
import { SpringBouncy, SpringSettle } from '@/constants/motion';
import { Radius } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';
import { hapticSelection } from '@/lib/haptics';

/* ---------- Primary button ---------- */

export function PrimaryButton({
  label,
  onPress,
  disabled,
  icon,
  busy,
  tone = 'accent',
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: IconName;
  busy?: boolean;
  tone?: 'accent' | 'danger' | 'soft';
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const bg = tone === 'danger' ? c.neg : tone === 'soft' ? c.surface2 : c.accent;
  const fg = tone === 'danger' ? c.onNeg : tone === 'soft' ? c.ink : c.onAccent;
  return (
    <PressableScale
      role="button"
      aria-label={label}
      aria-disabled={disabled}
      disabled={disabled || busy}
      onPress={onPress}
      scaleTo={0.97}
      containerStyle={style}
      style={[styles.primary, { backgroundColor: bg, opacity: disabled ? 0.4 : 1 }]}>
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          <Txt variant="button" color={fg}>
            {label}
          </Txt>
          {icon && <Icon name={icon} size={18} color={fg} strokeWidth={2.2} />}
        </>
      )}
    </PressableScale>
  );
}

/* ---------- Round icon button ---------- */

export function IconButton({ icon, label, onPress, tone = 'plain', size = 44 }: { icon: IconName; label: string; onPress: () => void; tone?: 'plain' | 'danger'; size?: number }) {
  const c = useColors();
  return (
    <PressableScale role="button" aria-label={label} onPress={onPress} hitSlop={6} style={[styles.iconBtn, { width: size, height: size, backgroundColor: c.surface2 }]}>
      <Icon name={icon} size={20} color={tone === 'danger' ? c.neg : c.ink} />
    </PressableScale>
  );
}

/* ---------- Chip ---------- */

export function Chip({
  label,
  selected,
  onPress,
  icon,
  role = 'button',
  big,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  role?: 'button' | 'radio';
  big?: boolean;
}) {
  const c = useColors();
  const boing = useBoing(!!selected);
  return (
    <Pressable
      role={role}
      aria-checked={role === 'radio' ? selected : undefined}
      aria-pressed={role === 'button' ? selected : undefined}
      onPress={() => {
        hapticSelection();
        onPress();
      }}
      style={big ? styles.chipBigWrap : undefined}>
      <Animated.View
        style={[
          styles.chip,
          big && styles.chipBig,
          { backgroundColor: selected ? c.chipOn : c.surface, borderColor: selected ? c.chipOn : c.line },
          boing,
        ]}>
        {icon && <Icon name={icon} size={16} color={selected ? c.chipOnInk : c.ink} />}
        <Txt variant="smallBold" color={selected ? c.chipOnInk : c.ink}>
          {label}
        </Txt>
      </Animated.View>
    </Pressable>
  );
}

/* ---------- Segmented control with a sliding pill ---------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  small,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  small?: boolean;
  label: string;
}) {
  const c = useColors();
  const reduced = useReducedMotion();
  const [layouts, setLayouts] = useState<Partial<Record<T, LayoutRectangle>>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const placed = useRef(false);

  useEffect(() => {
    const l = layouts[value];
    if (!l) return;
    if (!placed.current || reduced) {
      x.set(l.x);
      w.set(l.width);
      placed.current = true;
      return;
    }
    x.set(withSpring(l.x, SpringSettle));
    w.set(withSpring(l.width, SpringSettle));
  }, [value, layouts, reduced, x, w]);

  const pill = useAnimatedStyle(() => ({ width: w.get(), transform: [{ translateX: x.get() }] }));

  return (
    <View role="tablist" aria-label={label} style={[styles.seg, { backgroundColor: c.track }]}>
      {layouts[value] && <Animated.View style={[styles.segPill, { backgroundColor: c.accent }, small && styles.segPillSmall, pill]} />}
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            role="tab"
            aria-selected={on}
            onLayout={(e) => {
              const l = e.nativeEvent.layout;
              setLayouts((cur) => ({ ...cur, [o.value]: l }));
            }}
            onPress={() => {
              if (on) return;
              hapticSelection();
              onChange(o.value);
            }}
            style={[styles.segItem, small && styles.segItemSmall, on && !layouts[value] && { backgroundColor: c.accent, borderRadius: Radius.pill }]}>
            <Txt variant="smallBold" color={on ? c.onAccent : c.ink2} style={small ? { fontSize: 13 } : { fontSize: 14 }}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- Switch ---------- */

export function Switch({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const c = useColors();
  const reduced = useReducedMotion();
  const x = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    x.set(reduced ? (value ? 1 : 0) : withSpring(value ? 1 : 0, SpringBouncy));
  }, [value, reduced, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() * 20 }] }));
  return (
    <Pressable
      role="switch"
      aria-checked={value}
      aria-label={label}
      hitSlop={8}
      onPress={() => {
        hapticSelection();
        onChange(!value);
      }}
      style={[styles.switch, { backgroundColor: value ? c.accent : c.line2 }]}>
      <Animated.View style={[styles.knob, { backgroundColor: value ? c.onAccent : c.white }, knob]} />
    </Pressable>
  );
}

/* ---------- Card ---------- */

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.surface }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  primary: {
    minHeight: 56,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 22,
  },
  iconBtn: { borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  chipBigWrap: { flexGrow: 1, flexBasis: '40%' },
  chipBig: { minHeight: 48 },
  seg: { flexDirection: 'row', padding: 4, borderRadius: Radius.pill },
  segPill: { position: 'absolute', top: 4, left: 0, height: 40, borderRadius: Radius.pill },
  segPillSmall: { height: 32 },
  segItem: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  segItemSmall: { minHeight: 32, paddingHorizontal: 10 },
  switch: { width: 50, height: 30, borderRadius: 15, padding: 3 },
  knob: { width: 24, height: 24, borderRadius: 12 },
  card: { borderRadius: Radius.card, padding: 18, gap: 14 },
});

