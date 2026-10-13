'use client';

/**
 * use-pdf-zoom.ts
 *
 * Responsive Viewport Zoom & Scaling Controller (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/preview/hooks/use-pdf-zoom.ts`
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import { useCompileStore } from '@/features/editor/store/compiler.store';
import { useViewerStore, type PdfFitMode } from '@/features/editor/store/viewer.store';

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
  const fitMode = useViewerStore((s) => s.fitMode);
  const setFitMode = useViewerStore((s) => s.setFitMode);
  const zoomIn = useViewerStore((s) => s.zoomIn);
  const zoomOut = useViewerStore((s) => s.zoomOut);
  const resetZoom = useViewerStore((s) => s.resetZoom);
  const [containerWidth, setContainerWidth] = useState(600);
  const [containerHeight, setContainerHeight] = useState(800);

  // ResizeObserver on the container to dynamically compute available width & height
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
          const h = Math.round(entry.contentRect.height);
          if (w > 0) {
            setContainerWidth((prevWidth) => (Math.abs(prevWidth - w) < 4 ? prevWidth : w));
            isInitial = false;
          }
          if (h > 0) {
            setContainerHeight((prevHeight) => (Math.abs(prevHeight - h) < 4 ? prevHeight : h));
          }
        }
      });
    });

    observer.observe(el);

    // Ctrl + Mouse Wheel / Pinch-to-zoom support (Overleaf Parity)
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          zoomIn();
        } else if (e.deltaY > 0) {
          zoomOut();
        }
      }
    };

    // Overleaf Parity: Keyboard shortcuts (Ctrl+0 fit width, Ctrl+9 fit height, Ctrl +/- zoom)
    let isHovered = false;
    const onMouseEnter = () => {
      isHovered = true;
    };
    const onMouseLeave = () => {
      isHovered = false;
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isHovered && document.activeElement !== el && !el.contains(document.activeElement)) {
        return;
      }
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === '0') {
        e.preventDefault();
        setFitMode('width');
        setAutoFit(true);
      } else if (e.key === '9') {
        e.preventDefault();
        setFitMode('height');
        setAutoFit(true);
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        zoomOut();
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('mouseenter', onMouseEnter);
    el.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      observer.unobserve(el);
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('mouseenter', onMouseEnter);
      el.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef, pdfUrl, zoomIn, zoomOut, setFitMode, setAutoFit]);

  // Ideal scale to fit page width / height / auto comfortably inside the viewport
  const fittedScale = useMemo(() => {
    const availableWidth = containerWidth;
    const availableHeight = containerHeight;
    const targetWidth = pdfSpreadView ? 595 * 2 + 16 : 595;
    const targetHeight = 842; // standard A4 pt height

    const widthScale = availableWidth / targetWidth;
    const heightScale = availableHeight > 50 ? (availableHeight - 48) / targetHeight : widthScale;

    let s: number;
    if (fitMode === 'height') {
      s = heightScale;
    } else if (fitMode === 'auto') {
      s = Math.min(widthScale, 1.25);
    } else {
      // default 'width'
      s = widthScale;
    }

    return Math.max(0.25, Math.min(s, 3.5));
  }, [containerWidth, containerHeight, pdfSpreadView, fitMode]);

  // Auto-fit when new compile finishes
  useEffect(() => {
    return useCompileStore.subscribe((state, prevState) => {
      if (state.lastCompiledAt !== prevState.lastCompiledAt && state.compileStatus === 'done') {
        setAutoFit(true);
      }
    });
  }, [setAutoFit]);

  useEffect(() => {
    if (pdfUrl) {
      setAutoFit(true);
    }
  }, [pdfUrl, setAutoFit]);

  useEffect(() => {
    if (autoFit) {
      setScale(fittedScale, false);
    }
  }, [autoFit, fittedScale, setScale]);

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

  const handleSetFitMode = useCallback(
    (mode: PdfFitMode) => {
      setFitMode(mode);
      setAutoFit(true);
    },
    [setFitMode, setAutoFit],
  );

  const handleSetScale = useCallback(
    (s: number) => {
      setScale(s);
    },
    [setScale],
  );

  // Listen to global zoom shortcut events
  useEffect(() => {
    const unsubZoomIn = editorCommandBus.subscribe('viewer:zoom-in', handleZoomIn);
    const unsubZoomOut = editorCommandBus.subscribe('viewer:zoom-out', handleZoomOut);
    const unsubFitWidth = editorCommandBus.subscribe('viewer:fit-width', () => {
      handleSetFitMode('width');
    });
    const unsubFitHeight = editorCommandBus.subscribe('viewer:fit-height', () => {
      handleSetFitMode('height');
    });
    return () => {
      unsubZoomIn();
      unsubZoomOut();
      unsubFitWidth();
      unsubFitHeight();
    };
  }, [handleZoomIn, handleZoomOut, handleSetFitMode]);

  const showZoomGroup = containerWidth >= 500;
  const showUtilityGroup = containerWidth >= 720;

  return {
    scale,
    setScale,
    autoFit,
    setAutoFit,
    fitMode,
    setFitMode,
    fittedScale,
    containerWidth,
    containerHeight,
    showZoomGroup,
    showUtilityGroup,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleToggleAutoFit,
    handleSetFitMode,
    handleSetScale,
  };
}
