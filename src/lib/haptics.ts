import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * One haptic per user action, fired with the visual it belongs to.
 * Never the only feedback: many users have haptics off. Web has none.
 */
const enabled = Platform.OS !== 'web';

/** A segmented control or picker moved to a new value. */
export function hapticSelection() {
  if (enabled) Haptics.selectionAsync();
}

/** A destructive action committed (a row swiped away, an expense deleted). */
export function hapticDelete() {
  if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** An expense was saved. */
export function hapticSuccess() {
  if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}
