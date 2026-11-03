/**
 * "Volt" — lime on ink, tall condensed numbers, bouncy controls.
 * Two palettes with the same keys; components read the active one through useColors().
 */

const shared = {
  /** The brand lime. Always paired with ink text, in both themes. */
  lime: '#C6F432',
  /** Ink that stays dark in both themes (text on lime, the nav pill). */
  inkFixed: '#0E0F0C',
  white: '#FFFFFF',
};

export const Light = {
  ...shared,
  bg: '#F3F5EC',
  surface: '#FFFFFF',
  surface2: '#E9EDDF',
  line: '#E0E5D3',
  line2: '#C7CEB6',
  ink: '#0E0F0C',
  ink2: '#4B5043',
  ink3: '#5D6353',
  /** Primary buttons: black with lime text in light, lime with black text in dark. */
  accent: '#0E0F0C',
  onAccent: '#D8FF3E',
  accentSoft: '#E7F8B0',
  accentInk: '#3D4F00',
  pos: '#4D8A00',
  posInk: '#3F7400',
  neg: '#D93025',
  onNeg: '#FFFFFF',
  negSoft: '#FCE3E0',
  warn: '#E09A00',
  warnInk: '#8A5B00',
  track: '#E6EADB',
  chipOn: '#C6F432',
  chipOnInk: '#0E0F0C',
  scrim: 'rgba(14, 15, 12, 0.5)',
  sheet: '#F3F5EC',
  key: '#FFFFFF',
  keyPress: '#C6F432',
  toast: '#0E0F0C',
  toastInk: '#F3F5EC',
  toastAccent: '#C6F432',
  bar: '#0E0F0C',
  barHi: '#FF5A36',
  barSel: '#7FA600',
  forecast: '#C6F432',
  forecastInk: '#0E0F0C',
  forecastInk2: '#2F3A06',
  hero: '#0E0F0C',
  heroInk: '#F3F5EC',
  heroInk2: '#9EA390',
  heroOff: '#2A2D22',
  heroTile: 'rgba(255, 255, 255, 0.07)',
  obTitle: '#0E0F0C',
  obBody: '#1B2006',
  obGlow: 0.95,
  obButton: '#0E0F0C',
  obButtonInk: '#C6F432',
  cat: {
    food: '#E8650A',
    transport: '#2E6BF0',
    study: '#7A4DE8',
    bills: '#B58500',
    shopping: '#E63E7E',
    fun: '#00968A',
    health: '#E03C3C',
    other: '#777C6D',
    income: '#4D8A00',
  },
  onCat: '#FFFFFF',
  statusBar: 'dark' as 'dark' | 'light',
};

export type Palette = typeof Light;

export const Dark: Palette = {
  ...shared,
  bg: '#0B0C09',
  surface: '#15170F',
  surface2: '#1D2016',
  line: '#23261B',
  line2: '#343829',
  ink: '#F1F4E6',
  ink2: '#B4B9A4',
  ink3: '#8D9380',
  accent: '#C6F432',
  onAccent: '#0E0F0C',
  accentSoft: '#263208',
  accentInk: '#D8FF3E',
  pos: '#A6E22E',
  posInk: '#B8EC4A',
  neg: '#FF6B5E',
  onNeg: '#1F0402',
  negSoft: '#3A1512',
  warn: '#FFB627',
  warnInk: '#FFC75A',
  track: '#23261B',
  chipOn: '#C6F432',
  chipOnInk: '#0E0F0C',
  scrim: 'rgba(0, 0, 0, 0.65)',
  sheet: '#101209',
  key: '#1A1C13',
  keyPress: '#C6F432',
  toast: '#C6F432',
  toastInk: '#0E0F0C',
  toastAccent: '#0E0F0C',
  bar: '#C6F432',
  barHi: '#FF6B5E',
  barSel: '#F1F4E6',
  forecast: '#C6F432',
  forecastInk: '#0E0F0C',
  forecastInk2: '#2F3A06',
  hero: '#17190F',
  heroInk: '#F1F4E6',
  heroInk2: '#A9AE9A',
  heroOff: '#2B2F20',
  heroTile: 'rgba(255, 255, 255, 0.07)',
  obTitle: '#F1F4E6',
  obBody: '#C9CEB8',
  obGlow: 0.3,
  obButton: '#C6F432',
  obButtonInk: '#0E0F0C',
  cat: {
    food: '#FF8A3D',
    transport: '#5C8DFF',
    study: '#A07BFF',
    bills: '#FFC233',
    shopping: '#FF5C99',
    fun: '#1FD1C0',
    health: '#FF6B5E',
    other: '#9A9F8E',
    income: '#A6E22E',
  },
  onCat: '#0E0F0C',
  statusBar: 'light',
};

/** Font family names, as registered by useFonts in the root layout. */
export const Fonts = {
  display: 'BebasNeue_400Regular',
  regular: 'Barlow_400Regular',
  medium: 'Barlow_500Medium',
  semiBold: 'Barlow_600SemiBold',
  bold: 'Barlow_700Bold',
} as const;

/**
 * Bebas Neue at a given size, with a line height iOS won't clip.
 *
 * The font's natural line is 1.2em (ascent 0.9em, descent 0.3em). When lineHeight is
 * smaller, iOS keeps the descent and takes the cut from the top, so caps lose their tops
 * (this sliced "SAVE." and "RS 0"). Below ~1.02em the caps (0.7em + overshoot) start
 * clipping; 1.12em leaves margin. For tighter stacking, use negative margins, not
 * lineHeight: margins move boxes without clipping glyphs.
 */
export function displayType(size: number) {
  return { fontFamily: Fonts.display, fontSize: size, lineHeight: Math.ceil(size * 1.12), includeFontPadding: false } as const;
}

export const Radius = {
  card: 26,
  row: 20,
  icon: 14,
  key: 18,
  sheet: 32,
  pill: 999,
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Side padding of every screen. */
export const Gutter = 20;
export const MaxContentWidth = 560;
/** Height the floating nav takes at the bottom, before the safe-area inset. */
export const NavHeight = 82;
