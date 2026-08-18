import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '@/shared/hooks/use-local-storage';

describe('useLocalStorage Deep Hook (useSyncExternalStore)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns initialValue when localStorage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'default-value'));
    expect(result.current[0]).toBe('default-value');
  });

  it('updates state and persists JSON to localStorage', () => {
    const { result } = renderHook(() =>
      useLocalStorage<{ count: number }>('counter-key', { count: 0 }),
    );

    act(() => {
      result.current[1]({ count: 5 });
    });

    expect(result.current[0]).toEqual({ count: 5 });
    expect(localStorage.getItem('counter-key')).toBe(JSON.stringify({ count: 5 }));
  });

  it('supports functional state updates (prev => next)', () => {
    const { result } = renderHook(() => useLocalStorage('num-key', 10));

    act(() => {
      result.current[1]((prev) => prev + 5);
    });

    expect(result.current[0]).toBe(15);
    expect(localStorage.getItem('num-key')).toBe('15');
  });

  it('removes value and resets to initialValue', () => {
    const { result } = renderHook(() => useLocalStorage('theme-key', 'light'));

    act(() => {
      result.current[1]('dark');
    });
    expect(result.current[0]).toBe('dark');

    act(() => {
      result.current[2]();
    });

    expect(result.current[0]).toBe('light');
    expect(localStorage.getItem('theme-key')).toBeNull();
  });

  it('synchronizes multiple hook instances on the same key in real-time', () => {
    const { result: hook1 } = renderHook(() => useLocalStorage('shared-pref', 'A'));
    const { result: hook2 } = renderHook(() => useLocalStorage('shared-pref', 'A'));

    expect(hook1.current[0]).toBe('A');
    expect(hook2.current[0]).toBe('A');

    act(() => {
      hook1.current[1]('B');
    });

    expect(hook1.current[0]).toBe('B');
    expect(hook2.current[0]).toBe('B');
  });
});
