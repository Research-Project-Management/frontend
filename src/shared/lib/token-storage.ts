/**
 * Centralized authentication token storage adapter and lifecycle manager.
 * Supports swappable storage strategies (LocalStorage vs. InMemory) with SSR safety
 * and legacy token key fallback.
 */

// ─── 1. Types & Interface ─────────────────────────────────────────────────────

export interface AuthTokens {
  readonly accessToken: string | null;
  readonly refreshToken: string | null;
}

export interface TokenStorageAdapter {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  setTokens(tokens: { accessToken: string; refreshToken?: string }): void;
  setAccessToken(accessToken: string): void;
  setRefreshToken(refreshToken: string): void;
  clearTokens(): void;
}

// ─── 2. Storage Keys ──────────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  LEGACY_TOKEN: 'token',
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
} as const;

// ─── 3. LocalStorage Adapter (Browser Runtime) ────────────────────────────────

export class LocalStorageTokenAdapter implements TokenStorageAdapter {
  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  public getAccessToken(): string | null {
    if (!this.isBrowser()) return null;
    try {
      return (
        window.localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) ||
        window.localStorage.getItem(STORAGE_KEYS.LEGACY_TOKEN) ||
        null
      );
    } catch {
      return null;
    }
  }

  public getRefreshToken(): string | null {
    if (!this.isBrowser()) return null;
    try {
      return window.localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN) || null;
    } catch {
      return null;
    }
  }

  public setAccessToken(accessToken: string): void {
    if (!this.isBrowser()) return;
    try {
      window.localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      window.localStorage.setItem(STORAGE_KEYS.LEGACY_TOKEN, accessToken);
    } catch {
      // Ignore private browsing quota errors
    }
  }

  public setRefreshToken(refreshToken: string): void {
    if (!this.isBrowser()) return;
    try {
      window.localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    } catch {
      // Ignore private browsing quota errors
    }
  }

  public setTokens(tokens: { accessToken: string; refreshToken?: string }): void {
    this.setAccessToken(tokens.accessToken);
    if (tokens.refreshToken !== undefined) {
      this.setRefreshToken(tokens.refreshToken);
    }
  }

  public clearTokens(): void {
    if (!this.isBrowser()) return;
    try {
      window.localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      window.localStorage.removeItem(STORAGE_KEYS.LEGACY_TOKEN);
      window.localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    } catch {
      // Ignore private browsing errors
    }
  }
}

// ─── 4. In-Memory Adapter (SSR & Testing Runtime) ─────────────────────────────

export class InMemoryTokenAdapter implements TokenStorageAdapter {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  public getRefreshToken(): string | null {
    return this.refreshToken;
  }

  public setAccessToken(accessToken: string): void {
    this.accessToken = accessToken;
  }

  public setRefreshToken(refreshToken: string): void {
    this.refreshToken = refreshToken;
  }

  public setTokens(tokens: { accessToken: string; refreshToken?: string }): void {
    this.accessToken = tokens.accessToken;
    if (tokens.refreshToken !== undefined) {
      this.refreshToken = tokens.refreshToken;
    }
  }

  public clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
  }
}

// ─── 5. TokenStorage Manager ──────────────────────────────────────────────────

export class TokenStorage {
  private adapter: TokenStorageAdapter;

  constructor(adapter?: TokenStorageAdapter) {
    this.adapter = adapter ?? new LocalStorageTokenAdapter();
  }

  public setAdapter(adapter: TokenStorageAdapter): void {
    this.adapter = adapter;
  }

  public getAccessToken(): string | null {
    return this.adapter.getAccessToken();
  }

  public getRefreshToken(): string | null {
    return this.adapter.getRefreshToken();
  }

  public getTokens(): AuthTokens {
    return {
      accessToken: this.getAccessToken(),
      refreshToken: this.getRefreshToken(),
    };
  }

  public setAccessToken(token: string): void {
    this.adapter.setAccessToken(token);
  }

  public setRefreshToken(token: string): void {
    this.adapter.setRefreshToken(token);
  }

  public setTokens(
    tokensOrAccess: { accessToken: string; refreshToken?: string } | string,
    optionalRefresh?: string,
  ): void {
    if (typeof tokensOrAccess === 'string') {
      this.adapter.setTokens({
        accessToken: tokensOrAccess,
        refreshToken: optionalRefresh,
      });
    } else {
      this.adapter.setTokens(tokensOrAccess);
    }
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
 * Retrieves the current access token (checking both modern and legacy keys).
 */
export function getAuthToken(): string | null {
  return tokenStorage.getAccessToken();
}

/**
 * Retrieves the current refresh token.
 */
export function getRefreshToken(): string | null {
  return tokenStorage.getRefreshToken();
}

/**
 * Persists the access token.
 */
export function setAuthToken(token: string): void {
  tokenStorage.setAccessToken(token);
}

/**
 * Persists the refresh token.
 */
export function setRefreshToken(token: string): void {
  tokenStorage.setRefreshToken(token);
}

/**
 * Persists both access and refresh tokens atomically.
 */
export function setTokens(accessToken: string, refreshToken?: string): void {
  tokenStorage.setTokens(accessToken, refreshToken);
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
