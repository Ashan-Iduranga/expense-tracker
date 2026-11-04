import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeOut, useReducedMotion } from 'react-native-reanimated';

import { BrandMark } from '@/components/brand-mark';

/** Matches the native splash in app.json: background colour and image width. */
const SplashBg = '#0E0F0C';
const MarkSize = 150;
/** Short gap between notes, so one full gulp-and-refill fits in a quick launch. */
const HiddenMs = 150;
/** One loop from rest back to rest (see BrandMark). */
const CycleMs = 1100 + HiddenMs;

/**
 * Takes over from the static native splash with the same mark, now moving: the wallet gulps
 * the note and a new one drops in. Stays until the app is ready and at least one loop has
 * played, so it always ends on the resting pose, then fades out over the app.
 */
export function LoadingSplash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const reduced = useReducedMotion();
  const [played, setPlayed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setPlayed(true), reduced ? 0 : CycleMs);
    return () => clearTimeout(t);
  }, [reduced]);

  useEffect(() => {
    if (ready && played) onDone();
  }, [ready, played, onDone]);

  return (
    <Animated.View
      exiting={reduced ? undefined : FadeOut.duration(260)}
      style={[StyleSheet.absoluteFill, styles.fill]}
      // Hide the native splash only once this identical-looking view is on screen.
      onLayout={() => SplashScreen.hideAsync()}
      aria-label="Loading Daily Strip"
      aria-busy>
      <BrandMark size={MarkSize} radius={MarkSize * 0.224} loop hiddenMs={HiddenMs} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { backgroundColor: SplashBg, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
});
