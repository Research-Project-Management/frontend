'use client';

/**
 * use-synchronized-scroll.ts
 *
 * Split-View Synchronized Dual Scrolling Hook with Overleaf Parity.
 * Location: `features/editor/ui/features/preview/hooks/use-synchronized-scroll.ts`
 *
 * Capabilities:
 * 1. Bidirectional lock-scrolling between Editor (CodeMirror 6 / Visual) and PDF Preview.
 * 2. Anti-feedback loop latch: Prevents ping-pong feedback cycles when one pane drives the other.
 * 3. Smooth coordinate-based positioning via SyncTeX geometry with graceful page/fraction fallbacks.
 * 4. Respects the user's `syncScroll` preference toggle (defaults to true).
 */

import { useEffect, useRef, useCallback } from 'react';
import { editorCommandBus, getActiveEditorEngine } from '@/features/editor/core';
import { compilerCoordinator } from '@/features/editor/subsystems/compiler/coordinator/compiler.coordinator';
import {
  resolveForwardDetail,
  resolveForward,
  resolveReverse,
  DEFAULT_PDF_PAGE_WIDTH_PT,
  DEFAULT_PDF_PAGE_HEIGHT_PT,
  type PdfPageDimensions,
  type SyncTeXMap,
} from '@/features/editor/subsystems/compiler/synctex/synctex-index';
import type { PdfSurfaceHandle } from '@/features/editor/subsystems/compiler/ui/PdfSurface';

export interface UseSynchronizedScrollProps {
  enabled: boolean;
  pdfSurfaceRef: React.RefObject<PdfSurfaceHandle | null>;
  synctexMapRef: React.MutableRefObject<SyncTeXMap | null>;
  numPages: number;
  scale: number;
  autoFit?: boolean;
  containerWidth?: number;
  activeFilePath?: string;
  pageDimensions?: PdfPageDimensions;
}

export function useSynchronizedScroll({
  enabled,
  pdfSurfaceRef,
  synctexMapRef,
  numPages,
  scale,
  autoFit,
  containerWidth,
  activeFilePath,
  pageDimensions,
}: UseSynchronizedScrollProps) {
  // Latch to track whether 'editor' or 'viewer' currently initiated the scroll
  const driverRef = useRef<'editor' | 'viewer' | null>(null);
  const latchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const widthPt =
    pageDimensions?.widthPt && pageDimensions.widthPt > 0
      ? pageDimensions.widthPt
      : DEFAULT_PDF_PAGE_WIDTH_PT;
  const heightPt =
    pageDimensions?.heightPt && pageDimensions.heightPt > 0
      ? pageDimensions.heightPt
      : DEFAULT_PDF_PAGE_HEIGHT_PT;

  // Set driver with a timeout to reset back to null once scroll settles
  const setDriverWithTimeout = useCallback((driver: 'editor' | 'viewer', durationMs = 250) => {
    driverRef.current = driver;
    if (latchTimerRef.current) {
      clearTimeout(latchTimerRef.current);
    }
    latchTimerRef.current = setTimeout(() => {
      driverRef.current = null;
    }, durationMs);
  }, []);

  // Cleanup latch timer and pending animation frames on unmount
  useEffect(() => {
    return () => {
      if (latchTimerRef.current) clearTimeout(latchTimerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // 1. Editor -> Viewer sync: Listen for 'sync:editor-scrolled' from CodeMirror or Visual Mode
  useEffect(() => {
    if (!enabled) return;

    const unsub = editorCommandBus.subscribe('sync:editor-scrolled', (cmd) => {
      // If viewer initiated the scroll, ignore this echo to prevent feedback loop
      if (driverRef.current === 'viewer') return;

      setDriverWithTimeout('editor', 250);

      const effectiveMap = synctexMapRef.current || compilerCoordinator.getSynctexMap();
      const effectiveScale =
        autoFit && containerWidth && containerWidth > 0
          ? containerWidth / widthPt
          : scale > 0
            ? scale
            : 1;

      // Try forward resolution with precise coordinates
      const detail = resolveForwardDetail(
        cmd.line,
        effectiveMap,
        activeFilePath,
        numPages || 1,
      );

      if (detail && detail.page) {
        const y = detail.y !== undefined ? detail.y * effectiveScale : 0;
        pdfSurfaceRef.current?.scrollToCoords?.(detail.page, y, 'auto');
      } else {
        // Fallback: estimate page number
        const page = resolveForward(
          cmd.line,
          effectiveMap,
          activeFilePath,
          numPages || 1,
        );
        if (page) {
          pdfSurfaceRef.current?.scrollToCoords?.(page, 0, 'auto');
        } else if (numPages > 0) {
          // Proportional scrolling fallback from Editor to Viewer (Overleaf parity)
          const fraction =
            cmd.fraction !== undefined
              ? cmd.fraction
              : cmd.totalLines && cmd.totalLines > 0
                ? cmd.line / cmd.totalLines
                : 0;
          const rawTargetPage = fraction * numPages;
          const targetPage = Math.min(numPages, Math.max(1, Math.floor(rawTargetPage) + 1));
          const pageFraction = rawTargetPage - Math.floor(rawTargetPage);
          const targetY = pageFraction * heightPt * effectiveScale;
          pdfSurfaceRef.current?.scrollToCoords?.(targetPage, targetY, 'auto');
        }
      }
    });

    return unsub;
  }, [
    enabled,
    synctexMapRef,
    activeFilePath,
    numPages,
    scale,
    autoFit,
    containerWidth,
    widthPt,
    heightPt,
    pdfSurfaceRef,
    setDriverWithTimeout,
  ]);

  // 2. Viewer -> Editor sync: Called by PdfSurface on continuous container scroll
  const handleViewerScroll = useCallback(
    (info: { page: number; y: number; fraction: number }) => {
      if (!enabled) return;
      // If editor initiated the scroll, ignore this echo to prevent feedback loop
      if (driverRef.current === 'editor') return;

      setDriverWithTimeout('viewer', 250);

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const effectiveMap = synctexMapRef.current || compilerCoordinator.getSynctexMap();
        if (!effectiveMap) {
          // Proportional scrolling fallback from Viewer to Editor (Overleaf parity)
          const activeEngine = getActiveEditorEngine();
          const totalLines = activeEngine?.getLineCount?.() || 100;
          if (numPages > 0) {
            const overallFraction = (info.page - 1 + (info.fraction ?? 0)) / numPages;
            const targetLine = Math.min(
              totalLines,
              Math.max(1, Math.round(overallFraction * totalLines))
            );
            editorCommandBus.dispatch({
              type: 'editor:scroll-to-line',
              line: targetLine,
              smooth: true,
            });
          }
          return;
        }

        const resolved = resolveReverse(
          info.fraction,
          info.page,
          effectiveMap,
          72, // standard left margin in pt
          info.y,
          heightPt,
        );

        if (resolved?.line) {
          editorCommandBus.dispatch({
            type: 'editor:scroll-to-line',
            line: resolved.line,
            smooth: true,
          });
        }
      });
    },
    [enabled, synctexMapRef, numPages, heightPt, setDriverWithTimeout],
  );

  return {
    handleViewerScroll,
  };
}
