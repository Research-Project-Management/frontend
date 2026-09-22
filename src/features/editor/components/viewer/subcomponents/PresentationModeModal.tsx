'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page } from 'react-pdf';
import {
  ChevronLeft,
  ChevronRight,
  Minimize2,
  Moon,
  Sun,
  Loader2,
  Crosshair,
  Maximize2,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface PresentationModeModalProps {
  pdfUrl: string | null;
  initialPage?: number;
  numPages: number;
  isOpen: boolean;
  onClose: () => void;
  onPageChange?: (page: number) => void;
}

export function PresentationModeModal({
  pdfUrl,
  initialPage = 1,
  numPages,
  isOpen,
  onClose,
  onPageChange,
}: PresentationModeModalProps) {
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [isBlackout, setIsBlackout] = useState(false);
  const [isWhiteout, setIsWhiteout] = useState(false);
  const [isLaserPointer, setIsLaserPointer] = useState(false);
  const [laserPos, setLaserPos] = useState<{ x: number; y: number } | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const [containerDimensions, setContainerDimensions] = useState<{ width: number; height: number }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync initial page when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(initialPage);
      setIsBlackout(false);
      setIsWhiteout(false);
      setIsLaserPointer(false);
    }
  }, [isOpen, initialPage]);

  // Request Fullscreen on open
  useEffect(() => {
    if (!isOpen) return;

    const el = containerRef.current || document.documentElement;
    if (el && !document.fullscreenElement) {
      try {
        el.requestFullscreen().catch(() => {});
      } catch {
        // Fallback for non-supported browsers
      }
    }

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isOpen) {
        onClose();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (document.fullscreenElement) {
        try {
          document.exitFullscreen().catch(() => {});
        } catch {
          // ignore
        }
      }
    };
  }, [isOpen, onClose]);

  // Window resize observer
  useEffect(() => {
    const handleResize = () => {
      setContainerDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Slide navigation handlers
  const goToNextPage = useCallback(() => {
    if (currentPage < numPages) {
      const next = currentPage + 1;
      setCurrentPage(next);
      onPageChange?.(next);
      setIsBlackout(false);
      setIsWhiteout(false);
    }
  }, [currentPage, numPages, onPageChange]);

  const goToPrevPage = useCallback(() => {
    if (currentPage > 1) {
      const prev = currentPage - 1;
      setCurrentPage(prev);
      onPageChange?.(prev);
      setIsBlackout(false);
      setIsWhiteout(false);
    }
  }, [currentPage, onPageChange]);

  const jumpToPage = useCallback(
    (page: number) => {
      const target = Math.max(1, Math.min(page, numPages));
      setCurrentPage(target);
      onPageChange?.(target);
      setIsBlackout(false);
      setIsWhiteout(false);
    },
    [numPages, onPageChange],
  );

  // Keyboard controls (Overleaf / PowerPoint / Keynote Parity)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent browser defaults for presentation keys
      if (['Space', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'].includes(e.code)) {
        e.preventDefault();
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
        case 'Enter':
        case 'n':
        case 'N':
          goToNextPage();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
        case 'Backspace':
        case 'p':
        case 'P':
          goToPrevPage();
          break;
        case 'Home':
          jumpToPage(1);
          break;
        case 'End':
          jumpToPage(numPages);
          break;
        case 'b':
        case 'B':
        case '.':
          setIsBlackout((prev) => !prev);
          setIsWhiteout(false);
          break;
        case 'w':
        case 'W':
          setIsWhiteout((prev) => !prev);
          setIsBlackout(false);
          break;
        case 'l':
        case 'L':
          setIsLaserPointer((prev) => !prev);
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, goToNextPage, goToPrevPage, jumpToPage, numPages, onClose]);

  // Mouse activity & HUD autohide
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      setShowControls(true);
      if (isLaserPointer) {
        setLaserPos({ x: e.clientX, y: e.clientY });
      }

      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
      hideControlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2500);
    },
    [isLaserPointer],
  );

  // Calculate high-definition scale based on page dimensions and viewport
  const calculatedScale = React.useMemo(() => {
    if (!pageSize) return 1.5;
    const maxWidth = containerDimensions.width * 0.96;
    const maxHeight = containerDimensions.height * 0.94;

    const scaleW = maxWidth / pageSize.width;
    const scaleH = maxHeight / pageSize.height;

    // Maintain aspect ratio (fit within bounds)
    return Math.min(scaleW, scaleH);
  }, [pageSize, containerDimensions]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onClick={() => {
        if (isBlackout) setIsBlackout(false);
        if (isWhiteout) setIsWhiteout(false);
      }}
      className={cn(
        'fixed inset-0 z-[100000] bg-black flex flex-col items-center justify-center select-none overflow-hidden',
        isLaserPointer ? 'cursor-none' : showControls ? 'cursor-default' : 'cursor-none',
      )}
    >
      {/* ── Slide Canvas ────────────────────────────────────────── */}
      <div className="relative flex items-center justify-center max-w-full max-h-full">
        {pdfUrl ? (
          <Document
            file={pdfUrl}
            loading={
              <div className="flex flex-col items-center gap-3 text-white/70">
                <Loader2 className="size-8 animate-spin" />
                <span className="text-sm font-mono tracking-wide">Loading presentation...</span>
              </div>
            }
            error={
              <div className="text-rose-400 text-sm font-medium">
                Failed to load slide presentation.
              </div>
            }
          >
            <Page
              pageNumber={currentPage}
              scale={calculatedScale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              onLoadSuccess={(page) => {
                setPageSize({
                  width: page.originalWidth,
                  height: page.originalHeight,
                });
              }}
              className="shadow-[0_12px_48px_rgba(0,0,0,0.8)] rounded-sm overflow-hidden"
            />
          </Document>
        ) : (
          <div className="text-white/60 text-sm">No PDF available to present.</div>
        )}
      </div>

      {/* ── Blackout Screen Overlay (B) ─────────────────────────── */}
      {isBlackout && (
        <div className="fixed inset-0 z-[100001] bg-black flex flex-col items-center justify-center text-white/40 cursor-pointer animate-in fade-in duration-200">
          <Moon className="size-8 mb-2 opacity-50" />
          <p className="text-xs font-mono">Screen Blacked Out (Press B or Click to resume)</p>
        </div>
      )}

      {/* ── Whiteout Screen Overlay (W) ─────────────────────────── */}
      {isWhiteout && (
        <div className="fixed inset-0 z-[100001] bg-white flex flex-col items-center justify-center text-black/40 cursor-pointer animate-in fade-in duration-200">
          <Sun className="size-8 mb-2 opacity-50" />
          <p className="text-xs font-mono">Screen Whited Out (Press W or Click to resume)</p>
        </div>
      )}

      {/* ── Laser Pointer Dot (L) ───────────────────────────────── */}
      {isLaserPointer && laserPos && (
        <div
          className="pointer-events-none fixed z-[100002] transition-transform duration-75 ease-out"
          style={{
            left: laserPos.x - 7,
            top: laserPos.y - 7,
          }}
        >
          {/* Main glowing laser dot */}
          <div className="size-3.5 rounded-full bg-red-500 shadow-[0_0_12px_3px_#ff0000,0_0_24px_6px_rgba(255,0,0,0.5)] animate-pulse" />
        </div>
      )}

      {/* ── Floating Presenter Control HUD ──────────────────────── */}
      <div
        className={cn(
          'fixed bottom-6 z-[100003] transition-all duration-300 ease-in-out',
          showControls && !isBlackout && !isWhiteout
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4 pointer-events-none',
        )}
      >
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-900/90 backdrop-blur-md border border-white/15 text-white shadow-raised-200">
          {/* Previous Slide */}
          <button
            type="button"
            onClick={goToPrevPage}
            disabled={currentPage <= 1}
            title="Previous slide (Left / Space)"
            className="size-7 rounded-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-white/15 disabled:opacity-30 transition-colors cursor-pointer"
          >
            <ChevronLeft className="size-4 shrink-0" />
          </button>

          {/* Slide Indicator & Input */}
          <div className="flex items-center gap-1 px-2 font-mono text-xs text-white/90">
            <input
              type="text"
              value={currentPage}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) jumpToPage(val);
              }}
              className="w-8 h-5 bg-white/10 text-center rounded-sm border border-white/20 text-white font-mono text-xs outline-none focus:border-primary"
            />
            <span className="text-white/50">/ {numPages || 1}</span>
          </div>

          {/* Next Slide */}
          <button
            type="button"
            onClick={goToNextPage}
            disabled={currentPage >= numPages}
            title="Next slide (Right / Enter)"
            className="size-7 rounded-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-white/15 disabled:opacity-30 transition-colors cursor-pointer"
          >
            <ChevronRight className="size-4 shrink-0" />
          </button>

          <div className="w-[1px] h-4 bg-white/20 mx-1" />

          {/* Laser Pointer Mode Toggle */}
          <button
            type="button"
            onClick={() => setIsLaserPointer((prev) => !prev)}
            title={isLaserPointer ? 'Disable laser pointer (L)' : 'Enable laser pointer (L)'}
            className={cn(
              'size-7 rounded-sm flex items-center justify-center transition-colors cursor-pointer text-xs font-semibold',
              isLaserPointer
                ? 'bg-red-600 text-white shadow-[0_0_8px_rgba(255,0,0,0.8)]'
                : 'text-white/80 hover:text-white hover:bg-white/15',
            )}
          >
            <Crosshair className="size-3.5 shrink-0" />
          </button>

          {/* Blackout Toggle */}
          <button
            type="button"
            onClick={() => setIsBlackout(true)}
            title="Black screen (B)"
            className="size-7 rounded-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer text-xs font-semibold"
          >
            B
          </button>

          {/* Whiteout Toggle */}
          <button
            type="button"
            onClick={() => setIsWhiteout(true)}
            title="White screen (W)"
            className="size-7 rounded-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer text-xs font-semibold"
          >
            W
          </button>

          <div className="w-[1px] h-4 bg-white/20 mx-1" />

          {/* Exit Presentation */}
          <button
            type="button"
            onClick={onClose}
            title="Exit presentation (Esc)"
            className="size-7 rounded-sm flex items-center justify-center text-white/80 hover:text-rose-400 hover:bg-white/15 transition-colors cursor-pointer"
          >
            <Minimize2 className="size-3.5 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default PresentationModeModal;
