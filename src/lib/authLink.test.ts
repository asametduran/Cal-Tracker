import { parseAuthLink } from './authLink';

describe('parseAuthLink', () => {
  it('reads the one-time code from the query string of a deep link', () => {
    expect(parseAuthLink('caltracker://reset?code=abc-123')).toEqual({ code: 'abc-123', error: null });
  });

  it('reads the code from web URLs and ignores other parameters', () => {
    expect(parseAuthLink('http://localhost:8081/?code=xyz&foo=bar')).toEqual({ code: 'xyz', error: null });
  });

  it('ignores session tokens in a URL: the implicit flow is not accepted', () => {
    expect(parseAuthLink('caltracker://reset#access_token=AT&refresh_token=RT&type=recovery')).toBeNull();
    expect(parseAuthLink('caltracker://x?access_token=AT&refresh_token=RT')).toBeNull();
  });

  it('does not let tokens ride along with a code', () => {
    expect(parseAuthLink('caltracker://reset?code=abc#access_token=AT&refresh_token=RT')).toEqual({ code: 'abc', error: null });
  });

  it('surfaces an error description (e.g. an expired link)', () => {
    const link = parseAuthLink('caltracker://reset#error=access_denied&error_description=Email+link+is+invalid+or+has+expired');
    expect(link).toEqual({ code: null, error: 'Email link is invalid or has expired' });
  });

  it('returns null for ordinary URLs', () => {
    expect(parseAuthLink('caltracker://meal?id=abc')).toBeNull();
    expect(parseAuthLink('http://localhost:8081/progress')).toBeNull();
  });
});
