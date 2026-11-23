import * as Linking from 'expo-linking';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { getLocalOnlyRepositories, notifyDataChanged, setActiveRepositories } from '@/data/facade';
import { hasLocalData, importLocalData } from '@/data/importLocal';
import { createPersistentStorage, type PersistentStorage } from '@/data/persistentStorage';
import { createSupabaseRemote } from '@/data/remote';
import { createSyncEngine, type SyncEngine, type SyncResult } from '@/data/sync';
import { friendlyAuthError } from '@/lib/authForm';
import { parseAuthLink } from '@/lib/authLink';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * loading     checking for a saved session
 * signedOut   show the sign-in screen
 * hydrating   signed in on a device with no cached data yet: pulling it once
 * syncError   that first pull failed (offline); offer a retry
 * ready       the app is usable (also the permanent state when Supabase isn't configured)
 */
export type AuthStatus = 'loading' | 'signedOut' | 'hydrating' | 'syncError' | 'ready';

type AuthContextValue = {
  status: AuthStatus;
  /** False when Supabase env vars are missing: the app runs device-only with no accounts. */
  isConfigured: boolean;
  email: string | null;
  /** True after following a password-reset email link, until a new password is set. */
  recovery: boolean;
  signIn(email: string, password: string): Promise<string | null>;
  signUp(email: string, password: string): Promise<{ error: string | null; needsConfirmation: boolean }>;
  /** Resolves to an error message, or null on success. Refuses if changes haven't synced yet. */
  signOut(): Promise<string | null>;
  sendPasswordReset(email: string): Promise<string | null>;
  updatePassword(password: string): Promise<string | null>;
  retrySync(): void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const IMPORTED_KEY = 'caltracker.imported.v1';

function redirectUrl(): string {
  return Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : Linking.createURL('/');
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.');
  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? 'loading' : 'ready');
  const [email, setEmail] = useState<string | null>(null);
  const [recovery, setRecovery] = useState(false);

  const engineRef = useRef<SyncEngine | null>(null);
  const storageRef = useRef<PersistentStorage | null>(null);
  const activeUserRef = useRef<string | null>(null);

  /** After the first successful pull for an account: bring this device's pre-account data along, once. */
  const afterFirstSync = useCallback(async (engine: SyncEngine, storage: PersistentStorage, result: SyncResult) => {
    if (result.status !== 'ok' || storage.getItem(IMPORTED_KEY) === '1') return;
    storage.setItem(IMPORTED_KEY, '1');
    if (!result.remoteWasEmpty) return;
    const deviceOnly = getLocalOnlyRepositories();
    if (await hasLocalData(deviceOnly)) {
      await importLocalData(deviceOnly, engine.repositories);
      await engine.flush();
      notifyDataChanged();
    }
  }, []);

  const runSync = useCallback(
    async (engine: SyncEngine, storage: PersistentStorage, userId: string): Promise<SyncResult> => {
      let result: SyncResult = await engine.sync();
      for (let attempt = 0; attempt < 2 && result.status === 'stale'; attempt++) result = await engine.sync();
      if (activeUserRef.current === userId) await afterFirstSync(engine, storage, result);
      return result;
    },
    [afterFirstSync],
  );

  const hydrate = useCallback(
    async (engine: SyncEngine, storage: PersistentStorage, userId: string) => {
      setStatus('hydrating');
      const result = await runSync(engine, storage, userId);
      if (activeUserRef.current !== userId) return;
      setStatus(result.status === 'ok' ? 'ready' : 'syncError');
    },
    [runSync],
  );

  const activate = useCallback(
    async (userId: string) => {
      if (!supabase || activeUserRef.current === userId) return;
      activeUserRef.current = userId;

      // Per-user cache: reads are instant, so reloads never flash empty or logged-out UI.
      const storage = createPersistentStorage(`caltracker.cache.${userId}.`);
      await storage.ready;
      if (activeUserRef.current !== userId) return;

      const engine = createSyncEngine({
        storage,
        remote: createSupabaseRemote(supabase, userId),
        onChange: notifyDataChanged,
      });
      storageRef.current = storage;
      engineRef.current = engine;
      setActiveRepositories(engine.repositories);

      if (engine.isHydrated()) {
        setStatus('ready');
        void runSync(engine, storage, userId); // refresh quietly in the background
      } else {
        await hydrate(engine, storage, userId);
      }
    },
    [hydrate, runSync],
  );

  const deactivate = useCallback(() => {
    activeUserRef.current = null;
    engineRef.current = null;
    storageRef.current = null;
    setActiveRepositories(getLocalOnlyRepositories());
    setEmail(null);
    setStatus('signedOut');
  }, []);

  const handleSession = useCallback(
    (session: Session | null) => {
      if (session?.user) {
        setEmail(session.user.email ?? null);
        void activate(session.user.id);
      } else {
        deactivate();
      }
    },
    [activate, deactivate],
  );

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      // Deferred: awaiting Supabase calls inside this callback can deadlock the auth client.
      setTimeout(() => handleSession(session), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [handleSession]);

  // Email links (confirm sign-up / reset password) opened inside the native app.
  useEffect(() => {
    if (!supabase || Platform.OS === 'web') return;
    const client = supabase;
    const handleUrl = async (url: string | null) => {
      const link = url ? parseAuthLink(url) : null;
      if (!link?.accessToken || !link.refreshToken) return;
      if (link.type === 'recovery') setRecovery(true);
      await client.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken });
    };
    void Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', (event) => void handleUrl(event.url));
    return () => subscription.remove();
  }, []);

  // Pull fresh data whenever the app comes back to the foreground.
  useEffect(() => {
    if (status !== 'ready' || !isSupabaseConfigured) return;
    const subscription = AppState.addEventListener('change', (state) => {
      const engine = engineRef.current;
      const storage = storageRef.current;
      const userId = activeUserRef.current;
      if (state === 'active' && engine && storage && userId) void runSync(engine, storage, userId);
    });
    return () => subscription.remove();
  }, [status, runSync]);

  const signIn = useCallback(async (emailInput: string, password: string) => {
    if (!supabase) return 'Accounts are not set up yet.';
    const { error } = await supabase.auth.signInWithPassword({ email: emailInput.trim(), password });
    return error ? friendlyAuthError(error.message) : null;
  }, []);

  const signUp = useCallback(async (emailInput: string, password: string) => {
    if (!supabase) return { error: 'Accounts are not set up yet.', needsConfirmation: false };
    const { data, error } = await supabase.auth.signUp({
      email: emailInput.trim(),
      password,
      options: { emailRedirectTo: redirectUrl() },
    });
    if (error) return { error: friendlyAuthError(error.message), needsConfirmation: false };
    return { error: null, needsConfirmation: !data.session };
  }, []);

  const sendPasswordReset = useCallback(async (emailInput: string) => {
    if (!supabase) return 'Accounts are not set up yet.';
    const { error } = await supabase.auth.resetPasswordForEmail(emailInput.trim(), { redirectTo: redirectUrl() });
    return error ? friendlyAuthError(error.message) : null;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    if (!supabase) return 'Accounts are not set up yet.';
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return friendlyAuthError(error.message);
    setRecovery(false);
    return null;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return null;
    const engine = engineRef.current;
    const storage = storageRef.current;
    if (engine) {
      await engine.sync();
      const pending = engine.pendingCount();
      if (pending > 0) {
        return `${pending} change${pending === 1 ? '' : 's'} haven't synced yet. Connect to the internet and try again.`;
      }
    }
    await supabase.auth.signOut();
    // Don't leave one person's data on the device after they sign out.
    await storage?.flush();
    await storage?.clear();
    return null;
  }, []);

  const retrySync = useCallback(() => {
    const engine = engineRef.current;
    const storage = storageRef.current;
    const userId = activeUserRef.current;
    if (engine && storage && userId) void hydrate(engine, storage, userId);
  }, [hydrate]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      isConfigured: isSupabaseConfigured,
      email,
      recovery,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      updatePassword,
      retrySync,
    }),
    [status, email, recovery, signIn, signUp, signOut, sendPasswordReset, updatePassword, retrySync],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
