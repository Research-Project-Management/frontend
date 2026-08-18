'use client';

import { useSyncExternalStore, useCallback, useRef } from 'react';

// ─── 1. In-Memory Event Dispatcher (Same-Tab Sync) ────────────────────────────

const LOCAL_STORAGE_EVENT = 'research_local_storage_sync';

interface LocalStorageEventDetail {
  key: string;
}

function dispatchStorageEvent(key: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<LocalStorageEventDetail>(LOCAL_STORAGE_EVENT, {
        detail: { key },
      }),
    );
  }
}

// ─── 2. Subscription Hook for useSyncExternalStore ───────────────────────────

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleCustomEvent = (e: Event) => {
    callback();
  };

  const handleStorageEvent = (e: StorageEvent) => {
    callback();
  };

  window.addEventListener('storage', handleStorageEvent);
  window.addEventListener(LOCAL_STORAGE_EVENT, handleCustomEvent);

  return () => {
    window.removeEventListener('storage', handleStorageEvent);
    window.removeEventListener(LOCAL_STORAGE_EVENT, handleCustomEvent);
  };
}

// ─── 3. Deep useLocalStorage Hook ─────────────────────────────────────────────

/**
 * Persist state to localStorage with React 18 useSyncExternalStore.
 * - SSR-safe with deterministic server snapshots (eliminates hydration mismatches).
 * - Real-time synchronization across browser tabs and components in the same tab.
 * - Error-shielded against private browsing quota exceptions and JSON parse failures.
 *
 * @example
 * const [theme, setTheme, removeTheme] = useLocalStorage('app-theme', 'light');
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // Cache the last parsed value to ensure snapshot reference equality
  const cacheRef = useRef<{ raw: string | null; value: T }>({
    raw: null,
    value: initialValue,
  });

  const getSnapshot = useCallback((): T => {
    if (typeof window === 'undefined') return initialValue;

    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) {
        cacheRef.current = { raw: null, value: initialValue };
        return initialValue;
      }

      // If raw string hasn't changed, return cached reference for React memoization
      if (raw === cacheRef.current.raw) {
        return cacheRef.current.value;
      }

      const parsed = JSON.parse(raw) as T;
      cacheRef.current = { raw, value: parsed };
      return parsed;
    } catch {
      return initialValue;
    }
  }, [key, initialValue]);

  const getServerSnapshot = useCallback((): T => {
    return initialValue;
  }, [initialValue]);

  const storeValue = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      if (typeof window === 'undefined') return;

      try {
        const current = getSnapshot();
        const next = value instanceof Function ? value(current) : value;

        window.localStorage.setItem(key, JSON.stringify(next));
        cacheRef.current = { raw: JSON.stringify(next), value: next };
        dispatchStorageEvent(key);
      } catch (error) {
        console.warn(`useLocalStorage: failed to persist key "${key}"`, error);
      }
    },
    [key, getSnapshot],
  );

  const removeValue = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.removeItem(key);
      cacheRef.current = { raw: null, value: initialValue };
      dispatchStorageEvent(key);
    } catch (error) {
      console.warn(`useLocalStorage: failed to remove key "${key}"`, error);
    }
  }, [key, initialValue]);

  return [storeValue, setValue, removeValue];
}
