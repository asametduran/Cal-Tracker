import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { Icon, type IconName } from './Icon';

export type AddChoice = 'photo' | 'manual' | 'weight';

const OPTIONS: { choice: AddChoice; icon: IconName; label: string; hint: string }[] = [
  { choice: 'photo', icon: 'camera', label: 'Scan a meal', hint: 'Photo or screenshot, estimated by AI' },
  { choice: 'manual', icon: 'pencil', label: 'Enter a meal', hint: 'Type calories and macros yourself' },
  { choice: 'weight', icon: 'scale', label: 'Log weight', hint: 'Add a weigh-in' },
];

type Props = {
  visible: boolean;
  /** e.g. "Today" or "Yesterday", shown in the sheet title. */
  dayLabel: string;
  onClose: () => void;
  onSelect: (choice: AddChoice) => void;
};

/** Bottom sheet behind the main + button. */
export function AddMenu({ visible, dayLabel, onClose, onSelect }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable accessibilityLabel="Close menu" style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Add to {dayLabel}</Text>
          {OPTIONS.map((o) => (
            <Pressable
              key={o.choice}
              accessibilityRole="button"
              accessibilityLabel={o.label}
              onPress={() => onSelect(o.choice)}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            >
              <View style={styles.icon}>
                <Icon name={o.icon} size={22} color={colors.text} />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.label}>{o.label}</Text>
                <Text style={styles.hint}>{o.hint}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(4,8,16,0.7)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  pressed: { backgroundColor: colors.cardAlt },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  optionText: { flex: 1 },
  label: { color: colors.text, fontSize: 16, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 13, marginTop: 2 },
});
