import { describe, it, expect } from 'vitest';
import { isTokenValid, getSafeRedirectUrl } from '@/shared/utils/auth-token.util';

describe('auth-token.util', () => {
  describe('isTokenValid', () => {
    it('returns false for null, undefined, empty, or placeholder strings', () => {
      expect(isTokenValid(null)).toBe(false);
      expect(isTokenValid(undefined)).toBe(false);
      expect(isTokenValid('')).toBe(false);
      expect(isTokenValid('   ')).toBe(false);
      expect(isTokenValid('undefined')).toBe(false);
      expect(isTokenValid('null')).toBe(false);
      expect(isTokenValid('[object Object]')).toBe(false);
      expect(isTokenValid('not.a.valid.jwt.token')).toBe(false);
    });

    it('returns false for expired JWT tokens', () => {
      // exp is year 2018 (1514764800)
      const expiredPayload = btoa(JSON.stringify({ sub: 'user1', exp: 1514764800 }));
      const expiredToken = `eyJhbGciOiJIUzI1NiJ9.${expiredPayload}.signature`;
      expect(isTokenValid(expiredToken)).toBe(false);
    });

    it('returns true for valid, unexpired JWT tokens', () => {
      // exp far in the future
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const validPayload = btoa(JSON.stringify({ sub: 'user1', exp: futureExp }));
      const validToken = `eyJhbGciOiJIUzI1NiJ9.${validPayload}.signature`;
      expect(isTokenValid(validToken)).toBe(true);
    });
  });

  describe('getSafeRedirectUrl', () => {
    it('defaults to fallback if null, empty, or undefined', () => {
      expect(getSafeRedirectUrl(null, '/home')).toBe('/home');
      expect(getSafeRedirectUrl(undefined, '/home')).toBe('/home');
      expect(getSafeRedirectUrl('', '/home')).toBe('/home');
    });

    it('prevents open redirect via protocol-relative URLs', () => {
      expect(getSafeRedirectUrl('//malicious.com', '/home')).toBe('/home');
      expect(getSafeRedirectUrl('https://malicious.com', '/home')).toBe('/home');
      expect(getSafeRedirectUrl('http://malicious.com', '/home')).toBe('/home');
    });

    it('prevents self-redirect loops to login or register', () => {
      expect(getSafeRedirectUrl('/login', '/home')).toBe('/home');
      expect(getSafeRedirectUrl('/login?redirect=/home', '/home')).toBe('/home');
      expect(getSafeRedirectUrl('/register', '/home')).toBe('/home');
      expect(getSafeRedirectUrl('/register?redirect=/home', '/home')).toBe('/home');
    });

    it('allows valid internal application paths', () => {
      expect(getSafeRedirectUrl('/home', '/home')).toBe('/home');
      expect(getSafeRedirectUrl('/projects/123', '/home')).toBe('/projects/123');
      expect(getSafeRedirectUrl('/settings/profile', '/home')).toBe('/settings/profile');
    });
  });
});
