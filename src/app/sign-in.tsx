import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui';
import { validateEmail, validateNewPassword, validatePassword } from '@/lib/authForm';
import { colors, radius, spacing } from '@/theme';

type Mode = 'signin' | 'signup' | 'forgot';
type Message = { kind: 'error' | 'info'; text: string };

const TITLES = {
  signin: { title: 'Welcome back', sub: 'Sign in to pick up where you left off.' },
  signup: { title: 'Create your account', sub: 'Your meals and progress sync across your devices.' },
  forgot: { title: 'Reset your password', sub: "We'll email you a link to choose a new one." },
  reset: { title: 'Choose a new password', sub: 'Pick something you have not used before.' },
} as const;

/** Sign in, create account, forgot password, and (after an emailed link) set a new password. */
export default function SignInScreen() {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  // Following the reset link signs the user in but must lead to the new-password form.
  const view = auth.recovery ? 'reset' : mode;
  const copy = TITLES[view];

  function switchMode(next: Mode) {
    setMode(next);
    setMessage(null);
    setPassword('');
    setConfirm('');
  }

  async function submit() {
    if (busy) return;
    setMessage(null);

    const problem =
      view === 'reset'
        ? validateNewPassword(password, confirm)
        : (view === 'forgot' ? null : view === 'signup' ? validatePassword(password) : password === '' ? 'Enter your password.' : null) ??
          validateEmail(email);
    if (problem) {
      setMessage({ kind: 'error', text: problem });
      return;
    }

    setBusy(true);
    try {
      if (view === 'signin') {
        const error = await auth.signIn(email, password);
        if (error) setMessage({ kind: 'error', text: error });
      } else if (view === 'signup') {
        const { error, needsConfirmation } = await auth.signUp(email, password);
        if (error) setMessage({ kind: 'error', text: error });
        else if (needsConfirmation) {
          switchMode('signin');
          setMessage({ kind: 'info', text: 'Check your email and confirm your account, then sign in.' });
        }
      } else if (view === 'forgot') {
        const error = await auth.sendPasswordReset(email);
        setMessage(
          error
            ? { kind: 'error', text: error }
            : { kind: 'info', text: 'If an account exists for that email, a reset link is on its way.' },
        );
      } else {
        const error = await auth.updatePassword(password);
        if (error) setMessage({ kind: 'error', text: error });
      }
    } finally {
      setBusy(false);
    }
  }

  const submitLabel = { signin: 'Sign in', signup: 'Create account', forgot: 'Send reset link', reset: 'Update password' }[view];

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>Cal Tracker</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.sub}>{copy.sub}</Text>

        {view !== 'reset' ? (
          <Field
            label="EMAIL"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />
        ) : null}
        {view !== 'forgot' ? (
          <Field
            label={view === 'reset' ? 'NEW PASSWORD' : 'PASSWORD'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={view === 'signin' ? 'current-password' : 'new-password'}
            textContentType={view === 'signin' ? 'password' : 'newPassword'}
          />
        ) : null}
        {view === 'reset' ? (
          <Field label="CONFIRM PASSWORD" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
        ) : null}

        {message ? <Text style={[styles.message, message.kind === 'error' ? styles.error : styles.info]}>{message.text}</Text> : null}

        <Button label={busy ? 'Please wait…' : submitLabel} onPress={() => void submit()} disabled={busy} style={styles.submit} />

        {view === 'signin' ? (
          <View style={styles.links}>
            <Button label="Forgot password?" variant="ghost" onPress={() => switchMode('forgot')} />
            <Button label="Create an account" variant="ghost" onPress={() => switchMode('signup')} />
          </View>
        ) : null}
        {view === 'signup' || view === 'forgot' ? (
          <View style={styles.links}>
            <Button label={view === 'signup' ? 'I already have an account' : 'Back to sign in'} variant="ghost" onPress={() => switchMode('signin')} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoComplete?: 'email' | 'current-password' | 'new-password';
  textContentType?: 'emailAddress' | 'password' | 'newPassword';
};

function Field({ label, value, onChangeText, secureTextEntry, keyboardType, autoComplete, textContentType }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={autoComplete}
        textContentType={textContentType}
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center' },
  scroll: { width: '100%' },
  content: { padding: spacing.lg, paddingTop: spacing.xl, width: '100%', maxWidth: 440, alignSelf: 'center' },
  brand: { color: colors.accent, fontSize: 14, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: spacing.lg },
  title: { color: colors.text, fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  sub: { color: colors.muted, fontSize: 15, marginTop: spacing.sm, marginBottom: spacing.lg },
  field: { marginBottom: spacing.md },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600', letterSpacing: 1, marginBottom: spacing.xs },
  input: { backgroundColor: colors.card, color: colors.text, fontSize: 17, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 14 },
  message: { fontSize: 14, marginBottom: spacing.md },
  error: { color: colors.danger },
  info: { color: colors.success },
  submit: { marginTop: spacing.sm },
  links: { marginTop: spacing.md, gap: spacing.sm },
});
