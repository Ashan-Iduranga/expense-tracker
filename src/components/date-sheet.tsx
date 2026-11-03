import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { IconButton, PrimaryButton } from '@/components/controls';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/txt';
import { displayType, Fonts } from '@/constants/theme';
import { useColors } from '@/hooks/use-colors';
import { MonthNames, sameDay, startOfDay } from '@/lib/format';
import { hapticSelection } from '@/lib/haptics';

const Weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * A month calendar. By default only days up to today can be picked (for logging spends);
 * `allowFuture` opens it up for due dates and trip dates. Used inline inside other sheets,
 * so a picker never has to open a second modal on top of one.
 */
export function Calendar({ value, onChange, allowFuture = false }: { value: Date; onChange: (d: Date) => void; allowFuture?: boolean }) {
  const c = useColors();
  const today = startOfDay(new Date());
  const [month, setMonth] = useState(new Date(value.getFullYear(), value.getMonth(), 1));
  const picked = startOfDay(value);

  const first = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array.from({ length: first }, () => null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  while (cells.length % 7) cells.push(null);
  const atCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();

  return (
    <View>
      <View style={styles.monthRow}>
        <IconButton icon="back" label="Previous month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} />
        <Txt variant="name" style={displayType(28)} aria-live="polite">
          {MonthNames[month.getMonth()]} {month.getFullYear()}
        </Txt>
        {atCurrentMonth && !allowFuture ? (
          <View style={{ width: 44 }} />
        ) : (
          <IconButton icon="right" label="Next month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
        )}
      </View>
      <View style={styles.grid}>
        {Weekdays.map((d, i) => (
          <Txt key={i} variant="caption" color="ink3" style={styles.weekday}>
            {d}
          </Txt>
        ))}
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={styles.cell} />;
          const blocked = !allowFuture && d > today;
          const on = sameDay(d, picked);
          const isToday = sameDay(d, today);
          return (
            <Pressable
              key={i}
              role="button"
              aria-label={`${d.getDate()} ${MonthNames[d.getMonth()]}${isToday ? ', today' : ''}`}
              aria-selected={on}
              disabled={blocked}
              onPress={() => {
                hapticSelection();
                onChange(d);
              }}
              style={styles.cell}>
              <View style={[styles.day, on && { backgroundColor: c.lime }, !on && isToday && { borderWidth: 1.5, borderColor: c.ink }]}>
                <Txt style={{ fontFamily: on ? Fonts.bold : Fonts.medium, fontSize: 15 }} color={on ? c.inkFixed : blocked ? c.line2 : c.ink}>
                  {d.getDate()}
                </Txt>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A month calendar for picking any day up to today. Works the same on iOS, Android and web. */
export function DateSheet({ visible, value, onClose, onPick }: { visible: boolean; value: Date; onClose: () => void; onPick: (d: Date) => void }) {
  const [picked, setPicked] = useState(startOfDay(value));
  return (
    <Sheet visible={visible} onClose={onClose} title="Pick a date">
      <Calendar value={picked} onChange={setPicked} />
      <PrimaryButton
        label="Use this date"
        onPress={() => {
          onPick(picked);
          onClose();
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', paddingVertical: 6 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
  day: { flex: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
