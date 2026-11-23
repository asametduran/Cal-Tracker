import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui';
import { configureNotifications } from '@/lib/reminders';
import { colors, spacing } from '@/theme';

configureNotifications();

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

function CenteredScreen({ children }: { children: ReactNode }) {
  return (
    <View style={styles.center}>
      <StatusBar style="dark" />
      {children}
    </View>
  );
}

function RootNavigator() {
  const { status, recovery, retrySync, signOut, isConfigured } = useAuth();

  // Same background as the app, so a reload never flashes the wrong screen.
  if (status === 'loading' || status === 'hydrating') {
    return (
      <CenteredScreen>
        <ActivityIndicator color={colors.accent} />
        {status === 'hydrating' ? <Text style={styles.text}>Loading your data…</Text> : null}
      </CenteredScreen>
    );
  }

  if (status === 'syncError') {
    return (
      <CenteredScreen>
        <Text style={styles.title}>Can&apos;t load your data</Text>
        <Text style={styles.text}>Check your connection and try again.</Text>
        <View style={styles.actions}>
          <Button label="Try again" onPress={retrySync} />
          {isConfigured ? <Button label="Sign out" variant="ghost" onPress={() => void signOut()} /> : null}
        </View>
      </CenteredScreen>
    );
  }

  // A password-reset link signs the user in, but they must set a new password before using the app.
  const signedIn = status === 'ready' && !recovery;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="capture" />
          <Stack.Screen name="review" />
          <Stack.Screen name="meal" />
          <Stack.Screen name="weight" />
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  text: { color: colors.muted, fontSize: 15, marginTop: spacing.sm, textAlign: 'center' },
  actions: { marginTop: spacing.lg, gap: spacing.sm, width: '100%', maxWidth: 320 },
});
