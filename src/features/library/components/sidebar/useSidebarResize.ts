import { useState, useRef, useCallback, useEffect } from 'react';

export function useSidebarResize(width: number, setWidth: (w: number) => void) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startXRef.current = e.clientX;
      startWidthRef.current = width;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [width]
  );

  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (rafIdRef.current !== null) return;
      const clientX = e.clientX;
      rafIdRef.current = requestAnimationFrame(() => {
        const deltaX = clientX - startXRef.current;
        setWidth(startWidthRef.current + deltaX);
        rafIdRef.current = null;
      });
    };

    const handleMouseUp = () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
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
  }, [isDragging, setWidth]);

  return {
    isDragging,
    handleMouseDown,
  };
}
