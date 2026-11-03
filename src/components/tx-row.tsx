import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '@/components/icon';
import { Txt } from '@/components/txt';
import { EaseOut } from '@/constants/motion';
import { displayType, Radius } from '@/constants/theme';
import { categoryColorKey, categoryInfo } from '@/data/categories';
import { usePlans } from '@/data/plans';
import type { Transaction } from '@/data/transactions';
import { useColors } from '@/hooks/use-colors';
import { formatMoney, whenLabel } from '@/lib/format';
import { hapticDelete } from '@/lib/haptics';

/** A swipe whose projected resting point passes this share of the row's width deletes it. */
const CommitFraction = 0.4;

/** Where the finger would come to rest if it kept decelerating (Apple's decay model). */
function project(velocity: number, decelerationRate = 0.998) {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** The further past the edge, the less the row follows. */
function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

type TxRowProps = {
  tx: Transaction;
  currency: string;
  onPress: (id: string) => void;
  onDelete: (id: string) => void;
};

/** Tap to edit; swipe left (or flick) to delete. Screen readers get a Delete action. */
export function TxRow({ tx, currency, onPress, onDelete }: TxRowProps) {
  const c = useColors();
  const { id } = tx;
  const info = categoryInfo(tx.category);
  const { plans } = usePlans();
  const planName = tx.planId ? plans.find((pl) => pl.id === tx.planId)?.name : undefined;
  const color = c.cat[categoryColorKey(tx.type, tx.category)];
  const income = tx.type === 'income';
  const width = useSharedValue(0);
  const x = useSharedValue(0);
  const start = useSharedValue(0);
  const [swiping, setSwiping] = useState(false);
  const touchWasSwipe = useSharedValue(false);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-12, 12])
        .onBegin(() => {
          touchWasSwipe.set(false);
        })
        .onStart(() => {
          start.set(x.get());
          touchWasSwipe.set(true);
          scheduleOnRN(setSwiping, true);
        })
        .onUpdate((e) => {
          const next = start.get() + e.translationX;
          x.set(next <= 0 ? next : rubberband(next, width.get()));
        })
        .onEnd((e) => {
          const projected = x.get() + project(e.velocityX);
          if (projected < -width.get() * CommitFraction) {
            scheduleOnRN(hapticDelete);
            x.set(
              withTiming(-width.get(), { duration: 200, easing: EaseOut }, (finished) => {
                if (finished) scheduleOnRN(onDelete, id);
              })
            );
          } else {
            x.set(withSpring(0, { damping: 22, stiffness: 240, velocity: e.velocityX }));
          }
        })
        .onFinalize(() => {
          scheduleOnRN(setSwiping, false);
        }),
    [id, onDelete, start, width, x, touchWasSwipe]
  );

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const layerStyle = useAnimatedStyle(() => ({ opacity: x.get() < -0.5 ? 1 : 0 }));
  const actionStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.get(), [-72, -24], [1, 0], Extrapolation.CLAMP) }));
  const amount = formatMoney(tx.amount, currency, income ? '+' : '−');

  return (
    <View style={styles.container} onLayout={(e) => width.set(e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.deleteLayer, { backgroundColor: c.neg }, layerStyle]} aria-hidden>
        <Animated.View style={[styles.deleteAction, actionStyle]}>
          <Icon name="trash" size={20} color={c.onNeg} />
          <Txt variant="smallBold" color={c.onNeg}>
            Delete
          </Txt>
        </Animated.View>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>
          <Pressable
            role="button"
            aria-label={`${tx.note}, ${income ? 'income' : 'expense'} ${amount}, ${info.name}, ${whenLabel(tx.date)}${planName ? `, ${planName}` : ''}. Edit`}
            accessibilityActions={[{ name: 'delete', label: 'Delete' }]}
            onAccessibilityAction={(e) => e.nativeEvent.actionName === 'delete' && onDelete(id)}
            onPress={() => {
              if (touchWasSwipe.get()) return;
              onPress(id);
            }}
            style={({ pressed }) => [styles.row, { backgroundColor: pressed && !swiping ? c.surface2 : c.surface }]}>
            <View style={[styles.icon, { backgroundColor: color + '24' }]}>
              <Icon name={info.icon} size={20} color={color} />
            </View>
            <View style={styles.text}>
              <Txt variant="bodySemi" numberOfLines={1}>
                {tx.note}
              </Txt>
              <Txt variant="caption" color="ink3" numberOfLines={1}>
                {info.name} · {whenLabel(tx.date)}
                {planName ? ` · ${planName}` : ''}
              </Txt>
            </View>
            <Txt style={styles.amount} color={income ? c.posInk : c.ink}>
              {amount}
            </Txt>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', borderRadius: Radius.row },
  deleteLayer: { ...StyleSheet.absoluteFill, top: 1, bottom: 1, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 20, borderRadius: Radius.row },
  deleteAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: Radius.row },
  icon: { width: 42, height: 42, borderRadius: Radius.icon, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 1 },
  amount: displayType(22),
});
