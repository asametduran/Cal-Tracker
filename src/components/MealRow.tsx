import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Meal } from '@/data';
import { colors, radius, shadow } from '@/theme';

import { Icon, type IconName } from './Icon';

type Props = {
  meal: Meal;
  onPress: (meal: Meal) => void;
};

function MacroPill({ icon, color, grams }: { icon: IconName; color: string; grams: number }) {
  return (
    <View style={styles.pill}>
      <Icon name={icon} size={11} color={color} />
      <Text style={styles.pillText}>{Math.round(grams)}g</Text>
    </View>
  );
}

/** Tappable meal card: photo, title, calories and compact P / C / F pills. Opens the meal to view, edit or delete. */
export function MealRow({ meal, onPress }: Props) {
  const time = new Date(meal.loggedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${meal.title}`}
      onPress={() => onPress(meal)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {meal.photoUri ? (
        <Image source={{ uri: meal.photoUri }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]}>
          <Icon name="pencil" size={22} color={colors.muted} />
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {meal.title}
          </Text>
          <Text style={styles.time}>{time}</Text>
        </View>
        <View style={styles.kcalRow}>
          <Icon name="flame" size={15} color={colors.streak} filled />
          <Text style={styles.kcal}>{Math.round(meal.calories)} Calories</Text>
        </View>
        <View style={styles.pills}>
          <MacroPill icon="protein" color={colors.protein} grams={meal.proteinG} />
          <MacroPill icon="carbs" color={colors.carbs} grams={meal.carbsG} />
          <MacroPill icon="fat" color={colors.fat} grams={meal.fatG} />
        </View>
      </View>
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
  thumb: { width: 76, height: 76, borderRadius: 12 },
  thumbEmpty: { backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0, marginLeft: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600', lineHeight: 19 },
  time: { color: colors.muted, fontSize: 11, marginTop: 2 },
  kcalRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  kcal: { color: colors.text, fontSize: 14, fontWeight: '700' },
  pills: { flexDirection: 'row', gap: 6, marginTop: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.bg, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  pillText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
});
