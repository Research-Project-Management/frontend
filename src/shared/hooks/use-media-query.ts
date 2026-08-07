'use client';

import { useState, useEffect } from 'react';

/**
 * Generic media query hook.
 *
 * @example
 * const isTablet = useMediaQuery('(min-width: 768px)');
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia(query);
    setMatches(media.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [query]);

  return matches;
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
