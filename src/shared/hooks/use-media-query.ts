'use client';

import { useSyncExternalStore } from 'react';

export const MEDIA_QUERY_MOBILE = '(max-width: 767px)';
export const MEDIA_QUERY_TABLET = '(max-width: 1023px)';

/**
 * Subscribe to a CSS media query change event safely (SSR-safe).
 */
export function subscribeMediaQuery(
  query: string,
  onChange: (matches: boolean) => void,
): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const mql = window.matchMedia(query);
  const handler = (event: MediaQueryListEvent) => onChange(event.matches);
  mql.addEventListener('change', handler);
  return () => mql.removeEventListener('change', handler);
}

/**
 * SSR-safe reactive media query hook backed by `useSyncExternalStore`.
 */
export function useMediaQuery(query: string, serverFallback = false): boolean {
  return useSyncExternalStore(
    (onStoreChange) => subscribeMediaQuery(query, () => onStoreChange()),
    () =>
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(query).matches
        : serverFallback,
    () => serverFallback,
  );
}

/** True when viewport width <= 767px (`< md`). */
export function useIsMobile(): boolean {
  return useMediaQuery(MEDIA_QUERY_MOBILE);
}

/** True when viewport width <= 1023px (`< lg`). */
export function useIsTablet(): boolean {
  return useMediaQuery(MEDIA_QUERY_TABLET);
}
