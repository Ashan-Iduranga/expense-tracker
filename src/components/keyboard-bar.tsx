import { KeyboardToolbar } from 'react-native-keyboard-controller';

import { useColors } from '@/hooks/use-colors';

/**
 * Bar above the keyboard with previous/next and Done. The number pad has no return key,
 * so Done is the way to close it. Uses the app's own palette, which follows the theme
 * chosen in Settings rather than the system one, so both keys get the same colours.
 */
export function KeyboardBar() {
  const c = useColors();
  const t = { primary: c.ink, disabled: c.ink3, background: c.surface, ripple: c.surface2 };
  return (
    <KeyboardToolbar theme={{ light: t, dark: t }}>
      <KeyboardToolbar.Prev />
      <KeyboardToolbar.Next />
      <KeyboardToolbar.Done text="Done" />
    </KeyboardToolbar>
  );
}
