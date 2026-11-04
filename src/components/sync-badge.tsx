import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { Txt } from '@/components/txt';
import { EaseOut } from '@/constants/motion';
import { useSyncStatus } from '@/data/sync';
import { useColors } from '@/hooks/use-colors';

/** Waits before showing, so a blip in the connection or a quick upload doesn't flash it. */
function useDelayed(on: boolean, ms: number) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!on) return;
    const t = setTimeout(() => setShown(true), ms);
    return () => {
      clearTimeout(t);
      setShown(false);
    };
  }, [on, ms]);
  return on && shown;
}

/**
 * "Offline · saved on this phone" while there's no connection, "Syncing…" while changes
 * are still uploading. Hidden the rest of the time. Sits just above the toast.
 */
export function SyncBadge() {
  const c = useColors();
  const { online, pending } = useSyncStatus();
  const offline = useDelayed(!online, 1000);
  const syncing = useDelayed(online && pending > 0, 2000);
  if (!offline && !syncing) return null;

  const text = offline ? 'Offline · saved on this phone' : 'Syncing…';
  return (
    <Animated.View
      key={offline ? 'off' : 'sync'}
      entering={FadeIn.duration(200).easing(EaseOut)}
      exiting={FadeOut.duration(150).easing(EaseOut)}
      aria-live="polite"
      accessibilityLabel={text}
      style={[styles.pill, { backgroundColor: c.toast }]}>
      <Icon name={offline ? 'cloudOff' : 'repeat'} size={14} color={c.toastAccent} strokeWidth={2.2} />
      <Txt variant="caption" color={c.toastInk} numberOfLines={1}>
        {text}
      </Txt>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 30,
    paddingHorizontal: 12,
    borderRadius: 99,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
