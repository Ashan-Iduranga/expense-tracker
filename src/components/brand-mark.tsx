import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { EaseInOut, EaseOut, SpringBouncy } from '@/constants/motion';
import { Light } from '@/constants/theme';

/** How far the card starts tucked inside the wallet, in grid units. */
const Tucked = 11.5;
/** Above the tile, out of sight (the tile clips). */
const Above = -52;
/** Fully behind the wallet, even mid-squash. */
const Inside = 17;
/** One drop-sink-gulp cycle. Every sequence below adds up to this. */
const CycleMs = 2400;

/**
 * The "Pocket Wallet" mark, the same drawing as assets/icon/icon.svg (a 100-unit grid),
 * built from Views so it can move. By default the card slides up out of the wallet once;
 * with `loop`, a note keeps dropping in and the wallet gulps it, until `loop` turns off.
 * Colours are fixed: the mark looks the same in light and dark mode, like the app icon.
 */
export function BrandMark({ size = 46, radius = 15, animate = true, loop = false }: { size?: number; radius?: number; animate?: boolean; loop?: boolean }) {
  const reduced = useReducedMotion();
  const u = size / 100;
  const still = reduced || !animate;
  const looping = loop && !reduced;
  const lift = useSharedValue(still ? 0 : Tucked * u);
  const tilt = useSharedValue(0);
  /** 0 → 1 → 0 pulse when the note goes in. */
  const gulp = useSharedValue(0);

  useEffect(() => {
    if (looping) {
      // 0–450 drop in · 800–1100 sink · 1000–1350 gulp · rest until 2400.
      lift.set(Above * u);
      lift.set(
        withRepeat(
          withSequence(
            withTiming(0, { duration: 450, easing: EaseOut }),
            withDelay(350, withTiming(Inside * u, { duration: 300, easing: EaseInOut })),
            withTiming(Above * u, { duration: 0 }),
            withDelay(CycleMs - 1100, withTiming(Above * u, { duration: 0 }))
          ),
          -1
        )
      );
      tilt.set(-8);
      tilt.set(
        withRepeat(
          withSequence(
            withTiming(0, { duration: 450, easing: EaseOut }),
            withDelay(650, withTiming(-8, { duration: 0 })),
            withDelay(CycleMs - 1100, withTiming(-8, { duration: 0 }))
          ),
          -1
        )
      );
      gulp.set(
        withRepeat(
          withSequence(
            withDelay(1000, withTiming(1, { duration: 110, easing: EaseOut })),
            withTiming(0, { duration: 240, easing: EaseOut }),
            withDelay(CycleMs - 1350, withTiming(0, { duration: 0 }))
          ),
          -1
        )
      );
      return () => {
        cancelAnimation(lift);
        cancelAnimation(tilt);
        cancelAnimation(gulp);
        // Come to rest looking like the app icon.
        lift.set(withSpring(0, SpringBouncy));
        tilt.set(0);
        gulp.set(0);
      };
    }
    if (!still) lift.set(withDelay(250, withSpring(0, SpringBouncy)));
  }, [looping, still, u, lift, tilt, gulp]);

  const card = useAnimatedStyle(() => ({ transform: [{ translateY: lift.get() }, { rotate: `${tilt.get()}deg` }] }));
  const wallet = useAnimatedStyle(() => ({ transform: [{ scaleX: 1 + 0.04 * gulp.get() }, { scaleY: 1 - 0.08 * gulp.get() }] }));
  const dot = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.35 * gulp.get() }] }));

  return (
    <View
      role="img"
      aria-label="Daily Strip"
      style={{ width: size, height: size, borderRadius: radius, backgroundColor: Light.lime, overflow: 'hidden' }}>
      {/* The card sits behind the wallet, so it only shows above the wallet's top edge. */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 26.5 * u,
            top: 23.25 * u,
            width: 41 * u,
            height: 23 * u,
            borderRadius: 5.5 * u,
            borderWidth: 3 * u,
            borderColor: Light.ink,
            backgroundColor: Light.bg,
          },
          card,
        ]}
      />
      {/* Wallet and clasp squash together from the wallet's bottom edge. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transformOrigin: '50% 76.75%' }, wallet]}>
        <View style={{ position: 'absolute', left: 20 * u, top: 34.75 * u, width: 60 * u, height: 42 * u, borderRadius: 9 * u, backgroundColor: Light.ink }} />
        <View
          style={{
            position: 'absolute',
            left: 57 * u,
            top: 48.75 * u,
            width: 23 * u,
            height: 14 * u,
            borderRadius: 7 * u,
            backgroundColor: Light.lime,
            justifyContent: 'center',
            paddingLeft: 4.2 * u,
          }}>
          <Animated.View style={[{ width: 5.6 * u, height: 5.6 * u, borderRadius: 2.8 * u, backgroundColor: Light.ink }, dot]} />
        </View>
      </Animated.View>
    </View>
  );
}
