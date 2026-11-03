import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/controls';
import { DateField, FieldLabel, FormError, MoneyField, TextField } from '@/components/form';
import { Icon } from '@/components/icon';
import { Sheet } from '@/components/sheet';
import { MaxAmount } from '@/data/account';
import { PlanIcons, usePlans, type Plan } from '@/data/plans';
import { useToast } from '@/data/toast';
import { useColors } from '@/hooks/use-colors';
import { addDays, formatMoney, startOfDay } from '@/lib/format';
import { hapticSuccess } from '@/lib/haptics';

/** New plan, or edit one: name, budget, icon and dates. */
export function PlanEditor({ plan, visible, currency, onClose, onCreated }: { plan?: Plan; visible: boolean; currency: string; onClose: () => void; onCreated?: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={plan ? 'Edit plan' : 'New plan'}>
      {visible && <PlanForm plan={plan} currency={currency} onDone={() => { onClose(); if (!plan) onCreated?.(); }} />}
    </Sheet>
  );
}

function PlanForm({ plan, currency, onDone }: { plan?: Plan; currency: string; onDone: () => void }) {
  const c = useColors();
  const { addPlan, updatePlan } = usePlans();
  const { showToast } = useToast();
  const [name, setName] = useState(plan?.name ?? '');
  const [budget, setBudget] = useState(plan ? String(plan.budget) : '');
  const [icon, setIcon] = useState(plan?.icon ?? PlanIcons[0]);
  const [start, setStart] = useState<Date>(plan?.start ?? startOfDay(new Date()));
  const [end, setEnd] = useState<Date | null>(plan?.end ?? addDays(startOfDay(new Date()), 3));
  const [error, setError] = useState('');

  function save() {
    const b = Number(budget);
    if (!name.trim()) return setError('Name it, like “Trip to Ella”.');
    if (!(b > 0 && b <= MaxAmount)) return setError('Set how much you plan to spend.');
    if (end && end < start) return setError('The end date is before the start.');
    const next = { name: name.trim(), budget: b, icon, start, end };
    if (plan) updatePlan(plan.id, next);
    else addPlan(next);
    hapticSuccess();
    showToast(plan ? 'Plan saved' : `${next.name} · ${formatMoney(b, currency)} to spend`);
    onDone();
  }

  return (
    <>
      <FieldLabel>What’s it for?</FieldLabel>
      <TextField value={name} onChangeText={(t) => { setName(t); setError(''); }} maxLength={40} placeholder="e.g. Trip to Ella" aria-label="Plan name" />
      <FieldLabel>Budget</FieldLabel>
      <MoneyField value={budget} onChange={(v) => { setBudget(v); setError(''); }} currency={currency} label="Budget" />
      <FieldLabel>Icon</FieldLabel>
      <View style={styles.icons} role="radiogroup" aria-label="Plan icon">
        {PlanIcons.map((n) => (
          <Pressable key={n} role="radio" aria-checked={icon === n} aria-label={n} onPress={() => setIcon(n)} style={[styles.icon, { backgroundColor: icon === n ? c.lime : c.surface2 }]}>
            <Icon name={n} size={20} color={icon === n ? c.inkFixed : c.ink2} />
          </Pressable>
        ))}
      </View>
      <FieldLabel>Starts</FieldLabel>
      <DateField value={start} onChange={(d) => d && setStart(d)} label="Start date" />
      <FieldLabel>Ends (optional)</FieldLabel>
      <DateField value={end} onChange={setEnd} label="End date" optional />
      <FormError>{error}</FormError>
      <PrimaryButton label={plan ? 'Save changes' : 'Create plan'} onPress={save} />
    </>
  );
}

const styles = StyleSheet.create({
  icons: { flexDirection: 'row', gap: 6 },
  icon: { flex: 1, aspectRatio: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
