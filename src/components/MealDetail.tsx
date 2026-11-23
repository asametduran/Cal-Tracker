import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { parseAmount, type MealForm } from '@/lib/nutrition';
import { colors, radius, shadow, spacing } from '@/theme';

import { Button } from './ui';
import { Icon, type IconName } from './Icon';

type Action = { label: string; onPress: () => void; disabled?: boolean; tone?: 'default' | 'danger' };

type Props = {
  photoUri?: string | null;
  /** Small line under the title, e.g. "Logging for Today". */
  caption: string;
  onBack: () => void;
  form: MealForm;
  onChange: (key: keyof MealForm, text: string) => void;
  status?: 'ready' | 'loading' | 'error';
  /** Shown while loading and on error. */
  statusMessage?: string;
  onRetry?: () => void;
  onManual?: () => void;
  /** Save/delete failure, shown above the buttons. */
  errorText?: string;
  secondary: Action;
  primary: Action;
};

const KEYS = ['calories', 'proteinG', 'carbsG', 'fatG'] as const;

const MACROS: { key: 'proteinG' | 'carbsG' | 'fatG'; label: string; icon: IconName; color: string }[] = [
  { key: 'proteinG', label: 'Protein', icon: 'protein', color: colors.protein },
  { key: 'carbsG', label: 'Carbs', icon: 'carbs', color: colors.carbs },
  { key: 'fatG', label: 'Fat', icon: 'fat', color: colors.fat },
];

/** Round to one decimal and drop a trailing ".0". */
const fmt = (n: number) => String(Math.round(n * 10) / 10);

/**
 * Nutrition detail: the meal photo on top with a rounded sheet overlapping it, a servings stepper by the
 * title, a calories card, three macro cards and Fix Results / Done style actions. Shared by Review and Meal.
 * Mount it with a changing `key` to reset the servings stepper (e.g. after re-analysing).
 */
export function MealDetail({ photoUri, caption, onBack, form, onChange, status = 'ready', statusMessage, onRetry, onManual, errorText, secondary, primary }: Props) {
  const [servings, setServings] = useState(1);

  function changeServings(delta: number) {
    const next = Math.min(20, Math.max(1, servings + delta));
    if (next === servings) return;
    for (const key of KEYS) {
      const n = parseAmount(form[key]);
      if (n !== null) onChange(key, fmt((n / servings) * next));
    }
    setServings(next);
  }

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.column}>
          <View style={styles.hero}>
            {photoUri ? (
              <Image accessibilityLabel="Photo of the meal" source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <View style={styles.heroEmpty}>
                <Icon name="pencil" size={40} color={colors.muted} />
              </View>
            )}
          </View>

          <View style={styles.sheet}>
            {status === 'loading' ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.accent} size="large" />
                <Text style={styles.muted}>{statusMessage ?? 'Analysing your meal…'}</Text>
              </View>
            ) : status === 'error' ? (
              <View style={styles.center}>
                <Text style={styles.error}>{statusMessage}</Text>
                <View style={styles.errorActions}>
                  {onRetry ? <Button label="Try again" onPress={onRetry} /> : null}
                  {onManual ? <Button label="Enter manually" variant="ghost" onPress={onManual} /> : null}
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.caption}>{caption}</Text>
                <View style={styles.titleRow}>
                  <TextInput
                    accessibilityLabel="Meal name"
                    value={form.title}
                    onChangeText={(t) => onChange('title', t)}
                    placeholder="What was it?"
                    placeholderTextColor={colors.muted}
                    multiline
                    numberOfLines={2}
                    scrollEnabled={false}
                    style={styles.titleInput}
                  />
                  <View style={styles.stepper}>
                    <Pressable accessibilityLabel="Fewer servings" disabled={servings <= 1} hitSlop={6} onPress={() => changeServings(-1)} style={styles.stepButton}>
                      <Icon name="minus" size={16} color={servings <= 1 ? colors.border : colors.text} />
                    </Pressable>
                    <Text accessibilityLabel={`${servings} servings`} style={styles.servings}>
                      {servings}
                    </Text>
                    <Pressable accessibilityLabel="More servings" hitSlop={6} onPress={() => changeServings(1)} style={styles.stepButton}>
                      <Icon name="plus" size={16} color={colors.text} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.caloriesCard}>
                  <View style={styles.flameBadge}>
                    <Icon name="flame" size={22} color={colors.streak} filled />
                  </View>
                  <View style={styles.caloriesText}>
                    <Text style={styles.cardLabel}>Calories</Text>
                    <TextInput
                      accessibilityLabel="Calories"
                      value={form.calories}
                      onChangeText={(t) => onChange('calories', t)}
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                      style={styles.caloriesInput}
                    />
                  </View>
                </View>

                <View style={styles.macros}>
                  {MACROS.map((m) => (
                    <View key={m.key} style={styles.macroCard}>
                      <View style={styles.macroHead}>
                        <Icon name={m.icon} size={14} color={m.color} />
                        <Text style={styles.cardLabel}>{m.label}</Text>
                      </View>
                      <View style={styles.macroValue}>
                        <TextInput
                          accessibilityLabel={m.label}
                          value={form[m.key]}
                          onChangeText={(t) => onChange(m.key, t)}
                          keyboardType="decimal-pad"
                          selectTextOnFocus
                          style={styles.macroInput}
                        />
                        <Text style={styles.unit}>g</Text>
                      </View>
                    </View>
                  ))}
                </View>

                <Text style={styles.note}>AI estimates can be off. Tap any number to adjust it.</Text>
                {errorText ? <Text style={styles.error}>{errorText}</Text> : null}
              </>
            )}
          </View>
        </View>
      </ScrollView>

      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}>
        <Icon name="back" size={20} color={colors.text} />
      </Pressable>

      <SafeAreaView edges={['bottom']} style={styles.footerWrap}>
        <View style={styles.footer}>
          <Button
            label={secondary.label}
            variant={secondary.tone === 'danger' ? 'danger' : 'ghost'}
            onPress={secondary.onPress}
            disabled={secondary.disabled}
            style={styles.footerButton}
          />
          <Button label={primary.label} onPress={primary.onPress} disabled={primary.disabled} style={styles.footerButton} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.card, alignItems: 'center' },
  scrollView: { width: '100%' },
  scroll: { flexGrow: 1, alignItems: 'center' },
  column: { width: '100%', maxWidth: 560, flexGrow: 1 },
  hero: { height: 300, backgroundColor: colors.cardAlt },
  heroEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sheet: {
    flexGrow: 1,
    marginTop: -28,
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.md,
    ...shadow.card,
  },
  back: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  caption: { color: colors.muted, fontSize: 12, marginBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: spacing.md },
  titleInput: { flex: 1, minWidth: 0, color: colors.text, fontSize: 20, fontWeight: '700', lineHeight: 26, letterSpacing: -0.3, padding: 0, minHeight: 52 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardAlt, borderRadius: 18, paddingHorizontal: 4 },
  stepButton: { width: 30, height: 34, alignItems: 'center', justifyContent: 'center' },
  servings: { color: colors.text, fontSize: 16, fontWeight: '700', minWidth: 22, textAlign: 'center' },
  caloriesCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.md, padding: 16, marginBottom: 12 },
  flameBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginRight: 14, ...shadow.card },
  caloriesText: { flex: 1 },
  cardLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  caloriesInput: { color: colors.text, fontSize: 32, fontWeight: '800', letterSpacing: -1, padding: 0, marginTop: 2 },
  macros: { flexDirection: 'row', gap: 10 },
  macroCard: { flex: 1, backgroundColor: colors.bg, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 12 },
  macroHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  macroValue: { flexDirection: 'row', alignItems: 'baseline', marginTop: 6 },
  macroInput: { flex: 1, minWidth: 0, color: colors.text, fontSize: 22, fontWeight: '700', padding: 0 },
  unit: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  note: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: spacing.md },
  center: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.md },
  muted: { color: colors.muted, fontSize: 14 },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center', marginTop: spacing.sm },
  errorActions: { gap: spacing.sm, width: '100%' },
  footerWrap: { width: '100%', backgroundColor: colors.card, alignItems: 'center' },
  footer: { flexDirection: 'row', gap: 12, width: '100%', maxWidth: 560, padding: spacing.md, paddingTop: 8 },
  footerButton: { flex: 1 },
});
