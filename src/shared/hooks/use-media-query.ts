'use client';

import { useSyncExternalStore, useCallback } from 'react';

/**
 * Generic media query hook powered by React 18 `useSyncExternalStore`.
 * Eliminates Next.js SSR hydration mismatches and redundant post-mount re-renders.
 *
 * @example
 * const isTablet = useMediaQuery('(min-width: 768px)');
 */
export function useMediaQuery(query: string, ssrDefault = false): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) {
        return () => {};
      }

      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener('change', callback);

      return () => {
        mediaQueryList.removeEventListener('change', callback);
      };
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return ssrDefault;
    }
    return window.matchMedia(query).matches;
  }, [query, ssrDefault]);

  const getServerSnapshot = useCallback(() => ssrDefault, [ssrDefault]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ─── Tailwind Breakpoint Shortcuts ────────────────────────────────────────────

/** < 640px */
export const useIsMobile = () => !useMediaQuery('(min-width: 640px)');

/** ≥ 640px */
export const useIsSm = () => useMediaQuery('(min-width: 640px)');

/** ≥ 768px */
export const useIsMd = () => useMediaQuery('(min-width: 768px)');

/** ≥ 1024px */
export const useIsLg = () => useMediaQuery('(min-width: 1024px)');

/** ≥ 1280px */
export const useIsXl = () => useMediaQuery('(min-width: 1280px)');

/** Prefers reduced motion */
export const usePrefersReducedMotion = () =>
  useMediaQuery('(prefers-reduced-motion: reduce)');

