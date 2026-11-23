import { friendlyAuthError, validateEmail, validateNewPassword, validatePassword } from './authForm';

describe('validateEmail', () => {
  it('accepts normal addresses and rejects bad ones', () => {
    expect(validateEmail(' me@example.com ')).toBeNull();
    for (const bad of ['', '   ', 'me', 'me@', '@example.com', 'me@example', 'me @example.com']) {
      expect(validateEmail(bad)).not.toBeNull();
    }
  });
});

describe('passwords', () => {
  it('requires at least 8 characters', () => {
    expect(validatePassword('')).not.toBeNull();
    expect(validatePassword('1234567')).not.toBeNull();
    expect(validatePassword('12345678')).toBeNull();
  });

  it('requires the confirmation to match', () => {
    expect(validateNewPassword('longenough', 'longenough')).toBeNull();
    expect(validateNewPassword('longenough', 'different1')).toBe("Passwords don't match.");
    expect(validateNewPassword('short', 'short')).not.toBeNull();
  });
});

describe('friendlyAuthError', () => {
  it('translates known messages and hides unknown ones', () => {
    expect(friendlyAuthError('Invalid login credentials')).toContain("don't match");
    expect(friendlyAuthError('Email not confirmed')).toContain('confirm');
    expect(friendlyAuthError('User already registered')).toContain('already exists');
    expect(friendlyAuthError('email rate limit exceeded')).toContain('Too many');
    expect(friendlyAuthError('Failed to fetch')).toContain('connection');
    expect(friendlyAuthError('pq: internal detail xyz')).toBe('Something went wrong. Please try again.');
    expect(friendlyAuthError(undefined)).toBe('Something went wrong. Please try again.');
  });
});
