import { describe, it, expect, beforeEach } from 'vitest';
import {
  TokenStorage,
  InMemoryTokenAdapter,
  LocalStorageTokenAdapter,
  tokenStorage,
  getAuthToken,
  getRefreshToken,
  setAuthToken,
  setRefreshToken,
  setTokens,
  removeAuthToken,
  hasAuthToken,
} from '@/shared/lib/token-storage';

describe('TokenStorage Deep Module (token-storage.ts)', () => {
  beforeEach(() => {
    tokenStorage.clearTokens();
  });

  it('stores and retrieves access and refresh tokens using functional exports', () => {
    expect(getAuthToken()).toBeNull();
    expect(hasAuthToken()).toBe(false);

    setAuthToken('access-token-123');
    expect(getAuthToken()).toBe('access-token-123');
    expect(hasAuthToken()).toBe(true);

    setRefreshToken('refresh-token-456');
    expect(getRefreshToken()).toBe('refresh-token-456');

    removeAuthToken();
    expect(getAuthToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(hasAuthToken()).toBe(false);
  });

  it('supports atomic setTokens call', () => {
    setTokens('token-a', 'token-b');
    expect(getAuthToken()).toBe('token-a');
    expect(getRefreshToken()).toBe('token-b');
  });

  it('works with swappable InMemoryTokenAdapter for SSR and testing', () => {
    const memAdapter = new InMemoryTokenAdapter();
    const storage = new TokenStorage(memAdapter);

    storage.setTokens({ accessToken: 'ssr-token', refreshToken: 'ssr-refresh' });
    expect(storage.getTokens()).toEqual({
      accessToken: 'ssr-token',
      refreshToken: 'ssr-refresh',
    });

    storage.clearTokens();
    expect(storage.getAccessToken()).toBeNull();
  });
});
