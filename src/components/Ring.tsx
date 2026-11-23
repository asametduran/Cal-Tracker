import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G } from 'react-native-svg';

import { colors } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  /** 0..1 */
  progress: number;
  color: string;
  size?: number;
  stroke?: number;
  children?: ReactNode;
};

/** Circular progress ring that animates whenever `progress` changes. */
export function Ring({ progress, color, size = 230, stroke = 18, children }: Props) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = useSharedValue(0);

  useEffect(() => {
    value.value = withTiming(progress, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [progress, value]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - value.value),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        width={size}
        height={size}
        style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-90deg' }] }]}
      >
        <G>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.border}
            strokeWidth={stroke}
            fill="none"
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            animatedProps={animatedProps}
            fill="none"
          />
        </G>
      </Svg>
      {children}
    </View>
  );
}
