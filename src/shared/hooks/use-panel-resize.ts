'use client';

import type React from 'react';
import { useState, useRef, useCallback, useEffect } from 'react';

export interface UsePanelResizeOptions {
  /** Initial or controlled width of the panel in pixels */
  width: number;
  /** Callback fired continuously during drag and on release */
  setWidth: (width: number) => void;
  /** Direction of the handle relative to the panel ('right' for Left Sidebar, 'left' for Right Inspector) */
  direction?: 'left' | 'right';
  /** Minimum allowable width in px (default: 200) */
  minWidth?: number;
  /** Maximum allowable width in px (default: 640) */
  maxWidth?: number;
}

/**
 * Headless hook for fluid, requestAnimationFrame-debounced panel resizing.
 * Unifies sidebar (left panel) and inspector (right panel) border drag handles.
 */
export function usePanelResize({
  width,
  setWidth,
  direction = 'right',
  minWidth = 200,
  maxWidth = 640,
}: UsePanelResizeOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);
  const latestClientXRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  const clampWidth = useCallback(
    (val: number) => Math.min(Math.max(val, minWidth), maxWidth),
    [minWidth, maxWidth],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startXRef.current = e.clientX;
      startWidthRef.current = width;
      latestClientXRef.current = e.clientX;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [width],
  );

  useEffect(() => {
    if (!isDragging) return;

    const sign = direction === 'right' ? 1 : -1;
    const computeNextWidth = () =>
      clampWidth(startWidthRef.current + sign * (latestClientXRef.current - startXRef.current));

    const handleMouseMove = (e: MouseEvent) => {
      latestClientXRef.current = e.clientX;
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          setWidth(computeNextWidth());
          rafIdRef.current = null;
        });
      }
    };

    const handleMouseUp = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      setWidth(computeNextWidth());
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, setWidth, direction, clampWidth]);

  return {
    isDragging,
    handleMouseDown,
  };
}
