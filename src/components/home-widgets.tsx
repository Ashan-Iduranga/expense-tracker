import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Icon } from '@/components/icon';
import { BlockMeter, CountUp, ProgressBar } from '@/components/motion';
import { PressableScale } from '@/components/pressable-scale';
import { Txt } from '@/components/txt';
import { displayType, Fonts, Gutter, Radius } from '@/constants/theme';
import { ExpenseCategories, type ExpenseCategory } from '@/data/categories';
import { useColors } from '@/hooks/use-colors';
import { formatK, formatMoney } from '@/lib/format';
import type { Hero } from '@/lib/stats';

/* ---------- Hero card ---------- */

/** Black card: the month's total in lime, the block meter, and three quick stats. */
export function HeroCard({ h, currency, word, onCommitted }: { h: Hero; currency: string; word: string; onCommitted?: () => void }) {
  const c = useColors();
  const net = h.mode === 'net';
  const over = h.budget > 0 && h.pct > 1;
  // Over only because of what's set aside: spending alone is still inside the budget.
  const overSpent = h.budget > 0 && h.spent > h.budget;
  return (
    <View style={[styles.hero, { backgroundColor: c.hero }]}>
      <View style={styles.glow} pointerEvents="none">
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="heroGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={c.lime} stopOpacity="0.32" />
              <Stop offset="1" stopColor={c.lime} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#heroGlow)" />
        </Svg>
      </View>
      <View style={styles.heroTop}>
        <Txt variant="label" color={c.heroInk2}>
          {net ? `Net · ${h.month}` : `Spent · ${h.month}`}
        </Txt>
        {(net || h.budget > 0) && (
          <View style={[styles.heroPill, { backgroundColor: over ? '#FF6B5E' : c.lime }]}>
            <Txt variant="smallBold" color={over ? '#1F0402' : c.inkFixed}>
              {net ? `Kept ${Math.round(h.kept * 100)}%` : `${Math.round(h.pct * 100)}%`}
            </Txt>
          </View>
        )}
      </View>
      <CountUp value={net ? h.net : h.spent} currency={currency} variant="display" color={c.lime} style={styles.heroNum} />
      {h.budget > 0 && <BlockMeter value={h.pct} on={over ? '#FF6B5E' : c.lime} off={c.heroOff} label={`${Math.round(h.pct * 100)}% of monthly budget used or set aside`} />}
      <View style={styles.stats}>
        {net ? (
          <>
            <Stat label={word} icon="down" value={formatMoney(h.income, currency)} sub={h.incomeCount > 1 ? `${h.incomeCount} times` : undefined} grow={1.2} />
            <Stat label="Spent" icon="up" value={formatMoney(h.spent, currency)} grow={1.2} />
          </>
        ) : (
          <>
            <Stat label="Left" value={h.budget ? formatMoney(Math.max(0, h.left), currency) : '—'} grow={1.3} />
            <Stat label="Per day" value={h.budget ? formatMoney(h.perDay, currency) : '—'} grow={1.2} />
            <Stat label="Days" value={String(h.daysLeft)} grow={0.55} />
          </>
        )}
      </View>
      {h.committed > 0 && h.budget > 0 && (
        <PressableScale
          role="link"
          aria-label={`${formatMoney(h.committed, currency)} set aside for bills, loans and plans. Open Plan`}
          onPress={onCommitted}
          disabled={!onCommitted}
          style={[styles.aside, { backgroundColor: c.heroTile }]}>
          <Icon name="calendar" size={16} color={c.lime} />
          <Txt variant="small" color={c.heroInk} style={{ flex: 1 }} numberOfLines={1}>
            <Txt variant="smallBold" color={c.heroInk}>
              {formatMoney(h.committed, currency)}
            </Txt>{' '}
            set aside for bills, loans & plans
          </Txt>
          {onCommitted && <Icon name="right" size={16} color={c.heroInk2} />}
        </PressableScale>
      )}
      {over && (
        <View style={styles.warn}>
          <Icon name="alert" size={16} color="#FF8A7E" />
          <Txt variant="smallBold" color="#FF8A7E" style={{ flex: 1 }}>
            {overSpent
              ? `${formatMoney(h.spent - h.budget, currency)} over budget`
              : `${formatMoney(-h.left, currency)} short once everything set aside is paid`}
          </Txt>
        </View>
      )}
    </View>
  );
}

function Stat({ label, value, icon, grow, sub }: { label: string; value: string; icon?: 'up' | 'down'; grow: number; sub?: string }) {
  const c = useColors();
  return (
    <View style={[styles.stat, { backgroundColor: c.heroTile, flexGrow: grow }]}>
      <View style={styles.statLabel}>
        {icon && <Icon name={icon} size={13} color={c.lime} />}
        <Txt variant="label" color={c.heroInk2} style={{ fontSize: 11 }}>
          {label}
        </Txt>
      </View>
      <Txt numberOfLines={1} color={c.heroInk} style={styles.statValue}>
        {value}
      </Txt>
      {!!sub && (
        <Txt variant="caption" color={c.heroInk2} numberOfLines={1}>
          {sub}
        </Txt>
      )}
    </View>
  );
}

/* ---------- Where it went: pills sized by share ---------- */

function GrowPill({ share, color, index }: { share: number; color: string; index: number }) {
  const reduced = useReducedMotion();
  const g = useSharedValue(reduced ? share : 0.001);
  useEffect(() => {
    g.set(reduced ? share : withDelay(200 + index * 70, withSpring(share, { damping: 14, stiffness: 140 })));
  }, [share, index, reduced, g]);
  const a = useAnimatedStyle(() => ({ flexGrow: g.get() }));
  return <Animated.View style={[styles.sharePill, { backgroundColor: color, flexBasis: 0 }, a]} />;
}

export function SpendPills({ items, month }: { items: { id: ExpenseCategory | 'other'; value: number; name: string }[]; month: string }) {
  const c = useColors();
  const total = items.reduce((a, e) => a + e.value, 0);
  if (!total) return null;
  const label = items.map((e) => `${e.name} ${Math.round((e.value / total) * 100)}%`).join(', ');
  return (
    <View style={[styles.tile, { backgroundColor: c.surface }]}>
      <View style={styles.tileHead}>
        <Txt variant="section">Where it went</Txt>
        <Txt variant="smallSemi" color="ink2">
          {month}
        </Txt>
      </View>
      <View style={styles.pillsRow} role="img" aria-label={label}>
        {items.map((e, i) => (
          <GrowPill key={e.id} index={i} share={e.value / total} color={c.cat[e.id]} />
        ))}
      </View>
      <View style={styles.legend}>
        {items.slice(0, 4).map((e) => (
          <View key={e.id} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: c.cat[e.id] }]} />
            <Txt variant="small" color="ink2" numberOfLines={1} style={{ flex: 1 }}>
              {e.name}
            </Txt>
            <Txt variant="smallBold">{Math.round((e.value / total) * 100)}%</Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ---------- Category budget chips ---------- */

export function BudgetStrip({
  items,
  currency,
  onPress,
}: {
  items: { id: ExpenseCategory; spent: number; limit: number }[];
  currency: string;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} style={styles.stripOuter}>
      {items.map((b) => {
        const info = ExpenseCategories[b.id];
        const p = b.spent / b.limit;
        const over = p > 1;
        const near = !over && p > 0.85;
        const color = c.cat[b.id];
        return (
          <PressableScale
            key={b.id}
            role="button"
            aria-label={`${info.name}: ${formatMoney(b.spent, currency)} of ${formatMoney(b.limit, currency)}${over ? ', over budget' : ''}`}
            onPress={onPress}
            style={[styles.bchip, { backgroundColor: c.surface }]}>
            <View style={styles.bchipTop}>
              <View style={[styles.bchipIc, { backgroundColor: color + '24' }]}>
                <Icon name={info.icon} size={18} color={color} />
              </View>
              {over ? (
                <View style={[styles.flag, { backgroundColor: c.negSoft }]}>
                  <Icon name="alert" size={13} color={c.neg} />
                  <Txt variant="caption" color={c.neg} style={{ fontFamily: Fonts.bold }}>
                    Over
                  </Txt>
                </View>
              ) : (
                <Txt variant="caption" color="ink2" style={{ fontFamily: Fonts.bold }}>
                  {Math.round(p * 100)}%
                </Txt>
              )}
            </View>
            <Txt variant="small" color="ink2" numberOfLines={1}>
              {info.name}
            </Txt>
            <View style={styles.bchipAmt}>
              <Txt variant="num">{formatMoney(b.spent, currency)}</Txt>
              <Txt variant="caption" color="ink3">
                {' '}
                / {formatK(b.limit)}
              </Txt>
            </View>
            <ProgressBar value={p} color={over ? c.neg : near ? c.warn : color} track={c.track} height={8} />
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 28, padding: 18, gap: 12, overflow: 'hidden' },
  glow: { position: 'absolute', right: -90, top: -100, width: 260, height: 260 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroPill: { paddingHorizontal: 11, paddingVertical: 4, borderRadius: 99 },
  heroNum: displayType(76),
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flexBasis: 0, minWidth: 0, gap: 3, paddingVertical: 10, paddingLeft: 12, paddingRight: 8, borderRadius: 16 },
  statLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue: displayType(22),
  warn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aside: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 12, borderRadius: 14 },
  tile: { borderRadius: 24, padding: 16, gap: 12 },
  tileHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  pillsRow: { flexDirection: 'row', gap: 5, height: 34 },
  sharePill: { minWidth: 14, borderRadius: 99 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, columnGap: 12 },
  legendItem: { width: '46%', flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  stripOuter: { marginHorizontal: -Gutter },
  strip: { paddingHorizontal: Gutter, gap: 10, paddingBottom: 4 },
  bchip: { width: 156, padding: 14, gap: 8, borderRadius: 22 },
  bchipTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bchipIc: { width: 34, height: 34, borderRadius: Radius.icon - 3, alignItems: 'center', justifyContent: 'center' },
  flag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99 },
  bchipAmt: { flexDirection: 'row', alignItems: 'baseline' },
});
