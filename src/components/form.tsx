/** Small form pieces shared by the bill, loan, list and plan sheets, in the goal sheet's style. */
import { useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { Calendar } from '@/components/date-sheet';
import { Icon } from '@/components/icon';
import { Txt } from '@/components/txt';
import { Fonts, Radius } from '@/constants/theme';
import { digitsOnly } from '@/data/account';
import { useColors } from '@/hooks/use-colors';
import { dayLabel } from '@/lib/format';

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <Txt variant="smallSemi" color="ink2">
      {children}
    </Txt>
  );
}

export function TextField(props: TextInputProps & { ref?: Ref<ComponentRef<typeof TextInput>> }) {
  const c = useColors();
  return <TextInput placeholderTextColor={c.ink3} maxFontSizeMultiplier={1.3} {...props} style={[styles.box, styles.text, { color: c.ink, backgroundColor: c.surface, borderColor: c.line2 }, props.style]} />;
}

/** Whole-number money input with the currency in front. */
export function MoneyField({ value, onChange, currency, label, placeholder = '0' }: { value: string; onChange: (v: string) => void; currency: string; label: string; placeholder?: string }) {
  const c = useColors();
  return (
    <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line2 }]}>
      <Txt variant="bodySemi" color="ink3">
        {currency}
      </Txt>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(digitsOnly(t))}
        keyboardType="number-pad"
        placeholder={placeholder}
        placeholderTextColor={c.ink3}
        maxFontSizeMultiplier={1.3}
        aria-label={label}
        style={[styles.text, { color: c.ink }]}
      />
    </View>
  );
}

/** Shows the chosen day; tapping opens a calendar right below it (no second sheet). */
export function DateField({ value, onChange, label, optional, allowFuture = true }: { value: Date | null; onChange: (d: Date | null) => void; label: string; optional?: boolean; allowFuture?: boolean }) {
  const c = useColors();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          role="button"
          aria-label={`${label}: ${value ? dayLabel(value) : 'none'}. Change`}
          aria-expanded={open}
          onPress={() => setOpen((o) => !o)}
          style={[styles.box, { flex: 1, backgroundColor: c.surface, borderColor: open ? c.ink : c.line2 }]}>
          <Icon name="calendar" size={18} color={c.ink2} />
          <Txt variant="bodySemi" color={value ? c.ink : c.ink3} style={{ flex: 1 }}>
            {value ? dayLabel(value) : 'No date'}
          </Txt>
          <Icon name={open ? 'up' : 'down'} size={16} color={c.ink3} />
        </Pressable>
        {optional && value && (
          <Pressable role="button" aria-label={`Clear ${label}`} onPress={() => { onChange(null); setOpen(false); }} style={[styles.clear, { backgroundColor: c.surface2 }]}>
            <Icon name="close" size={18} color={c.ink} />
          </Pressable>
        )}
      </View>
      {open && (
        <Animated.View entering={reduced ? undefined : FadeIn} exiting={reduced ? undefined : FadeOut}>
          <Calendar
            value={value ?? new Date()}
            allowFuture={allowFuture}
            onChange={(d) => {
              onChange(d);
              setOpen(false);
            }}
          />
        </Animated.View>
      )}
    </View>
  );
}

export function FormError({ children }: { children: string }) {
  const c = useColors();
  if (!children) return null;
  return (
    <Txt variant="smallBold" color={c.neg} role="alert">
      {children}
    </Txt>
  );
}

export const formStyles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 54, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1.5 },
  text: { flex: 1, minWidth: 0, fontFamily: Fonts.semiBold, fontSize: 17 },
  clear: { width: 54, height: 54, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
});
