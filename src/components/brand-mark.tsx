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
import Svg, { Path } from 'react-native-svg';

import { EaseInOut, EaseOut, SpringBouncy } from '@/constants/motion';
import { Light } from '@/constants/theme';

/** How far the card starts tucked inside the wallet, in grid units. */
const Tucked = 11.5;
/** Above the tile, out of sight (the tile clips). */
const Above = -52;
/** Fully behind the wallet, even mid-squash. */
const Inside = 17;
/** How long the note stays out of sight between gulps, by default. */
const HiddenMs = 1300;

/**
 * The "$" on the note, in the icon's 100-unit grid (before the icon's 0.75 nudge down).
 * The same paths are in assets/icon/*.svg. Only the top strip shows above the wallet.
 */
export const DollarS = 'M49.5 27.8C49.1 27.1 48.2 26.6 47 26.6C45.6 26.6 44.5 27.4 44.5 28.3C44.5 30 49.5 29.9 49.5 31.7C49.5 32.6 48.4 33.4 47 33.4C45.7 33.4 44.8 32.9 44.5 32.2';
export const DollarBar = 'M47 25.4V34.6';

/**
 * The "Pocket Wallet" mark, the same drawing as assets/icon/icon.svg (a 100-unit grid),
 * built from Views so it can move. By default the card slides up out of the wallet once;
 * with `loop`, the wallet gulps the note and a new one drops in, until `loop` turns off.
 * Each loop starts and ends on the resting pose, so it picks up seamlessly from the static
 * icon (the native splash). `hiddenMs` is how long the wallet stays empty between notes.
 * Colours are fixed: the mark looks the same in light and dark mode, like the app icon.
 */
export function BrandMark({
  size = 46,
  radius = 15,
  animate = true,
  loop = false,
  hiddenMs = HiddenMs,
}: {
  size?: number;
  radius?: number;
  animate?: boolean;
  loop?: boolean;
  hiddenMs?: number;
}) {
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
      const cycle = 1100 + hiddenMs;
      // From rest: 0–350 hold · 350–650 sink · 550–900 gulp · hidden · drop in over 450 · rest.
      lift.set(0);
      lift.set(
        withRepeat(
          withSequence(
            withDelay(350, withTiming(Inside * u, { duration: 300, easing: EaseInOut })),
            withTiming(Above * u, { duration: 0 }),
            withDelay(hiddenMs, withTiming(0, { duration: 450, easing: EaseOut }))
          ),
          -1
        )
      );
      tilt.set(0);
      tilt.set(
        withRepeat(
          withSequence(
            withDelay(650, withTiming(-8, { duration: 0 })),
            withDelay(hiddenMs, withTiming(0, { duration: 450, easing: EaseOut }))
          ),
          -1
        )
      );
      gulp.set(
        withRepeat(
          withSequence(
            withDelay(550, withTiming(1, { duration: 110, easing: EaseOut })),
            withTiming(0, { duration: 240, easing: EaseOut }),
            withDelay(cycle - 900, withTiming(0, { duration: 0 }))
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
  }, [looping, still, u, hiddenMs, lift, tilt, gulp]);

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
        ]}>
        {/* Inside the card's border: the grid square from (29.5, 25.5). */}
        <Svg width={35 * u} height={17 * u} viewBox="29.5 25.5 35 17" style={{ position: 'absolute', left: 0, top: 0 }}>
          <Path d={DollarBar} stroke={Light.ink} strokeWidth={1.6} strokeLinecap="round" />
          <Path d={DollarS} stroke={Light.ink} strokeWidth={1.6} strokeLinecap="round" fill="none" />
        </Svg>
      </Animated.View>
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
