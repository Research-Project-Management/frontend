import React, { useEffect, useRef, useState } from 'react';

/**
 * useContainerWidth
 * Hook to measure the pixel width of a container element in real-time using ResizeObserver.
 */
export function useContainerWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState<number>(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Initial measurement
    const initialWidth = el.getBoundingClientRect().width;
    if (initialWidth > 0) {
      setWidth(initialWidth);
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentBoxSize) {
          const borderBoxWidth = entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
          setWidth(borderBoxWidth);
        } else {
          setWidth(entry.contentRect.width);
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}
