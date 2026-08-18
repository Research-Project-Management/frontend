/**
 * use-intersection-observer.test.tsx
 *
 * Unit tests for `useIntersectionObserver` hook.
 */

import React, { useRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useIntersectionObserver } from '@/shared/hooks/use-intersection-observer';

let observerCallback: IntersectionObserverCallback;
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '0px';
  readonly thresholds: ReadonlyArray<number> = [0];

  constructor(callback: IntersectionObserverCallback) {
    observerCallback = callback;
  }

  observe = mockObserve;
  disconnect = mockDisconnect;
  unobserve = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);
}

function TestObserverComponent({
  freezeOnceVisible = false,
  onChange,
}: {
  freezeOnceVisible?: boolean;
  onChange?: (entry: IntersectionObserverEntry) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { isIntersecting } = useIntersectionObserver(ref, {
    freezeOnceVisible,
    onChange,
  });

  return (
    <div ref={ref} data-testid="target">
      {isIntersecting ? 'Visible' : 'Hidden'}
    </div>
  );
}

describe('useIntersectionObserver', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    mockObserve.mockClear();
    mockDisconnect.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('observes the target element on mount', () => {
    const { getByTestId } = render(<TestObserverComponent />);
    expect(mockObserve).toHaveBeenCalledWith(getByTestId('target'));
  });

  it('updates isIntersecting state when element enters viewport', () => {
    const { getByTestId } = render(<TestObserverComponent />);
    expect(getByTestId('target').textContent).toBe('Hidden');

    act(() => {
      observerCallback(
        [
          {
            isIntersecting: true,
            target: getByTestId('target'),
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
    });

    expect(getByTestId('target').textContent).toBe('Visible');
  });

  it('disconnects and freezes state when freezeOnceVisible is true', () => {
    const { getByTestId } = render(<TestObserverComponent freezeOnceVisible={true} />);

    act(() => {
      observerCallback(
        [
          {
            isIntersecting: true,
            target: getByTestId('target'),
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
    });

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    expect(getByTestId('target').textContent).toBe('Visible');
  });
});
