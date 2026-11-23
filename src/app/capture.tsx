import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { prepareForAnalysis, uriToBase64 } from '@/lib/image';
import { setPendingPhoto } from '@/state/pendingPhoto';
import { colors, spacing } from '@/theme';

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.5,
  base64: true,
};

export default function CaptureScreen() {
  const { day } = useLocalSearchParams<{ day?: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(run: () => Promise<ImagePicker.ImagePickerResult>) {
    setError(null);
    setBusy(true);
    try {
      const result = await run();
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      const prepared = await prepareForAnalysis(asset.uri);
      const base64 = prepared ?? asset.base64 ?? (await uriToBase64(asset.uri));
      setPendingPhoto({
        uri: asset.uri,
        base64,
        mimeType: prepared ? 'image/jpeg' : (asset.mimeType ?? 'image/jpeg'),
      });
      router.push({ pathname: '/review', params: day ? { day } : {} });
    } catch {
      setError('Could not load that photo. Please try another one.');
    } finally {
      setBusy(false);
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError('Camera access is off. Allow it in settings, or choose a photo from your library.');
      return;
    }
    await handle(() => ImagePicker.launchCameraAsync(PICKER_OPTIONS));
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <Text style={styles.title}>Log a meal</Text>
        <Text style={styles.subtitle}>Take a photo, or pick one from your library, or a screenshot.</Text>

        <View style={styles.actions}>
          <Button label="📷  Take photo" onPress={takePhoto} disabled={busy} />
          <Button
            label="🖼️  Choose from library"
            variant="ghost"
            onPress={() => handle(() => ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS))}
            disabled={busy}
          />
        </View>

        {busy ? <ActivityIndicator color={colors.calories} style={styles.spinner} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <View style={styles.footer}>
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center' },
  body: { flex: 1, width: '100%', maxWidth: 560, padding: spacing.lg, justifyContent: 'center' },
  title: { color: colors.text, fontSize: 32, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 16, marginTop: spacing.sm, marginBottom: spacing.xl },
  actions: { gap: spacing.md },
  spinner: { marginTop: spacing.lg },
  error: { color: colors.danger, marginTop: spacing.lg, fontSize: 14 },
  footer: { width: '100%', maxWidth: 560, padding: spacing.lg },
});
