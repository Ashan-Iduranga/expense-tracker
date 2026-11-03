import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { Dark, Light, type Palette } from '@/constants/theme';
import { useAccount } from '@/data/account';

/** The active palette: the user's choice in Settings, or the phone's setting on Auto. */
export function useColors(): Palette {
  const scheme = useColorScheme();
  const { profile } = useAccount();
  const pref = profile?.theme ?? 'system';
  const dark = pref === 'dark' || (pref === 'system' && scheme === 'dark');
  return dark ? Dark : Light;
}

/** Builds a stylesheet from the palette, once per palette. */
export function useThemedStyles<T>(factory: (c: Palette) => T): T {
  const c = useColors();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => factory(c), [c]);
}
