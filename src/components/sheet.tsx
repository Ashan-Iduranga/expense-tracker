import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { IconButton } from '@/components/controls';
import { Txt } from '@/components/txt';
import { EaseOut, SpringSettle } from '@/constants/motion';
import { displayType, Gutter, MaxContentWidth, Radius } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Extra button(s) next to the close button, e.g. delete. */
  headerExtra?: ReactNode;
  children: ReactNode;
};

/**
 * A bottom sheet: springs up from the bottom over a dimmed backdrop. Close it with ×,
 * by tapping the backdrop, by dragging it down, or with the back button.
 */
export function Sheet({ visible, onClose, title, headerExtra, children }: SheetProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const y = useSharedValue(800);
  const fade = useSharedValue(0);
  // Mount as soon as it's asked to show; unmount only after the closing animation.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      y.set(800);
      fade.set(0);
      requestAnimationFrame(() => {
        y.set(reduced ? 0 : withSpring(0, SpringSettle));
        fade.set(withTiming(1, { duration: reduced ? 0 : 250, easing: EaseOut }));
      });
    } else if (mounted) {
      fade.set(withTiming(0, { duration: reduced ? 0 : 200 }));
      y.set(
        withTiming(800, { duration: reduced ? 0 : 220, easing: EaseOut }, (done) => {
          if (done) scheduleOnRN(setMounted, false);
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const drag = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetX([-20, 20])
    .onUpdate((e) => {
      y.set(Math.max(0, e.translationY));
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 900) scheduleOnRN(onClose);
      else y.set(withSpring(0, { ...SpringSettle, velocity: e.velocityY }));
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));

  if (!mounted) return null;

  return (
    <Modal transparent visible onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent animationType="none">
      <GestureHandlerRootView style={styles.fill}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }, backdropStyle]}>
            <Pressable style={styles.fill} onPress={onClose} aria-label="Close" />
          </Animated.View>
          <View style={styles.bottom} pointerEvents="box-none">
            <Animated.View
              role="dialog"
              aria-modal
              aria-label={title}
              style={[styles.sheet, { backgroundColor: c.sheet, paddingBottom: Math.max(20, insets.bottom + 10) }, sheetStyle]}>
              <GestureDetector gesture={drag}>
                <View style={styles.grabArea}>
                  <View style={[styles.grab, { backgroundColor: c.line2 }]} />
                  <View style={styles.head}>
                    <Txt variant="name" style={styles.title} numberOfLines={1}>
                      {title}
                    </Txt>
                    {headerExtra}
                    <IconButton icon="close" label="Close" onPress={onClose} size={40} />
                  </View>
                </View>
              </GestureDetector>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body} bounces={false}>
                {children}
              </ScrollView>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bottom: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth + 40,
    maxHeight: '94%',
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
  },
  grabArea: { paddingTop: 8, paddingHorizontal: Gutter },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
  title: { flex: 1, ...displayType(30) },
  body: { paddingHorizontal: Gutter, paddingTop: 6, gap: 14 },
});
