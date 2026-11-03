import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { BrandMark } from '@/components/brand-mark';
import { PrimaryButton } from '@/components/controls';
import { Txt } from '@/components/txt';
import { SpringBouncy } from '@/constants/motion';
import { displayType, Gutter, Radius } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

const Words = ['Track', 'Budget', 'Save'];

function Word({ text, on }: { text: string; on: boolean }) {
  const c = useColors();
  const reduced = useReducedMotion();
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    p.set(reduced ? (on ? 1 : 0) : withSpring(on ? 1 : 0, SpringBouncy));
  }, [on, reduced, p]);
  const a = useAnimatedStyle(() => ({ opacity: 0.12 + 0.88 * p.get(), transform: [{ translateX: 14 * p.get() }] }));
  const dot = useAnimatedStyle(() => ({ opacity: p.get(), transform: [{ scale: p.get() }] }));
  return (
    <Animated.View style={[styles.wordRow, a]}>
      <Animated.View style={[styles.wordDot, { backgroundColor: c.lime, borderColor: c.ink }, dot]} />
      <Txt style={styles.word}>{`${text}.`}</Txt>
    </Animated.View>
  );
}

/** "Track. Budget. Save." — the active word slides forward until the user moves on; a lime glow breathes underneath. */
export default function Onboarding() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const glow = useSharedValue(1);

  // Loops for as long as the intro is on screen. Setup is pushed on top, so pause
  // while it's covered and pick up again if the user comes back.
  useFocusEffect(
    useCallback(() => {
      if (reduced) return;
      setPlaying(true);
      const id = setInterval(() => setActive((k) => (k + 1) % Words.length), 1700);
      glow.set(withRepeat(withTiming(1.07, { duration: 3000 }), -1, true));
      return () => {
        clearInterval(id);
        cancelAnimation(glow);
        setPlaying(false);
      };
    }, [reduced, glow])
  );

  const glowStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - glow.get()) * 200 }, { scale: glow.get() }] }));

  return (
    <View style={[styles.fill, { backgroundColor: c.bg, paddingTop: insets.top + 12, paddingBottom: Math.max(24, insets.bottom + 12) }]}>
      <Animated.View pointerEvents="none" style={[styles.glow, { opacity: c.obGlow }, glowStyle]}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="g" cx="50%" cy="60%" r="55%">
              <Stop offset="0" stopColor={c.lime} stopOpacity="1" />
              <Stop offset="1" stopColor={c.lime} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#g)" />
        </Svg>
      </Animated.View>

      <View style={styles.head}>
        <BrandMark size={52} radius={17} loop={playing} />
        <Pressable role="button" onPress={() => router.push('/setup')} style={[styles.skip, { backgroundColor: c.surface2 }]}>
          <Txt variant="smallBold">Skip</Txt>
        </Pressable>
      </View>

      <View style={styles.words} aria-label="Track, budget and save" accessible>
        {Words.map((w, i) => (
          <Word key={w} text={w} on={i === active} />
        ))}
      </View>

      <View style={styles.low}>
        <Txt style={styles.title} color={c.obTitle}>
          {'Every rupee.\nOn your side.'}
        </Txt>
        <Txt variant="bodyMedium" color={c.obBody} style={{ maxWidth: 320 }}>
          For students on pocket money and people on a salary. Income is optional, the budget is yours.
        </Txt>
        <PrimaryButton
          label="Get started"
          icon="right"
          onPress={() => router.push('/setup')}
          style={{ marginTop: 8 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, paddingHorizontal: Gutter + 4, overflow: 'hidden' },
  glow: { position: 'absolute', left: '-30%', right: '-30%', bottom: '-12%', height: '62%' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skip: { minHeight: 40, paddingHorizontal: 16, borderRadius: Radius.pill, justifyContent: 'center' },
  words: { marginTop: 34 },
  wordRow: { flexDirection: 'row', alignItems: 'center' },
  wordDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 3, marginRight: 12 },
  // A safe line box, pulled together with a negative margin to keep the tight stack.
  word: { ...displayType(92), textTransform: 'uppercase', marginBottom: -18 },
  low: { marginTop: 'auto', gap: 12 },
  title: { ...displayType(52), textTransform: 'uppercase' },
});
