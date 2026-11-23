import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { colors } from '@/theme';

/** Number that counts up/down to `value` whenever it changes. */
export function CountUp({
  value,
  style,
  duration = 800,
}: {
  value: number;
  style?: StyleProp<TextStyle>;
  duration?: number;
}) {
  const [display, setDisplay] = useState(value);
  const shown = useRef(value);

  useEffect(() => {
    const from = shown.current;
    if (from === value) return;
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      shown.current = Math.round(from + (value - from) * eased);
      setDisplay(shown.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <Text style={style}>{display}</Text>;
}

/** "+N kcal" badge that floats up and fades each time `triggerKey` changes. */
export function AddedBadge({ triggerKey, amount }: { triggerKey?: string; amount: number }) {
  const y = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!triggerKey) return;
    y.value = 0;
    opacity.value = 1;
    y.value = withTiming(-70, { duration: 1200 });
    opacity.value = withDelay(800, withTiming(0, { duration: 400 }));
  }, [triggerKey, y, opacity]);

  const animated = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }],
  }));

  if (!Number.isFinite(amount)) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.badge, animated]}>
      <Text style={styles.badgeText}>+{amount} kcal</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 40,
    alignSelf: 'center',
    backgroundColor: colors.success,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: { color: colors.onAccent, fontWeight: '700', fontSize: 16 },
});
