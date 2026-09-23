'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useLibrarySidebarStore } from '../../store';

/**
 * Custom hook for smooth left-border drag resizing of the Inspector panel.
 * Constrained between min 300px and max 640px.
 */
export function useInspectorResize() {
  const inspectorWidth = useLibrarySidebarStore((s) => s.inspectorWidth);
  const setInspectorWidth = useLibrarySidebarStore((s) => s.setInspectorWidth);

  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(inspectorWidth);
  const latestClientXRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startXRef.current = e.clientX;
      startWidthRef.current = inspectorWidth;
      latestClientXRef.current = e.clientX;
    },
    [inspectorWidth],
  );

  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      latestClientXRef.current = e.clientX;
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          // Dragging left increases width, dragging right decreases width
          const delta = startXRef.current - latestClientXRef.current;
          const nextWidth = Math.min(Math.max(startWidthRef.current + delta, 300), 640);
          setInspectorWidth(nextWidth);
          rafIdRef.current = null;
        });
      }
    };

    const handleMouseUp = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      const delta = startXRef.current - latestClientXRef.current;
      const nextWidth = Math.min(Math.max(startWidthRef.current + delta, 300), 640);
      setInspectorWidth(nextWidth);
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, setInspectorWidth]);

  return {
    width: inspectorWidth,
    isDragging,
    handleMouseDown,
  };
}
