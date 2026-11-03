import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { Txt } from '@/components/txt';
import { ToastEnter, ToastExit } from '@/constants/motion';
import { MaxContentWidth, NavHeight } from '@/constants/theme';
import { useToast } from '@/data/toast';
import { useColors } from '@/hooks/use-colors';

/** The one toast, floating above the nav. Announced politely to screen readers. */
export function ToastView({ aboveNav = true }: { aboveNav?: boolean }) {
  const { toast, hideToast } = useToast();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const bottom = (aboveNav ? NavHeight : 0) + Math.max(16, insets.bottom) + 12;

  return (
    <View pointerEvents="box-none" style={[styles.overlay, { bottom }]}>
      {toast && (
        <Animated.View key={toast.id} entering={ToastEnter} exiting={ToastExit} aria-live="polite" style={[styles.toast, { backgroundColor: c.toast }]}>
          <Icon name={toast.icon} size={18} color={c.toastAccent} />
          <Txt variant="smallSemi" color={c.toastInk} style={styles.text} numberOfLines={1}>
            {toast.text}
          </Txt>
          {toast.undo && (
            <Pressable
              role="button"
              hitSlop={8}
              onPress={() => {
                const undo = toast.undo;
                hideToast();
                undo?.();
              }}
              style={styles.undo}>
              <Txt variant="smallBold" color={c.toastAccent}>
                Undo
              </Txt>
            </Pressable>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: {
    width: '100%',
    maxWidth: MaxContentWidth,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  text: { flex: 1, fontSize: 14.5 },
  undo: { minHeight: 40, paddingHorizontal: 14, justifyContent: 'center' },
});
