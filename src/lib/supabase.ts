import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

import { createChunkedStorage, type AuthStorage } from './secureStorage';

// Literal property access so Expo inlines these at bundle time. The anon/publishable key is
// designed to be public: Row Level Security, not secrecy, protects the data.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** False until both env values are set; the app then runs in local-only mode. */
export const isSupabaseConfigured = url !== '' && anonKey !== '';

/**
 * Session tokens live in the iOS Keychain / Android Keystore on native builds. On web there is no secure
 * store, so the standard browser storage is used (the same trade-off every browser SPA makes).
 */
function createAuthStorage(): AuthStorage {
  return Platform.OS === 'web' ? AsyncStorage : createChunkedStorage(SecureStore);
}

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        storage: createAuthStorage(),
        // PKCE: email links carry a one-time ?code= that only works for the device that asked for it,
        // instead of session tokens in the URL that any link or app could inject.
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        // On web, pick up email-confirmation and password-recovery links from the URL.
        detectSessionInUrl: Platform.OS === 'web',
      },
    })
  : null;

if (supabase && Platform.OS !== 'web') {
  // Only refresh tokens while the app is in the foreground.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
