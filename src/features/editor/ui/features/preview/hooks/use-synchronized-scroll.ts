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
import { editorCommandBus } from '../../../../coordinators/command-bus';
import { compilerCoordinator } from '../../../../coordinators/compiler.coordinator';
import { LatexCompilerEngine } from '@/features/editor/coordinators/services/latex-compiler-engine.service';
import type { SyncTeXMap } from '@/features/editor/domain';
import type { SurfaceHandle } from '../PdfSurface';

export interface UseSynchronizedScrollProps {
  enabled: boolean;
  pdfSurfaceRef: React.RefObject<SurfaceHandle | null>;
  synctexMapRef: React.MutableRefObject<SyncTeXMap | null>;
  numPages: number;
  scale: number;
  autoFit?: boolean;
  containerWidth?: number;
  activeFilePath?: string;
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
}: UseSynchronizedScrollProps) {
  // Latch to track whether 'editor' or 'viewer' currently initiated the scroll
  const driverRef = useRef<'editor' | 'viewer' | null>(null);
  const latchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

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
          ? containerWidth / 595
          : scale > 0
            ? scale
            : 1;

      // Try forward resolution with precise coordinates
      const detail = LatexCompilerEngine.resolveForwardDetail(
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
        const page = LatexCompilerEngine.resolveForward(
          cmd.line,
          effectiveMap,
          activeFilePath,
          numPages || 1,
        );
        if (page) {
          pdfSurfaceRef.current?.scrollToCoords?.(page, 0, 'auto');
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
        if (!effectiveMap) return;

        const resolved = LatexCompilerEngine.resolveReverse(
          info.fraction,
          info.page,
          effectiveMap,
          72, // standard left margin in pt
          info.y,
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
    [enabled, synctexMapRef, setDriverWithTimeout],
  );

  return {
    handleViewerScroll,
  };
}
