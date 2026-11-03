import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, PrimaryButton } from '@/components/controls';
import { Icon, type IconName } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { Txt } from '@/components/txt';
import { Gutter, MaxContentWidth, NavHeight, Radius } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

/** A scrolling screen with the safe-area top, side gutter, and room for the floating nav. */
export function Screen({ children, withNav = true, ...rest }: ScrollViewProps & { children: ReactNode; withNav?: boolean }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      {...rest}
      style={[{ flex: 1, backgroundColor: c.bg }, rest.style]}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 12, paddingBottom: (withNav ? NavHeight : 0) + Math.max(24, insets.bottom) + 24 },
        rest.contentContainerStyle,
      ]}>
      {children}
    </ScrollView>
  );
}

/** Top of a pushed screen: back, a title, and an optional action on the right. */
export function StackHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.stackHead}>
      <IconButton icon="back" label="Back" onPress={() => router.back()} />
      <Txt variant="title" role="heading" numberOfLines={1} style={{ flex: 1 }}>
        {title}
      </Txt>
      {action}
    </View>
  );
}

/** The lime "+ New" pill used at the top of list screens. */
export function NewButton({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <PressableScale role="button" aria-label={label} onPress={onPress} style={[styles.newBtn, { backgroundColor: c.accent }]}>
      <Icon name="plus" size={16} color={c.onAccent} strokeWidth={2.4} />
      <Txt variant="smallBold" color={c.onAccent}>
        {label}
      </Txt>
    </PressableScale>
  );
}

/** Section title with an optional action on the right. */
export function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHead}>
      <Txt variant="section" role="heading">
        {title}
      </Txt>
      {action}
    </View>
  );
}

/** What to show when a list is empty: what will appear here, and how to start. */
export function EmptyState({ icon, title, body, action, onAction }: { icon: IconName; title: string; body: string; action?: string; onAction?: () => void }) {
  const c = useColors();
  return (
    <View style={[styles.empty, { borderColor: c.line2 }]}>
      <Icon name={icon} size={30} color={c.accentInk} />
      <Txt variant="bodyBold" style={{ textAlign: 'center' }}>
        {title}
      </Txt>
      <Txt variant="small" color="ink3" style={{ textAlign: 'center', maxWidth: 270 }}>
        {body}
      </Txt>
      {action && onAction && <PrimaryButton label={action} onPress={onAction} tone="soft" style={{ marginTop: 6 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Gutter, gap: 20, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  stackHead: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 42, paddingHorizontal: 16, borderRadius: 99 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28, paddingHorizontal: 18, borderRadius: Radius.card, borderWidth: 1.5, borderStyle: 'dashed' },
});
