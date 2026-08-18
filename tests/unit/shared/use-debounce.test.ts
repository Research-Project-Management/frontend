/**
 * use-debounce.test.ts
 *
 * Unit tests for `useDebounce`, `useDebouncedCallback`, and `useThrottledCallback`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useDebounce,
  useDebouncedCallback,
  useThrottledCallback,
} from '@/shared/hooks/use-debounce';

describe('useDebounce & Callback Controls', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('debounces a reactive value correctly', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'initial', delay: 300 },
    });

    expect(result.current).toBe('initial');

    rerender({ value: 'updated', delay: 300 });
    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('updated');
  });

  it('debounces a callback function and executes trailing call', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 300));

    act(() => {
      result.current('first');
      result.current('second');
      result.current('third');
    });

    expect(result.current.isPending()).toBe(true);
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('third');
    expect(result.current.isPending()).toBe(false);
  });

  it('supports cancel() on pending debounced calls', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 300));

    act(() => {
      result.current('call');
    });
    expect(result.current.isPending()).toBe(true);

    act(() => {
      result.current.cancel();
    });
    expect(result.current.isPending()).toBe(false);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(callback).not.toHaveBeenCalled();
  });

  it('supports flush() to trigger execution immediately', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 300));

    act(() => {
      result.current('urgent');
    });

    act(() => {
      result.current.flush();
    });

    expect(callback).toHaveBeenCalledWith('urgent');
    expect(result.current.isPending()).toBe(false);
  });

  it('throttles callbacks during rapid calls', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(callback, 200));

    act(() => {
      result.current(1);
      result.current(2);
      result.current(3);
    });

    // Leading call executed immediately
    expect(callback).toHaveBeenCalledWith(1);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Trailing call executed with latest argument
    expect(callback).toHaveBeenCalledWith(3);
  });
});
