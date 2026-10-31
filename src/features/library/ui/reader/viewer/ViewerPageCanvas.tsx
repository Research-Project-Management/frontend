'use client';

import React, { useRef } from 'react';
import { Page } from 'react-pdf';
import { Check, X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { getCappedDevicePixelRatio } from '@/shared/lib/pdfjs-worker';
import type { ReaderAnnotation } from '@/features/library/domain/types/reader.types';
import type { ReaderAnnotationTool } from '@/features/library/core/store/reader.store';
import { calculatePageAspectRatio } from '@/features/library/domain/pdf-viewport.model';
import { PageAnnotationOverlay } from './PageAnnotationOverlay';
import { DocumentPageSkeleton } from './DocumentPageSkeleton';

export interface InlineTextInputState {
  pageNum: number;
  normX: number;
  normY: number;
  text: string;
}

export interface AreaSelectionState {
  pageNum: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  active: boolean;
}

export interface ViewerPageCanvasProps {
  pageNum: number;
  inWindow: boolean;
  effectivePageWidth: number;
  rotation: number;
  themeMode: 'normal' | 'sepia' | 'dark' | 'invert';
  activeTool: ReaderAnnotationTool;
  activeColor?: string;
  cachedDim?: { width: number; height: number };
  pageAnnotations?: ReaderAnnotation[];
  pulsingAnnotationId: string | null;
  inlineTextInput: InlineTextInputState | null;
  areaSelection: AreaSelectionState | null;
  customTextRenderer?: (textItem: { str: string }) => string;
  onRegisterPageRef: (pageNum: number, el: HTMLDivElement | null) => void;
  onPageDimensionsLoad: (pageNum: number, width: number, height: number) => void;
  onPageClick: (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => void;
  onPageMouseDown: (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => void;
  onPageMouseMove: (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => void;
  onPageMouseUp: (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => void;
  onInlineTextChange: (next: InlineTextInputState | null) => void;
  onSaveInlineText: () => void;
  onOpenAnnotationCard: (ann: ReaderAnnotation, el: HTMLElement) => void;
}

export const ViewerPageCanvas = React.memo(function ViewerPageCanvas({
  pageNum,
  inWindow,
  effectivePageWidth,
  rotation,
  themeMode,
  activeTool,
  activeColor,
  cachedDim,
  pageAnnotations,
  pulsingAnnotationId,
  inlineTextInput,
  areaSelection,
  customTextRenderer,
  onRegisterPageRef,
  onPageDimensionsLoad,
  onPageClick,
  onPageMouseDown,
  onPageMouseMove,
  onPageMouseUp,
  onInlineTextChange,
  onSaveInlineText,
  onOpenAnnotationCard,
}: ViewerPageCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const aspectRatio = cachedDim
    ? calculatePageAspectRatio(cachedDim, rotation)
    : calculatePageAspectRatio({ width: 600, height: 848 }, rotation);
  const skeletonHeight = Math.round(effectivePageWidth * aspectRatio);

  return (
    <div
      data-page-num={pageNum}
      style={{ width: effectivePageWidth }}
      ref={(el) => {
        containerRef.current = el;
        onRegisterPageRef(pageNum, el);
      }}
      onClick={(e) => onPageClick(e, pageNum)}
      onMouseDown={(e) => onPageMouseDown(e, pageNum)}
      onMouseMove={(e) => onPageMouseMove(e, pageNum)}
      onMouseUp={(e) => onPageMouseUp(e, pageNum)}
      className={cn(
        'bg-white overflow-hidden transition-all relative shrink-0 mx-auto min-h-[400px]',
        themeMode === 'dark' && 'brightness-90 contrast-95',
        themeMode === 'invert' && 'invert-[0.92] hue-rotate-180 contrast-90 brightness-95',
        themeMode === 'sepia' && 'sepia-[0.3] contrast-95 brightness-95',
        (activeTool === 'area' || activeTool === 'note') && 'cursor-crosshair select-none',
        activeTool === 'text' && 'cursor-text',
      )}
    >
      {inWindow ? (
        <Page
          pageNumber={pageNum}
          width={effectivePageWidth}
          rotate={rotation}
          canvasBackground="#ffffff"
          renderTextLayer={true}
          renderAnnotationLayer={true}
          devicePixelRatio={getCappedDevicePixelRatio(2)}
          onLoadSuccess={(page) => {
            const origW =
              (page as { originalWidth?: number; width?: number }).originalWidth ||
              page.width ||
              600;
            const origH =
              (page as { originalHeight?: number; height?: number }).originalHeight ||
              page.height ||
              848;
            onPageDimensionsLoad(pageNum, origW, origH);
          }}
          loading={
            <DocumentPageSkeleton
              width={effectivePageWidth}
              height={skeletonHeight}
              animated={true}
            />
          }
          customTextRenderer={customTextRenderer}
        />
      ) : (
        <DocumentPageSkeleton
          width={effectivePageWidth}
          height={skeletonHeight}
          animated={false}
        />
      )}

      {/* INLINE TEXT TOOL INPUT */}
      {inWindow && inlineTextInput && inlineTextInput.pageNum === pageNum && (
        <div
          className="absolute z-40 bg-background/95 backdrop-blur-xs border border-border shadow-md rounded-md p-1.5 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100"
          style={{
            left: `${inlineTextInput.normX * 100}%`,
            top: `${inlineTextInput.normY * 100}%`,
            transform: 'translate(0, -50%)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="text"
            autoFocus
            aria-label="Text annotation"
            placeholder="Type text annotation..."
            value={inlineTextInput.text}
            onChange={(e) =>
              onInlineTextChange({ ...inlineTextInput, text: e.target.value })
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveInlineText();
              else if (e.key === 'Escape') onInlineTextChange(null);
            }}
            className="text-12 px-2 py-1 rounded border border-border bg-muted text-foreground w-56 font-sans focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            onClick={onSaveInlineText}
            className="size-6 rounded-md text-primary hover:bg-primary/10 flex items-center justify-center cursor-pointer transition-colors relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            title="Save text (Enter)"
            aria-label="Save text"
          >
            <Check className="size-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => onInlineTextChange(null)}
            className="size-6 rounded-md text-muted-foreground hover:bg-muted flex items-center justify-center cursor-pointer transition-colors relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            title="Cancel (Esc)"
            aria-label="Cancel"
          >
            <X className="size-3.5" strokeWidth={2} />
          </button>
        </div>
      )}

      {/* ACTIVE AREA SELECTION MARQUEE */}
      {areaSelection?.active && areaSelection.pageNum === pageNum && (
        <div
          className="absolute pointer-events-none border-2 border-dashed rounded-sm z-30 transition-none"
          style={{
            borderColor: activeColor || '#ffd400',
            backgroundColor: activeColor ? `${activeColor}25` : '#ffd40025',
            left: Math.min(areaSelection.startX, areaSelection.currentX),
            top: Math.min(areaSelection.startY, areaSelection.currentY),
            width: Math.abs(areaSelection.currentX - areaSelection.startX),
            height: Math.abs(areaSelection.currentY - areaSelection.startY),
          }}
        />
      )}

      {/* VISUAL HIGHLIGHTS / UNDERLINE / TEXT / STICKY NOTE OVERLAY */}
      {inWindow && pageAnnotations && (
        <PageAnnotationOverlay
          annotations={pageAnnotations}
          pulsingAnnotationId={pulsingAnnotationId}
          onSelectAnnotation={onOpenAnnotationCard}
        />
      )}
    </div>
  );
});
