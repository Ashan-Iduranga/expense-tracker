import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Chip, PrimaryButton } from '@/components/controls';
import { FieldLabel, FormError, formStyles, MoneyField } from '@/components/form';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/txt';
import { displayType, Radius } from '@/constants/theme';
import { MaxAmount } from '@/data/account';
import { useGoals } from '@/data/goals';
import { useMonth } from '@/data/month';
import { useToast } from '@/data/toast';
import { useColors } from '@/hooks/use-colors';
import { useProfile } from '@/hooks/use-profile';
import { formatMoney } from '@/lib/format';
import { hapticSuccess } from '@/lib/haptics';

/** The "General savings" choice: a goal with this name, made the first time it's used. */
const SavingsName = 'Savings';
const General = 'general';

/** Asks what happens to this month's income above the budget: spend it, save it, or split it. */
export function SurplusSheet({ visible, amount, onClose }: { visible: boolean; amount: number; onClose: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Extra this month">
      {visible && amount > 0 && <SurplusForm amount={amount} onDone={onClose} />}
    </Sheet>
  );
}

function SurplusForm({ amount, onDone }: { amount: number; onDone: () => void }) {
  const c = useColors();
  const { profile: p, status: st } = useProfile();
  const { goals, addGoal, addToGoal } = useGoals();
  const { assign } = useMonth();
  const { showToast } = useToast();
  const cur = p.currency;
  const open = goals.filter((g) => g.saved < g.target);
  const [save, setSave] = useState(String(amount));
  const [dest, setDest] = useState<string>(open[0]?.id ?? goals.find((g) => g.name === SavingsName)?.id ?? General);

  const saveValue = Math.min(amount, Number(save) || 0);
  const spendValue = amount - saveValue;
  const half = Math.round(amount / 2);
  const tooMuch = (Number(save) || 0) > amount;

  function confirm() {
    if (tooMuch) return;
    assign(spendValue, saveValue);
    let where = '';
    if (saveValue > 0) {
      const general = goals.find((g) => g.name === SavingsName);
      const goal = dest === General ? general : goals.find((g) => g.id === dest);
      if (goal) {
        addToGoal(goal.id, saveValue);
        where = goal.name;
      } else {
        // A year of saving this much makes a sensible first target for the general pot.
        addGoal({ name: SavingsName, icon: 'shield', target: Math.min(MaxAmount, saveValue * 12), saved: saveValue });
        where = SavingsName;
      }
    }
    hapticSuccess();
    showToast(
      saveValue && spendValue
        ? `Saved ${formatMoney(saveValue, cur)} to ${where}, ${formatMoney(spendValue, cur)} added to spend`
        : saveValue
          ? `Saved ${formatMoney(saveValue, cur)} to ${where}`
          : `${formatMoney(spendValue, cur)} added to this month’s budget`
    );
    onDone();
  }

  return (
    <>
      <View style={[styles.head, { backgroundColor: c.accentSoft }]}>
        <Txt variant="small" color={c.accentInk}>
          Your {st.word.toLowerCase()} this month is more than your {formatMoney(p.monthlyBudget ?? 0, cur)} budget by
        </Txt>
        <Txt style={displayType(40)} color={c.accentInk}>
          {formatMoney(amount, cur)}
        </Txt>
        <Txt variant="caption" color={c.accentInk}>
          What should happen to it?
        </Txt>
      </View>

      <View style={formStyles.chips}>
        <Chip label="Save it all" selected={saveValue === amount} onPress={() => setSave(String(amount))} />
        <Chip label="Half and half" selected={saveValue === half && amount > 1} onPress={() => setSave(String(half))} />
        <Chip label="Spend it all" selected={saveValue === 0} onPress={() => setSave('0')} />
      </View>

      <FieldLabel>Amount to save</FieldLabel>
      <MoneyField value={save} onChange={setSave} currency={cur} label="Amount to save" />
      {tooMuch ? (
        <FormError>{`That’s more than the ${formatMoney(amount, cur)} extra.`}</FormError>
      ) : (
        <Txt variant="caption" color="ink2">
          {spendValue > 0 ? `${formatMoney(spendValue, cur)} gets added to this month’s budget to spend.` : 'Nothing gets added to your spending budget.'}
        </Txt>
      )}

      {saveValue > 0 && (
        <>
          <FieldLabel>Save it to</FieldLabel>
          <View style={formStyles.chips}>
            {open.map((g) => (
              <Chip key={g.id} role="radio" icon={g.icon} label={g.name} selected={dest === g.id} onPress={() => setDest(g.id)} />
            ))}
            {!open.some((g) => g.name === SavingsName) && (
              <Chip role="radio" icon="shield" label="General savings" selected={dest === General} onPress={() => setDest(General)} />
            )}
          </View>
        </>
      )}

      <PrimaryButton
        label={saveValue && spendValue ? `Save ${formatMoney(saveValue, cur)} · spend ${formatMoney(spendValue, cur)}` : saveValue ? `Save ${formatMoney(saveValue, cur)}` : `Spend ${formatMoney(spendValue, cur)}`}
        disabled={tooMuch}
        onPress={confirm}
      />
    </>
  );
}

const styles = StyleSheet.create({
  head: { padding: 16, gap: 4, borderRadius: Radius.card - 4 },
});
