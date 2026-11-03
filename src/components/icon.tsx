import Svg, { Circle, Path, Rect } from 'react-native-svg';

type Shape =
  | { d: string }
  | { c: [number, number, number] }
  | { r: [number, number, number, number, number] };

const p = (d: string): Shape => ({ d });
const circle = (cx: number, cy: number, r: number): Shape => ({ c: [cx, cy, r] });
const rect = (x: number, y: number, w: number, h: number, rx: number): Shape => ({ r: [x, y, w, h, rx] });

/** Stroke icons on a 24×24 grid, one visual language across the app. */
const Shapes = {
  home: [p('M3 10.5 12 3l9 7.5'), p('M5 9.5V20h14V9.5'), p('M10 20v-6h4v6')],
  list: [p('M9 6h11M9 12h11M9 18h11'), circle(4.5, 6, 1), circle(4.5, 12, 1), circle(4.5, 18, 1)],
  plus: [p('M12 5v14M5 12h14')],
  target: [circle(12, 12, 9), circle(12, 12, 5), circle(12, 12, 1.2)],
  chart: [p('M4 20V11M10 20V5M16 20v-6M3 20h18')],
  search: [circle(11, 11, 7), p('m20 20-3.6-3.6')],
  close: [p('M6 6l12 12M18 6 6 18')],
  back: [p('m15 18-6-6 6-6')],
  right: [p('m9 18 6-6-6-6')],
  down: [p('M12 5v14M6 13l6 6 6-6')],
  up: [p('M12 19V5M6 11l6-6 6 6')],
  trash: [p('M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3')],
  food: [p('M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10'), p('M17 3c-2 0-3 2-3 5s1 4 3 4v9')],
  transport: [rect(4, 3, 16, 14, 3), p('M4 11h16M8 17v3M16 17v3'), p('M8 14h.01M16 14h.01')],
  bills: [p('M13 2 4 14h7l-1 8 9-12h-7z')],
  shopping: [p('M5 8h14l-1 12H6z'), p('M9 8V6a3 3 0 0 1 6 0v2')],
  study: [p('M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z'), p('M20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z')],
  health: [p('M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z')],
  fun: [rect(3, 4, 18, 16, 2), p('M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4')],
  other: [p('M5 12h.01M12 12h.01M19 12h.01')],
  wallet: [p('M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1z'), p('M4 7l11-3v3'), p('M16 13.5h.01')],
  briefcase: [rect(3, 7, 18, 13, 2), p('M9 7V5h6v2M3 13h18')],
  laptop: [rect(5, 5, 14, 10, 1.5), p('M3 19h18')],
  gift: [rect(4, 10, 16, 10, 1), p('M3 7h18v3H3zM12 7v13'), p('M12 7C10 3 6.5 4 7.5 6.5 8 7 12 7 12 7s4 0 4.5-.5C17.5 4 14 3 12 7z')],
  sparkle: [p('M12 3c.6 4.6 3.4 7.4 8 8-4.6.6-7.4 3.4-8 8-.6-4.6-3.4-7.4-8-8 4.6-.6 7.4-3.4 8-8z')],
  check: [p('m5 12.5 4.5 4.5L19 7.5')],
  alert: [p('M12 3.5 2.5 20h19z'), p('M12 10v4.5M12 17.2v.1')],
  sun: [circle(12, 12, 4), p('M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4')],
  moon: [p('M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z')],
  calendar: [rect(3, 5, 18, 16, 2), p('M3 10h18M8 3v4M16 3v4')],
  user: [circle(12, 8, 4), p('M4 21a8 8 0 0 1 16 0')],
  cap: [p('M2 9l10-5 10 5-10 5z'), p('M6 11v5c3 2 9 2 12 0v-5M22 9v5')],
  mountain: [p('M3 20 10 8l4 6 2-3 5 9z'), circle(17, 6, 1.6)],
  shield: [p('M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z'), p('m9 12 2 2 4-4')],
  phone: [rect(7, 2.5, 10, 19, 2), p('M11 18h2')],
  download: [p('M12 4v11M7 10l5 5 5-5M5 20h14')],
  globe: [circle(12, 12, 9), p('M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18')],
  bell: [p('M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z'), p('M10 21h4')],
  edit: [p('M4 20h4L19 9l-4-4L4 16z')],
  flag: [p('M5 21V4h11l-2 4 2 4H5')],
  backspace: [p('M9 5h11v14H9l-6-7z'), p('m12 9 5 6M17 9l-5 6')],
  bolt: [p('M13 2 4 14h7l-1 8 9-12h-7z')],
  repeat: [p('M17 2l3 3-3 3'), p('M4 11V9a4 4 0 0 1 4-4h12'), p('M7 22l-3-3 3-3'), p('M20 13v2a4 4 0 0 1-4 4H4')],
  users: [circle(9, 8, 3.5), p('M2.5 20a6.5 6.5 0 0 1 13 0'), p('M16 4.5a3.5 3.5 0 0 1 0 7M18 14.2a6.5 6.5 0 0 1 3.5 5.8')],
  cart: [p('M3 4h2.5l2.2 11h10.6L20.5 7H6.6'), circle(9.5, 19.5, 1.4), circle(17, 19.5, 1.4)],
  map: [p('M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z'), p('M9 4v13.5M15 6.5V20')],
  minus: [p('M5 12h14')],
  handshake: [p('M3 12l4-4 3 2 3-3 3 1 5 4'), p('M7 14l3 3c.8.8 2 .8 2.8 0L18 12'), p('M10 13.5l2 2M12.5 11.5l2 2')],
} as const satisfies Record<string, readonly Shape[]>;

export type IconName = keyof typeof Shapes;

type IconProps = {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
};

export function Icon({ name, size = 22, color, strokeWidth = 1.9 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden>
      {(Shapes[name] as readonly Shape[]).map((s, i) =>
        'd' in s ? (
          <Path key={i} d={s.d} />
        ) : 'c' in s ? (
          <Circle key={i} cx={s.c[0]} cy={s.c[1]} r={s.c[2]} />
        ) : (
          <Rect key={i} x={s.r[0]} y={s.r[1]} width={s.r[2]} height={s.r[3]} rx={s.r[4]} />
        )
      )}
    </Svg>
  );
}
