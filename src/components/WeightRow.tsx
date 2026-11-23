import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { WeightEntry } from '@/data';
import { colors, radius, shadow } from '@/theme';

import { Icon } from './Icon';

type Props = {
  entry: WeightEntry;
  onPress: (entry: WeightEntry) => void;
};

/** A weigh-in shown among the day's logged meals. Tap to edit or delete. */
export function WeightRow({ entry, onPress }: Props) {
  const time = new Date(entry.loggedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open weight ${entry.kg} kilograms`}
      onPress={() => onPress(entry)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.icon}>
        <Icon name="scale" size={26} color={colors.weight} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>Weight</Text>
        <Text style={styles.sub}>{time}</Text>
      </View>
      <Text style={styles.value}>{entry.kg} kg</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 10,
    ...shadow.card,
  },
  pressed: { opacity: 0.8 },
  icon: { width: 76, height: 76, borderRadius: 12, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, marginLeft: 12 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600' },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  value: { color: colors.text, fontSize: 18, fontWeight: '700', marginRight: 8 },
});
