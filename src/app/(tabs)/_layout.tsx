import { router, Tabs } from 'expo-router';
import { useEffect } from 'react';
import type { ColorValue } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { repositories } from '@/data';
import { colors } from '@/theme';

type IconProps = { color: ColorValue };

function TodayIcon({ color }: IconProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Circle cx={12} cy={12} r={8} />
      <Circle cx={12} cy={12} r={2.5} fill={color} />
    </Svg>
  );
}

function ProgressIcon({ color }: IconProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 18 L9 12 L13 15 L20 6" />
      <Path d="M15 6 H20 V11" />
    </Svg>
  );
}

function SettingsIcon({ color }: IconProps) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Line x1={4} y1={7} x2={20} y2={7} />
      <Line x1={4} y1={17} x2={20} y2={17} />
      <Circle cx={9} cy={7} r={2.5} fill={colors.card} />
      <Circle cx={15} cy={17} r={2.5} fill={colors.card} />
    </Svg>
  );
}

export default function TabsLayout() {
  // First run: send people who haven't finished (or skipped) onboarding to the questions.
  useEffect(() => {
    let cancelled = false;
    repositories.profile.isOnboarded().then(
      (done) => {
        if (!cancelled && !done) router.replace('/onboarding');
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: { backgroundColor: colors.card, borderTopWidth: 0, height: 66, paddingTop: 6, boxShadow: '0 -4px 18px rgba(15, 22, 38, 0.06)' },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 6 },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <TodayIcon color={color} /> }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: ({ color }) => <ProgressIcon color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <SettingsIcon color={color} /> }} />
    </Tabs>
  );
}
