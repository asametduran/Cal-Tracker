import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { progressFraction } from '@/lib/nutrition';
import { colors, radius, shadow } from '@/theme';

import { Icon } from './Icon';
import { CountUp } from './Reward';
import { Ring } from './Ring';

type Props = {
  eaten: number;
  goal: number;
  /** Rendered over the card (the "+N kcal" reward badge). */
  overlay?: ReactNode;
};

/** Hero card: calories eaten of the daily goal on the left, a big progress ring with a flame on the right. */
export function CalorieHero({ eaten, goal, overlay }: Props) {
  const reached = goal > 0 && eaten >= goal;
  const remaining = Math.round(goal - eaten);
  return (
    <View style={styles.card}>
      <View style={styles.text}>
        <View style={styles.numberRow}>
          <CountUp value={Math.round(eaten)} style={styles.eaten} />
          <Text style={styles.goal}>/{Math.round(goal)}</Text>
        </View>
        <Text style={styles.label}>Calories eaten</Text>
        <Text style={[styles.hint, reached && styles.hintReached]}>
          {reached ? 'Goal reached' : `${remaining} left today`}
        </Text>
      </View>
      <Ring progress={progressFraction(eaten, goal)} color={reached ? colors.success : colors.calories} size={104} stroke={9}>
        <Icon name="flame" size={30} color={reached ? colors.success : colors.streak} filled />
      </Ring>
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 20,
    marginBottom: 12,
    ...shadow.card,
  },
  text: { flex: 1, paddingRight: 12 },
  numberRow: { flexDirection: 'row', alignItems: 'baseline' },
  eaten: { color: colors.text, fontSize: 44, fontWeight: '800', letterSpacing: -1.5 },
  goal: { color: colors.muted, fontSize: 20, fontWeight: '600', marginLeft: 2 },
  label: { color: colors.muted, fontSize: 14, marginTop: 2 },
  hint: { color: colors.text, fontSize: 13, fontWeight: '600', marginTop: 8 },
  hintReached: { color: colors.success },
});
