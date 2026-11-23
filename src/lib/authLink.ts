export type AuthLink = {
  /** One-time PKCE authorization code from the email link, to be exchanged for a session. */
  code: string | null;
  error: string | null;
};

/**
 * Reads the one-time code Supabase appends to an email link, e.g. `caltracker://reset?code=abc`.
 * Session tokens in a URL (the old implicit flow, `#access_token=...`) are deliberately NOT read: anyone
 * who can open a link in the app could otherwise sign the user into an account of their choosing.
 * Returns null when the URL carries neither a code nor an error.
 */
export function parseAuthLink(url: string): AuthLink | null {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const params = new URLSearchParams();

  if (queryIndex >= 0) {
    const end = hashIndex > queryIndex ? hashIndex : url.length;
    new URLSearchParams(url.slice(queryIndex + 1, end)).forEach((v, k) => params.set(k, v));
  }
  if (hashIndex >= 0) {
    new URLSearchParams(url.slice(hashIndex + 1)).forEach((v, k) => params.set(k, v));
  }

  const link: AuthLink = {
    code: params.get('code'),
    error: params.get('error_description') ?? params.get('error'),
  };
  return link.code || link.error ? link : null;
}
