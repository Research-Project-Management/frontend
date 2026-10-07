'use client';

/**
 * PresentationModeModal.tsx
 *
 * Fullscreen Slide Presentation Mode (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/preview/PresentationModeModal.tsx`
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

export interface PresentationModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string | null;
  initialPage?: number;
  numPages?: number;
  onPageChange?: (page: number) => void;
}

export function PresentationModeModal({
  isOpen,
  onClose,
  pdfUrl,
  initialPage = 1,
  numPages = 1,
  onPageChange,
}: PresentationModeModalProps) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    setCurrentPage(initialPage);
  }, [initialPage]);

  const handlePrev = useCallback(() => {
    setCurrentPage((p) => {
      const next = Math.max(1, p - 1);
      onPageChange?.(next);
      return next;
    });
  }, [onPageChange]);

  const handleNext = useCallback(() => {
    setCurrentPage((p) => {
      const next = Math.min(numPages || 1, p + 1);
      onPageChange?.(next);
      return next;
    });
  }, [numPages, onPageChange]);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleNext, handlePrev]);

  if (!isOpen || !pdfUrl) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-between select-none">
      {/* Top Floating Controls */}
      <div className="w-full flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent text-white z-10">
        <div className="text-sm font-medium text-white/80">
          Slide {currentPage} / {numPages || 1}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="text-white hover:bg-white/20 h-8 w-8"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/20 h-8 w-8"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Main Slide Viewer */}
      <div className="flex-1 w-full max-w-6xl flex items-center justify-center p-4 overflow-hidden relative">
        <iframe
          src={`${pdfUrl}#page=${currentPage}&toolbar=0&navpanes=0&scrollbar=0`}
          className="w-full h-full rounded-md shadow-2xl border border-white/10 bg-white"
          title={`Presentation page ${currentPage}`}
        />

        {/* Left / Right Nav Overlays */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentPage <= 1}
          className="absolute left-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white hover:bg-black/80 disabled:opacity-20 transition cursor-pointer"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={numPages > 0 && currentPage >= numPages}
          className="absolute right-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white hover:bg-black/80 disabled:opacity-20 transition cursor-pointer"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      {/* Bottom Progress Bar */}
      <div className="w-full h-1.5 bg-white/10">
        <div
          className="h-full bg-primary transition-all duration-200"
          style={{ width: `${(currentPage / Math.max(1, numPages)) * 100}%` }}
        />
      </div>
    </div>
  );
}

export default PresentationModeModal;
