import { logger } from '@/shared/lib/logger';
import { isTokenValid } from '@/shared/utils/auth-token.util';

/**
 * Centralized authentication token storage adapter and lifecycle manager.
 * Supports swappable storage strategies (LocalStorage vs. InMemory) with SSR safety.
 */

// ─── 1. Types & Interface ─────────────────────────────────────────────────────

export interface AuthTokens {
  readonly accessToken: string | null;
}

export interface TokenStorageAdapter {
  getAccessToken(): string | null;
  setAccessToken(accessToken: string): void;
  setTokens(accessToken: string): void;
  clearTokens(): void;
}

// ─── 2. Storage Keys ──────────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
} as const;

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60; // 604,800 seconds (1 week)

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

function setCookieValue(name: string, value: string, maxAgeSeconds: number = SEVEN_DAYS_SECONDS): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

function deleteCookieValue(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; SameSite=Lax`;
}

// ─── 3. LocalStorage Adapter (Browser Runtime with Cookie Synchronization) ─────

export class LocalStorageTokenAdapter implements TokenStorageAdapter {
  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  public getAccessToken(): string | null {
    if (!this.isBrowser()) {
      const cookieVal = getCookieValue(STORAGE_KEYS.ACCESS_TOKEN);
      return isTokenValid(cookieVal) ? cookieVal : null;
    }
    try {
      const localVal = window.localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const cookieVal = getCookieValue(STORAGE_KEYS.ACCESS_TOKEN);

      const validLocal = isTokenValid(localVal) ? localVal : null;
      const validCookie = isTokenValid(cookieVal) ? cookieVal : null;

      // Clean up corrupt or expired values
      if (localVal && !validLocal) {
        window.localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      }
      if (cookieVal && !validCookie) {
        deleteCookieValue(STORAGE_KEYS.ACCESS_TOKEN);
      }

      // Re-sync: if valid token exists in localStorage but missing from cookie (e.g. after clearing cookies)
      if (validLocal && !validCookie) {
        setCookieValue(STORAGE_KEYS.ACCESS_TOKEN, validLocal, SEVEN_DAYS_SECONDS);
        return validLocal;
      }

      // Re-sync: if valid token exists in cookie but missing from localStorage (e.g. after clearing localStorage)
      if (validCookie && !validLocal) {
        try {
          window.localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, validCookie);
        } catch {
          // Ignore storage quota
        }
        return validCookie;
      }

      return validLocal || validCookie || null;
    } catch {
      const cookieVal = getCookieValue(STORAGE_KEYS.ACCESS_TOKEN);
      return isTokenValid(cookieVal) ? cookieVal : null;
    }
  }

  public setAccessToken(accessToken: string): void {
    if (!this.isBrowser()) return;
    try {
      window.localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    } catch {
      // Ignore private browsing quota errors
    }
    setCookieValue(STORAGE_KEYS.ACCESS_TOKEN, accessToken, SEVEN_DAYS_SECONDS);
  }

  public setTokens(accessToken: string): void {
    this.setAccessToken(accessToken);
  }

  public clearTokens(): void {
    if (!this.isBrowser()) return;
    try {
      window.localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      window.localStorage.removeItem('flux_cached_user');
    } catch {
      // Ignore private browsing errors
    }
    deleteCookieValue(STORAGE_KEYS.ACCESS_TOKEN);
  }
}

// ─── 4. In-Memory Adapter (Preferred Secure In-Memory Strategy) ───────────────

export class InMemoryTokenAdapter implements TokenStorageAdapter {
  private accessToken: string | null = null;

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  public setAccessToken(accessToken: string): void {
    this.accessToken = accessToken;
  }

  public setTokens(accessToken: string): void {
    this.accessToken = accessToken;
  }

  public clearTokens(): void {
    this.accessToken = null;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        window.localStorage.removeItem('flux_cached_user');
      } catch (err) {
        logger.debug('[TokenStorage] Error removing storage keys', { err });
      }
      deleteCookieValue(STORAGE_KEYS.ACCESS_TOKEN);
    }
  }
}

// ─── 5. TokenStorage Manager ──────────────────────────────────────────────────

export class TokenStorage {
  private adapter: TokenStorageAdapter;

  constructor(tokenStorageAdapter?: TokenStorageAdapter) {
    this.adapter =
      tokenStorageAdapter ??
      (typeof window !== 'undefined'
        ? new LocalStorageTokenAdapter()
        : new InMemoryTokenAdapter());
  }

  public setAdapter(adapter: TokenStorageAdapter): void {
    this.adapter = adapter;
  }

  public getAccessToken(): string | null {
    return this.adapter.getAccessToken();
  }

  public getTokens(): AuthTokens {
    return {
      accessToken: this.getAccessToken(),
    };
  }

  public setAccessToken(token: string): void {
    this.adapter.setAccessToken(token);
  }

  public setTokens(accessToken: string): void {
    this.adapter.setTokens(accessToken);
  }

  public clearTokens(): void {
    this.adapter.clearTokens();
  }

  public hasAccessToken(): boolean {
    return Boolean(this.getAccessToken());
  }
}

// ─── 6. Global Singleton & Ergonomic Functional Exports ───────────────────────

export const tokenStorage = new TokenStorage();

/**
 * Retrieves the current access token.
 */
export function getAuthToken(): string | null {
  return tokenStorage.getAccessToken();
}

/**
 * Persists the access token.
 */
export function setAuthToken(token: string): void {
  tokenStorage.setAccessToken(token);
}

/**
 * Persists the access token.
 */
export function setTokens(accessToken: string): void {
  tokenStorage.setTokens(accessToken);
}

/**
 * Clears all authentication tokens from persistent storage.
 */
export function removeAuthToken(): void {
  tokenStorage.clearTokens();
}

/**
 * Checks whether an access token currently exists.
 */
export function hasAuthToken(): boolean {
  return tokenStorage.hasAccessToken();
}
