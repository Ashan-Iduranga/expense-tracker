/**
 * Motion tokens for the Volt direction: quick, springy, expressive.
 * Springs for anything that moves or responds to touch; timing curves only for fades.
 * Every animated component also checks useReducedMotion() and skips the movement.
 */
import { Easing, FadeIn, FadeInDown, FadeOut, FadeOutDown, LinearTransition } from 'react-native-reanimated';

/** Strong ease-out for things arriving. */
export const EaseOut = Easing.bezier(0.23, 1, 0.32, 1);
/** For things moving across the screen. */
export const EaseInOut = Easing.bezier(0.77, 0, 0.175, 1);
/** Slight overshoot, the prototype's cubic-bezier(.34, 1.56, .64, 1). */
export const EaseSpring = Easing.bezier(0.34, 1.56, 0.64, 1);

/** Critically damped: settles without bounce. Nav pill, sheets, swipes. */
export const SpringSettle = { damping: 22, stiffness: 240, mass: 1 } as const;
/** A little bounce: chips, the + button, selected keys. */
export const SpringBouncy = { damping: 12, stiffness: 260, mass: 0.8 } as const;
/** Bars and rings growing to their value. */
export const SpringGrow = { damping: 16, stiffness: 120, mass: 1 } as const;

/** Count-up length for totals (Magic UI "Number Ticker" feel). */
export const CountMs = 750;
/** Delay between items of a staggered list. */
export const StaggerMs = 40;

/** Screen sections popping up on focus: rise + slight scale, staggered by index. */
export function enterAt(index: number) {
  return FadeInDown.springify().damping(14).stiffness(170).delay(Math.min(index, 8) * StaggerMs);
}

export const RowEnter = FadeIn.duration(200).easing(EaseOut);
export const RowExit = FadeOut.duration(150).easing(EaseOut);
/** Rows sliding into the gap a removed row left. */
export const ListReflow = LinearTransition.springify().damping(20).stiffness(220);
/** Exits faster than it enters: the user has already read it. */
export const ToastEnter = FadeInDown.springify().damping(15).stiffness(220);
export const ToastExit = FadeOutDown.duration(200).easing(EaseOut);
