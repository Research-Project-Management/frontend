'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';

export interface DebouncedFunction<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): void;
  cancel: () => void;
  flush: () => void;
  isPending: () => boolean;
}

export interface DebounceOptions {
  leading?: boolean;
  trailing?: boolean;
  maxWait?: number;
}

export interface ThrottleOptions {
  leading?: boolean;
  trailing?: boolean;
}

/**
 * Debounces a reactive state value.
 *
 * @example
 * const debouncedSearch = useDebounce(searchQuery, 300);
 */
export function useDebounce<T>(value: T, delay = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debounces an event handler or callback function with full lifecycle controls.
 *
 * @example
 * const handleSearch = useDebouncedCallback((query: string) => {
 *   fetchResults(query);
 * }, 300);
 *
 * // Controls: handleSearch.cancel(), handleSearch.flush(), handleSearch.isPending()
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay = 500,
  options: DebounceOptions = {},
): DebouncedFunction<T> {
  const { leading = false, trailing = true, maxWait } = options;

  const callbackRef = useRef<T>(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastArgsRef = useRef<Parameters<T> | null>(null);
  const isPendingRef = useRef(false);

  // Keep latest callback reference to avoid stale closures
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (maxWaitTimerRef.current) {
      clearTimeout(maxWaitTimerRef.current);
      maxWaitTimerRef.current = null;
    }
    lastArgsRef.current = null;
    isPendingRef.current = false;
  }, []);

  const flush = useCallback(() => {
    if (timerRef.current && lastArgsRef.current) {
      const args = lastArgsRef.current;
      cancel();
      callbackRef.current(...args);
    } else {
      cancel();
    }
  }, [cancel]);

  const isPending = useCallback(() => isPendingRef.current, []);

  // Cleanup timers on component unmount
  useEffect(() => {
    return cancel;
  }, [cancel]);

  const debounced = useCallback(
    (...args: Parameters<T>) => {
      lastArgsRef.current = args;
      isPendingRef.current = true;

      const callLeading = leading && !timerRef.current;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      if (callLeading) {
        callbackRef.current(...args);
      }

      timerRef.current = setTimeout(() => {
        if (trailing && (!leading || lastArgsRef.current)) {
          if (lastArgsRef.current) {
            callbackRef.current(...lastArgsRef.current);
          }
        }
        cancel();
      }, delay);

      if (maxWait && !maxWaitTimerRef.current) {
        maxWaitTimerRef.current = setTimeout(() => {
          flush();
        }, maxWait);
      }
    },
    [delay, leading, trailing, maxWait, cancel, flush],
  );

  return useMemo(() => {
    return Object.assign(debounced, { cancel, flush, isPending });
  }, [debounced, cancel, flush, isPending]);
}

/**
 * Throttles an event handler to run at most once per interval.
 *
 * @example
 * const handleScroll = useThrottledCallback(() => trackScrollPosition(), 100);
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  interval = 300,
  options: ThrottleOptions = {},
): DebouncedFunction<T> {
  const { leading = true, trailing = true } = options;
  return useDebouncedCallback(callback, interval, {
    leading,
    trailing,
    maxWait: interval,
  });
}

