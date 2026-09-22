'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { EditorEventBus } from '../../../utils/editor.util';

export interface UsePdfZoomOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  pdfSpreadView?: boolean;
  pdfUrl?: string | null;
}

export function usePdfZoom({
  containerRef,
  pdfSpreadView = false,
  pdfUrl,
}: UsePdfZoomOptions) {
  const [scale, setScale] = useState(1.0);
  const [autoFit, setAutoFit] = useState(true);
  const [containerWidth, setContainerWidth] = useState(600);

  // ResizeObserver on the container to dynamically compute available width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let isInitial = true;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) {
          setContainerWidth((prevWidth) => {
            if (!isInitial && prevWidth > 0 && Math.abs(prevWidth - w) > 2) {
              setAutoFit(true);
            }
            return w;
          });
          isInitial = false;
        }
      }
    });

    observer.observe(el);
    return () => {
      observer.unobserve(el);
    };
  }, [containerRef, pdfUrl]);

  // Ideal scale to fit full page width comfortably inside the viewport
  const fittedScale = useMemo(() => {
    const available = containerWidth - 48;
    const targetWidth = pdfSpreadView ? 595 * 2 + 16 : 595;
    const s = available / targetWidth;
    return Math.max(0.3, Math.min(s, 2.5));
  }, [containerWidth, pdfSpreadView]);

  useEffect(() => {
    if (autoFit) {
      setScale(fittedScale);
    }
  }, [autoFit, fittedScale]);

  const handleZoomIn = useCallback(() => {
    setAutoFit(false);
    setScale((s) => Math.min(s + 0.15, 3.0));
  }, []);

  const handleZoomOut = useCallback(() => {
    setAutoFit(false);
    setScale((s) => Math.max(s - 0.15, 0.4));
  }, []);

  const handleResetZoom = useCallback(() => {
    setAutoFit(false);
    setScale(1.0);
  }, []);

  const handleToggleAutoFit = useCallback(() => {
    setAutoFit((prev) => {
      const next = !prev;
      if (next) setScale(fittedScale);
      return next;
    });
  }, [fittedScale]);

  const handleSetScale = useCallback((s: number) => {
    setAutoFit(false);
    setScale(s);
  }, []);

  // Listen to global zoom shortcut events
  useEffect(() => {
    const unsubZoomIn = EditorEventBus.on('flux:zoom-in', handleZoomIn);
    const unsubZoomOut = EditorEventBus.on('flux:zoom-out', handleZoomOut);
    const unsubFitWidth = EditorEventBus.on('flux:zoom-fit-width', () => {
      setAutoFit(true);
      setScale(fittedScale);
    });
    const unsubFitHeight = EditorEventBus.on('flux:zoom-fit-height', () => {
      setAutoFit(false);
      setScale(0.85);
    });
    return () => {
      unsubZoomIn();
      unsubZoomOut();
      unsubFitWidth();
      unsubFitHeight();
    };
  }, [fittedScale, handleZoomIn, handleZoomOut]);

  const showZoomGroup = containerWidth >= 480;
  const showUtilityGroup = containerWidth >= 380;

  return {
    scale,
    setScale,
    autoFit,
    setAutoFit,
    fittedScale,
    containerWidth,
    showZoomGroup,
    showUtilityGroup,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleToggleAutoFit,
    handleSetScale,
  };
}
