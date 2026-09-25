/**
 * Utility functions for validating JWT tokens and sanitizing redirect URLs.
 * Edge-runtime & browser compatible (no heavy dependencies).
 */

/**
 * Checks if a token is a non-empty, structural JWT that is not expired.
 * Validates base64 payload and exp claim (with clock skew tolerance).
 */
export function isTokenValid(token: string | null | undefined): boolean {
  if (!token || typeof token !== 'string') return false;
  const trimmed = token.trim();
  if (
    !trimmed ||
    trimmed === 'undefined' ||
    trimmed === 'null' ||
    trimmed === '[object Object]'
  ) {
    return false;
  }

  const parts = trimmed.split('.');
  if (parts.length !== 3) return false;

  try {
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (payloadBase64.length % 4)) % 4;
    const padded = payloadBase64 + '='.repeat(padLength);

    const decodedStr =
      typeof atob === 'function'
        ? atob(padded)
        : typeof Buffer !== 'undefined'
          ? Buffer.from(padded, 'base64').toString('utf-8')
          : null;

    if (!decodedStr) return false;

    const payload = JSON.parse(decodedStr) as Record<string, any> | null;
    if (!payload || typeof payload !== 'object') return false;

    const exp = (payload as Record<string, any>).exp;
    if (typeof exp === 'number') {
      const nowSeconds = Math.floor(Date.now() / 1000);
      // Give a 10-second grace window for minor clock skew
      if (exp <= nowSeconds - 10) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Validates and sanitizes internal redirect URLs.
 * Rejects external URLs, protocol-relative URLs (//), and auth entry loop paths.
 */
export function getSafeRedirectUrl(
  param: string | null | undefined,
  fallback: string = '/home',
): string {
  if (!param) return fallback;
  const trimmed = param.trim();

  // Must start with '/' and must not be protocol-relative ('//')
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return fallback;
  }

  // Prevent self-redirect loop back to auth pages
  const normalized = trimmed.toLowerCase();
  if (
    normalized === '/login' ||
    normalized.startsWith('/login?') ||
    normalized.startsWith('/login/') ||
    normalized === '/register' ||
    normalized.startsWith('/register?') ||
    normalized.startsWith('/register/')
  ) {
    return fallback;
  }

  return trimmed;
}
