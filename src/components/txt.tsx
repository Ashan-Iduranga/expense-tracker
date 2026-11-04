import { StyleSheet, Text, type TextProps } from 'react-native';

import { displayType, Fonts, type Palette } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';

type ColorKey = { [K in keyof Palette]: Palette[K] extends string ? K : never }[keyof Palette];

export type TxtProps = TextProps & {
  variant?: keyof typeof styles;
  /** A palette key ('ink2', 'accentInk'…) or a literal colour. Defaults to 'ink'. */
  color?: ColorKey | (string & {});
};

/** All text in the app: Bebas Neue for numbers and titles, Barlow for everything you read. */
export function Txt({ variant = 'body', color = 'ink', style, ...rest }: TxtProps) {
  const c = useColors();
  const resolved = color in c ? (c[color as ColorKey] as string) : color;
  return <Text maxFontSizeMultiplier={Big.has(variant) ? 1.15 : 1.3} {...rest} style={[styles[variant], { color: resolved }, style]} />;
}

/**
 * Text still follows the phone's font size, but only so far: large display sizes on top of
 * a big system font pushed buttons off-screen and made short pages scroll.
 */
const Big = new Set<string>(['display', 'title', 'name', 'num']);

const styles = StyleSheet.create({
  /** Big condensed numbers. */
  display: displayType(64),
  /** Screen titles: "HISTORY". */
  title: { ...displayType(48), textTransform: 'uppercase' },
  /** The greeting name and setup headings. */
  name: { ...displayType(38), textTransform: 'uppercase' },
  /** Condensed numbers inside tiles. */
  num: displayType(24),
  /** Section headings: "CATEGORY BUDGETS". */
  section: { fontFamily: Fonts.bold, fontSize: 14, lineHeight: 18, letterSpacing: 0.6, textTransform: 'uppercase' },
  /** Small uppercase labels: "SPENT · NOVEMBER". */
  label: { fontFamily: Fonts.bold, fontSize: 12, lineHeight: 15, letterSpacing: 1, textTransform: 'uppercase' },
  body: { fontFamily: Fonts.regular, fontSize: 16, lineHeight: 22 },
  bodyMedium: { fontFamily: Fonts.medium, fontSize: 16, lineHeight: 22 },
  bodySemi: { fontFamily: Fonts.semiBold, fontSize: 16, lineHeight: 22 },
  bodyBold: { fontFamily: Fonts.bold, fontSize: 16, lineHeight: 22 },
  small: { fontFamily: Fonts.regular, fontSize: 13.5, lineHeight: 19 },
  smallSemi: { fontFamily: Fonts.semiBold, fontSize: 13.5, lineHeight: 19 },
  smallBold: { fontFamily: Fonts.bold, fontSize: 13.5, lineHeight: 19 },
  caption: { fontFamily: Fonts.medium, fontSize: 12, lineHeight: 16 },
  button: { fontFamily: Fonts.bold, fontSize: 15, lineHeight: 20, letterSpacing: 0.9, textTransform: 'uppercase' },
});
