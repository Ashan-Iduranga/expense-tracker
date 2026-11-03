import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutRectangle } from 'react-native';
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Icon, type IconName } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { Txt } from '@/components/txt';
import { SpringBouncy } from '@/constants/motion';
import { MaxContentWidth } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';
import { hapticSelection } from '@/lib/haptics';

const Tabs: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Home', icon: 'home' },
  history: { label: 'History', icon: 'list' },
  hub: { label: 'Plan', icon: 'target' },
  insights: { label: 'Stats', icon: 'chart' },
};

/** The parts of Expo Router's (SDK 58) tab-bar props this bar uses. */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  emitter: { emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
  navigateToTab: (routeKey: string) => void;
};

const Grow = LinearTransition.springify().damping(16).stiffness(200);

/**
 * Floating black pill. The active tab grows into a lime pill with its label
 * (21st.dev "Expanding Tabs" behaviour), the others shrink to icons. The lime +
 * beside it opens the add sheet.
 */
export function PillNav({ state, emitter, navigateToTab }: TabBarProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [layouts, setLayouts] = useState<Record<string, LayoutRectangle>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const placed = useRef(false);
  const active = state.routes[state.index]?.key;

  useEffect(() => {
    const l = layouts[active];
    if (!l) return;
    if (!placed.current || reduced) {
      x.set(l.x);
      w.set(l.width);
      placed.current = true;
    } else {
      x.set(withSpring(l.x, SpringBouncy));
      w.set(withSpring(l.width, SpringBouncy));
    }
  }, [active, layouts, reduced, x, w]);

  const indicator = useAnimatedStyle(() => ({ width: w.get(), transform: [{ translateX: x.get() }] }));

  const bottom = Math.max(16, insets.bottom);
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: bottom }]}>
      {/* Scroll-edge fade: content scrolling under the floating pill fades out instead of being sliced by its edge. */}
      <View pointerEvents="none" style={[styles.fade, { height: 64 + bottom + 48 }]}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="navFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={c.bg} stopOpacity="0" />
              <Stop offset="0.45" stopColor={c.bg} stopOpacity="0.9" />
              <Stop offset="1" stopColor={c.bg} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#navFade)" />
        </Svg>
      </View>
      <View style={styles.row}>
        <View style={[styles.pill, { backgroundColor: c.inkFixed }]} role="tablist">
          {layouts[active] && <Animated.View style={[styles.indicator, { backgroundColor: c.lime }, indicator]} />}
          {state.routes.map((route, i) => {
            const tab = Tabs[route.name];
            if (!tab) return null;
            const on = i === state.index;
            return (
              <Animated.View
                key={route.key}
                layout={reduced ? undefined : Grow}
                onLayout={(e) => {
                  const l = e.nativeEvent.layout;
                  setLayouts((cur) => ({ ...cur, [route.key]: l }));
                }}
                style={{ flexGrow: on ? 2.2 : 1, flexBasis: 0 }}>
                <Pressable
                  role="tab"
                  aria-selected={on}
                  aria-label={tab.label}
                  onPress={() => {
                    const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                    if (!on && !event.defaultPrevented) {
                      hapticSelection();
                      navigateToTab(route.key);
                    }
                  }}
                  style={styles.tab}>
                  <Icon name={tab.icon} size={22} color={on ? c.inkFixed : '#9EA390'} />
                  {on && (
                    <Animated.View entering={reduced ? undefined : FadeIn.delay(80).duration(220)}>
                      <Txt variant="smallBold" color={c.inkFixed} numberOfLines={1}>
                        {tab.label}
                      </Txt>
                    </Animated.View>
                  )}
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
        <PressableScale
          role="button"
          aria-label="Add expense"
          onPress={() => router.push('/add')}
          scaleTo={0.88}
          style={[styles.add, { backgroundColor: c.lime }]}>
          <Icon name="plus" size={28} color={c.inkFixed} strokeWidth={2.4} />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, alignItems: 'center' },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', maxWidth: MaxContentWidth },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderRadius: 999,
    // Invisible on the light background; keeps the pill's edge visible in dark mode.
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    shadowColor: '#0E0F0C',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  indicator: { position: 'absolute', top: 6, bottom: 6, left: 0, borderRadius: 999 },
  tab: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10 },
  add: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6E9600',
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
});
