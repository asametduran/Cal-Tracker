export const MIN_PASSWORD_LENGTH = 8;

/** Returns an error message, or null when the email looks valid. */
export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (value === '') return 'Enter your email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return 'Enter a valid email address.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (password === '') return 'Enter a password.';
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  return null;
}

export function validateNewPassword(password: string, confirm: string): string | null {
  return validatePassword(password) ?? (password !== confirm ? "Passwords don't match." : null);
}

/** Maps raw auth-server messages to short, friendly text without leaking internals. */
export function friendlyAuthError(message: string | undefined): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invalid login credentials')) return "That email and password don't match.";
  if (m.includes('email not confirmed')) return 'Please confirm your email first. Check your inbox.';
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'An account with this email already exists. Try signing in.';
  }
  if (m.includes('password should be') || m.includes('weak password')) return 'Choose a stronger password.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a few minutes.';
  if (m.includes('same as the old') || m.includes('different from the old')) return 'Choose a password you have not used before.';
  if (m.includes('fetch') || m.includes('network')) return 'Could not reach the server. Check your connection.';
  return 'Something went wrong. Please try again.';
}
