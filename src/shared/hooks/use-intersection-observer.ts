'use client';

import { useEffect, useState, useRef, type RefObject } from 'react';

export interface UseIntersectionObserverOptions {
  threshold?: number | number[];
  rootMargin?: string;
  root?: Element | Document | null;
  freezeOnceVisible?: boolean;
  enabled?: boolean;
  onChange?: (entry: IntersectionObserverEntry) => void;
}

export interface IntersectionObserverResult {
  isIntersecting: boolean;
  entry: IntersectionObserverEntry | null;
}

/**
 * Viewport Intersection Hook.
 * Observes element visibility relative to the viewport or container.
 *
 * @example
 * const containerRef = useRef<HTMLDivElement>(null);
 * const { isIntersecting } = useIntersectionObserver(containerRef, {
 *   freezeOnceVisible: true,
 *   rootMargin: '200px',
 * });
 */
export function useIntersectionObserver(
  targetRef: RefObject<HTMLElement | null> | HTMLElement | null,
  options: UseIntersectionObserverOptions = {},
): IntersectionObserverResult {
  const {
    threshold = 0,
    rootMargin = '0px',
    root = null,
    freezeOnceVisible = false,
    enabled = true,
    onChange,
  } = options;

  const [state, setState] = useState<IntersectionObserverResult>({
    isIntersecting: false,
    entry: null,
  });

  const frozenRef = useRef(false);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }

    const node = targetRef && 'current' in targetRef ? targetRef.current : targetRef;
    if (!node || frozenRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;

        const isElementIntersecting = entry.isIntersecting;

        setState({
          isIntersecting: isElementIntersecting,
          entry,
        });

        if (onChangeRef.current) {
          onChangeRef.current(entry);
        }

        if (isElementIntersecting && freezeOnceVisible) {
          frozenRef.current = true;
          observer.disconnect();
        }
      },
      {
        threshold,
        rootMargin,
        root,
      },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [targetRef, threshold, rootMargin, root, freezeOnceVisible, enabled]);

  return state;
}
