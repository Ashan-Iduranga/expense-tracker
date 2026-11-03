import { type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

import { SpringBouncy } from '@/constants/motion';

type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  /** Layout of the touch target (flex, width…). */
  containerStyle?: StyleProp<ViewStyle>;
  /** The visible surface that scales. */
  style?: StyleProp<ViewStyle>;
  /** How far it shrinks while pressed. */
  scaleTo?: number;
  children: ReactNode;
};

/**
 * Press feedback for buttons, chips and tiles: shrinks on press-in (so it responds
 * on touch-down, not release) and springs back with a little bounce.
 */
export function PressableScale({ containerStyle, style, scaleTo = 0.95, children, ...rest }: PressableScaleProps) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Pressable
      {...rest}
      pressRetentionOffset={16}
      onPressIn={(e) => {
        if (!reduced && !rest.disabled) scale.set(withSpring(scaleTo, SpringBouncy));
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, SpringBouncy));
        rest.onPressOut?.(e);
      }}
      style={containerStyle}>
      <Animated.View style={[style, animated]}>{children}</Animated.View>
    </Pressable>
  );
}
