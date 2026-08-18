/**
 * use-media-query.test.tsx
 *
 * Unit tests for `useMediaQuery` powered by React 18 `useSyncExternalStore`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useMediaQuery,
  useIsMobile,
  useIsSm,
  useIsMd,
  useIsLg,
  useIsXl,
  usePrefersReducedMotion,
} from '@/shared/hooks/use-media-query';

describe('useMediaQuery', () => {
  let listeners: Map<string, Array<(e: MediaQueryListEvent) => void>>;
  let matchesMap: Map<string, boolean>;

  beforeEach(() => {
    listeners = new Map();
    matchesMap = new Map();

    window.matchMedia = vi.fn().mockImplementation((query: string) => {
      if (!listeners.has(query)) {
        listeners.set(query, []);
      }

      return {
        get matches() {
          return matchesMap.get(query) ?? false;
        },
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
          if (event === 'change') {
            listeners.get(query)?.push(handler);
          }
        }),
        removeEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
          if (event === 'change') {
            const list = listeners.get(query) || [];
            const idx = list.indexOf(handler);
            if (idx >= 0) list.splice(idx, 1);
          }
        }),
        dispatchEvent: vi.fn(),
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns initial matching state correctly', () => {
    matchesMap.set('(min-width: 768px)', true);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('returns false when query does not match', () => {
    matchesMap.set('(min-width: 1024px)', false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(false);
  });

  it('updates reactively when media query change event fires', () => {
    matchesMap.set('(min-width: 768px)', false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);

    // Simulate screen resize / media query event
    act(() => {
      matchesMap.set('(min-width: 768px)', true);
      const handlers = listeners.get('(min-width: 768px)') || [];
      handlers.forEach((h) => h({ matches: true, media: '(min-width: 768px)' } as MediaQueryListEvent));
    });

    expect(result.current).toBe(true);
  });

  it('evaluates Tailwind breakpoint shortcut hooks accurately', () => {
    matchesMap.set('(min-width: 640px)', true);
    matchesMap.set('(min-width: 768px)', true);
    matchesMap.set('(min-width: 1024px)', false);
    matchesMap.set('(min-width: 1280px)', false);
    matchesMap.set('(prefers-reduced-motion: reduce)', true);

    const { result: isMobile } = renderHook(() => useIsMobile());
    const { result: isSm } = renderHook(() => useIsSm());
    const { result: isMd } = renderHook(() => useIsMd());
    const { result: isLg } = renderHook(() => useIsLg());
    const { result: isXl } = renderHook(() => useIsXl());
    const { result: reducedMotion } = renderHook(() => usePrefersReducedMotion());

    expect(isMobile.current).toBe(false);
    expect(isSm.current).toBe(true);
    expect(isMd.current).toBe(true);
    expect(isLg.current).toBe(false);
    expect(isXl.current).toBe(false);
    expect(reducedMotion.current).toBe(true);
  });
});
