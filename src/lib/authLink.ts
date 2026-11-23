export type AuthLink = {
  /** e.g. "recovery" (password reset) or "signup" (email confirmation). */
  type: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  error: string | null;
};

/**
 * Reads the tokens Supabase appends to an email link, e.g.
 * `caltracker://reset#access_token=...&refresh_token=...&type=recovery`.
 * Returns null when the URL carries neither tokens nor an error.
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
    type: params.get('type'),
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
    error: params.get('error_description') ?? params.get('error'),
  };
  return link.accessToken || link.refreshToken || link.error ? link : null;
}
