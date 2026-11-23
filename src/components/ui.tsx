import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { parseAmount, stepAmount } from '@/lib/nutrition';
import { colors, radius, shadow, spacing } from '@/theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, disabled, variant = 'primary', style }: ButtonProps) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonSoft,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          primary ? styles.textOnAccent : variant === 'danger' ? styles.textDanger : styles.textDefault,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type ChipProps = {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
};

/** Pill selector used for single-choice questions. */
export function Chip({ label, hint, selected, onPress, compact }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        compact && styles.chipCompact,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipLabel, selected && styles.textOnAccent]}>{label}</Text>
      {hint ? <Text style={[styles.chipHint, selected && styles.chipHintSelected]}>{hint}</Text> : null}
    </Pressable>
  );
}

type NumberFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  step: number;
  unit: string;
  color: string;
};

/** Numeric input with minus/plus steppers for quick corrections. */
export function NumberField({ label, value, onChangeText, step, unit, color }: NumberFieldProps) {
  const invalid = parseAmount(value) === null;
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color }]}>{label}</Text>
      <View style={[styles.fieldRow, invalid && styles.fieldInvalid]}>
        <Pressable
          accessibilityLabel={`Decrease ${label}`}
          onPress={() => onChangeText(stepAmount(value, -step))}
          style={styles.stepper}
        >
          <Text style={styles.stepperText}>−</Text>
        </Pressable>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          selectTextOnFocus
          style={styles.fieldInput}
        />
        <Text style={styles.unit}>{unit}</Text>
        <Pressable
          accessibilityLabel={`Increase ${label}`}
          onPress={() => onChangeText(stepAmount(value, step))}
          style={styles.stepper}
        >
          <Text style={styles.stepperText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonSoft: { backgroundColor: colors.cardAlt },
  buttonText: { fontSize: 16, fontWeight: '600', letterSpacing: 0.2 },
  textOnAccent: { color: colors.onAccent },
  textDefault: { color: colors.text },
  textDanger: { color: colors.danger },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
  chip: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    ...shadow.card,
  },
  // Compact chips sit inside cards, so they are inset (grey) instead of raised.
  chipCompact: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.lg, backgroundColor: colors.cardAlt, boxShadow: 'none' },
  chipSelected: { backgroundColor: colors.accent },
  chipLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  chipHint: { color: colors.muted, fontSize: 12, marginTop: 2 },
  chipHintSelected: { color: colors.onAccent, opacity: 0.7 },
  field: { marginBottom: spacing.md },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: spacing.xs, letterSpacing: 1 },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    ...shadow.card,
  },
  fieldInvalid: { borderColor: colors.danger },
  stepper: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  stepperText: { color: colors.muted, fontSize: 24, fontWeight: '400' },
  fieldInput: {
    flex: 1,
    minWidth: 0,
    color: colors.text,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'right',
    paddingVertical: 12,
  },
  unit: { color: colors.muted, fontSize: 14, marginLeft: spacing.xs, marginRight: spacing.xs, minWidth: 32 },
});
