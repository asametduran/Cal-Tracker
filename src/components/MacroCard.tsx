import { StyleSheet, Text, View } from 'react-native';

import { progressFraction } from '@/lib/nutrition';
import { colors, radius, shadow } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Ring } from './Ring';

type Props = {
  label: string;
  icon: IconName;
  /** Grams eaten so far. */
  value: number;
  /** Daily goal in grams. */
  goal: number;
  color: string;
};

/** One of the three equal-width macro cards: grams left, label, and a ring with the macro's icon. */
export function MacroCard({ label, icon, value, goal, color }: Props) {
  const left = Math.round(goal - value);
  const over = left < 0;
  return (
    <View style={styles.card} accessibilityLabel={`${label}: ${Math.round(value)} of ${Math.round(goal)} grams`}>
      <Text style={[styles.amount, over && styles.over]}>
        {Math.abs(left)}g
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label} {over ? 'over' : 'left'}
      </Text>
      <View style={styles.ring}>
        <Ring progress={progressFraction(value, goal)} color={over ? colors.danger : color} size={56} stroke={5}>
          <Icon name={icon} size={20} color={color} />
        </Ring>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center', ...shadow.card },
  amount: { color: colors.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  over: { color: colors.danger },
  label: { color: colors.muted, fontSize: 12, marginTop: 1 },
  ring: { marginTop: 12 },
});
