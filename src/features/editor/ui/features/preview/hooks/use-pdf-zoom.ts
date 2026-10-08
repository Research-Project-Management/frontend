'use client';

/**
 * use-pdf-zoom.ts
 *
 * Responsive Viewport Zoom & Scaling Controller (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/preview/hooks/use-pdf-zoom.ts`
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { editorCommandBus } from '../../../../coordinators/command-bus';
import { useCompileStore } from '../../../../store/compiler.store';
import { useViewerStore } from '../../../../store/viewer.store';

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
  const scale = useViewerStore((s) => s.scale);
  const setScale = useViewerStore((s) => s.setScale);
  const autoFit = useViewerStore((s) => s.autoFit);
  const setAutoFit = useViewerStore((s) => s.setAutoFit);
  const zoomIn = useViewerStore((s) => s.zoomIn);
  const zoomOut = useViewerStore((s) => s.zoomOut);
  const resetZoom = useViewerStore((s) => s.resetZoom);
  const [containerWidth, setContainerWidth] = useState(600);

  // ResizeObserver on the container to dynamically compute available width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let isInitial = true;
    let rafId: number | null = null;
    const observer = new ResizeObserver((entries) => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        for (const entry of entries) {
          const w = Math.round(entry.contentRect.width);
          if (w > 0) {
            setContainerWidth((prevWidth) => {
              if (Math.abs(prevWidth - w) < 4) return prevWidth;
              if (!isInitial) {
                setAutoFit(true);
              }
              return w;
            });
            isInitial = false;
          }
        }
      });
    });

    observer.observe(el);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      observer.unobserve(el);
    };
  }, [containerRef, pdfUrl]);

  // Ideal scale to fit full page width comfortably inside the viewport
  const fittedScale = useMemo(() => {
    const available = containerWidth;
    const targetWidth = pdfSpreadView ? 595 * 2 + 16 : 595;
    const s = available / targetWidth;
    return Math.max(0.3, Math.min(s, 2.5));
  }, [containerWidth, pdfSpreadView]);

  // Auto-fit when new compile finishes
  useEffect(() => {
    return useCompileStore.subscribe((state, prevState) => {
      if (state.lastCompiledAt !== prevState.lastCompiledAt && state.compileStatus === 'done') {
        setAutoFit(true);
      }
    });
  }, []);

  useEffect(() => {
    if (pdfUrl) {
      setAutoFit(true);
    }
  }, [pdfUrl]);

  useEffect(() => {
    if (autoFit) {
      setScale(fittedScale);
    }
  }, [autoFit, fittedScale]);

  const handleZoomIn = useCallback(() => {
    zoomIn();
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut();
  }, [zoomOut]);

  const handleResetZoom = useCallback(() => {
    resetZoom();
  }, [resetZoom]);

  const handleToggleAutoFit = useCallback(() => {
    const next = !autoFit;
    setAutoFit(next);
    if (next) setScale(fittedScale);
  }, [autoFit, setAutoFit, setScale, fittedScale]);

  const handleSetScale = useCallback((s: number) => {
    setScale(s);
  }, [setScale]);

  // Listen to global zoom shortcut events
  useEffect(() => {
    const unsubZoomIn = editorCommandBus.subscribe('viewer:zoom-in', handleZoomIn);
    const unsubZoomOut = editorCommandBus.subscribe('viewer:zoom-out', handleZoomOut);
    const unsubFitWidth = editorCommandBus.subscribe('viewer:fit-width', () => {
      setAutoFit(true);
      setScale(fittedScale);
    });
    const unsubFitHeight = editorCommandBus.subscribe('viewer:fit-height', () => {
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

  const showZoomGroup = containerWidth >= 500;
  const showUtilityGroup = containerWidth >= 720;

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
