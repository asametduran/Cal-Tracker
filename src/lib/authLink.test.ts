import { parseAuthLink } from './authLink';

describe('parseAuthLink', () => {
  it('reads tokens from the URL fragment', () => {
    expect(parseAuthLink('caltracker://reset#access_token=AT&refresh_token=RT&type=recovery&expires_in=3600')).toEqual({
      type: 'recovery',
      accessToken: 'AT',
      refreshToken: 'RT',
      error: null,
    });
  });

  it('reads tokens from the query string and handles web URLs', () => {
    expect(parseAuthLink('http://localhost:8081/?access_token=AT&refresh_token=RT&type=signup')).toMatchObject({
      type: 'signup',
      accessToken: 'AT',
      refreshToken: 'RT',
    });
  });

  it('surfaces an error description (e.g. an expired link)', () => {
    const link = parseAuthLink('caltracker://reset#error=access_denied&error_description=Email+link+is+invalid+or+has+expired');
    expect(link?.error).toBe('Email link is invalid or has expired');
    expect(link?.accessToken).toBeNull();
  });

  it('returns null for ordinary URLs', () => {
    expect(parseAuthLink('caltracker://meal?id=abc')).toBeNull();
    expect(parseAuthLink('http://localhost:8081/progress')).toBeNull();
  });
});
