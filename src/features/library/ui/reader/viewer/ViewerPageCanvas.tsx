'use client';

import React, { useRef, useCallback, useLayoutEffect } from 'react';
import { Page } from 'react-pdf';
import { Check, X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { getCappedDevicePixelRatio, releaseCanvasMemory, isPdfDocumentValid } from '@/shared/lib/pdfjs-worker';
import type { ReaderAnnotation, AnnotationRect, InlineTextInputState, AreaSelectionState, InkDrawingState } from '@/features/library/types/reader.types';
import type { ReaderAnnotationTool } from '@/features/library/core/store/reader.store';
import { calculatePageAspectRatio } from '@/features/library/domain/reader/search-outline';
import { getFreehandStrokePath } from '@/features/library/domain/reader/ink-canvas';
import { DEFAULT_ANNOTATION_COLOR } from '@/features/library/domain/reader/reader';
import type { SemanticPageOverlay } from '@/features/library/domain/reader/semantic-overlays';
import { PageAnnotationOverlay } from './PageAnnotationOverlay';
import { PageSemanticOverlay } from './PageSemanticOverlay';
import { PagePdfLinkOverlay } from './PagePdfLinkOverlay';

export type { InlineTextInputState, AreaSelectionState, InkDrawingState };

export function DocumentPageSkeleton({
  width,
  height,
  animated = true,
}: {
  width?: number;
  height?: number;
  animated?: boolean;
}) {
  const w = width || 600;
  const h = height ? Math.round(height) : Math.round(w * 1.414);
  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-8 bg-background select-none mx-auto',
        animated && 'animate-pulse',
      )}
      style={{ width: w, height: h }}
      aria-hidden="true"
    >
      <div className="h-4 w-3/4 bg-muted rounded-sm mb-4" />
      <div className="h-2.5 w-1/2 bg-muted rounded-sm mb-6" />
      <div className="space-y-2.5 flex-1">
        <div className="h-2 w-full bg-muted rounded-sm" />
        <div className="h-2 w-full bg-muted rounded-sm" />
        <div className="h-2 w-11/12 bg-muted rounded-sm" />
        <div className="h-2 w-full bg-muted rounded-sm" />
        <div className="h-2 w-4/5 bg-muted rounded-sm" />
        <div className="h-2 w-full bg-muted rounded-sm mt-4" />
        <div className="h-2 w-full bg-muted rounded-sm" />
        <div className="h-2 w-9/12 bg-muted rounded-sm" />
      </div>
      <div className="h-2 w-1/4 bg-muted rounded-sm self-center mt-auto" />
    </div>
  );
}

interface ViewerPageCanvasProps {
  pageNum: number;
  inWindow: boolean;
  effectivePageWidth: number;
  rotation: number;
  themeMode: 'normal' | 'sepia' | 'dark' | 'invert';
  activeTool: ReaderAnnotationTool;
  activeColor?: string;
  cachedDim?: { width: number; height: number };
  pdfDocument?: unknown;
  pageAnnotations?: ReaderAnnotation[];
  semanticOverlays?: SemanticPageOverlay[];
  hoveredSemanticOverlayId?: string | null;
  pulsingAnnotationId: string | null;
  activeAnnotationId?: string | null;
  inlineTextInput: InlineTextInputState | null;
  areaSelection: AreaSelectionState | null;
  inkDrawing?: InkDrawingState | null;
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
  onHoverExternalLink?: (params: { url: string; rect: DOMRect }) => void;
  onLeaveLink?: () => void;
  onNavigatePage?: (pageNumber: number) => void;
  onDeleteAnnotation?: (ann: ReaderAnnotation) => void;
  onUpdateAnnotation?: (
    annotationId: string,
    expectedVersion: number | undefined,
    dto: {
      color?: string;
      comment?: string;
      tags?: string[];
      rects?: AnnotationRect[];
    },
  ) => Promise<unknown>;
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
  pdfDocument,
  pageAnnotations,
  semanticOverlays,
  hoveredSemanticOverlayId,
  pulsingAnnotationId,
  activeAnnotationId,
  inlineTextInput,
  areaSelection,
  inkDrawing,
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
  onHoverExternalLink,
  onLeaveLink,
  onNavigatePage,
  onDeleteAnnotation,
  onUpdateAnnotation,
}: ViewerPageCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const setPageRef = useCallback(
    (el: HTMLDivElement | null) => {
      containerRef.current = el;
      onRegisterPageRef(pageNum, el);
    },
    [pageNum, onRegisterPageRef],
  );

  const handlePageLoadSuccess = useCallback(
    (page: { originalWidth?: number; originalHeight?: number; width?: number; height?: number }) => {
      const origW = page.originalWidth || page.width || 600;
      const origH = page.originalHeight || page.height || 848;
      onPageDimensionsLoad(pageNum, origW, origH);
    },
    [pageNum, onPageDimensionsLoad],
  );

  useLayoutEffect(() => {
    if (!inWindow) return;
    const container = containerRef.current;
    return () => {
      releaseCanvasMemory(container ?? containerRef.current);
    };
  }, [inWindow]);

  const aspectRatio = cachedDim
    ? calculatePageAspectRatio(cachedDim, rotation)
    : calculatePageAspectRatio({ width: 600, height: 848 }, rotation);
  const skeletonHeight = Math.round(effectivePageWidth * aspectRatio);

  return (
    <div
      data-page-num={pageNum}
      style={{ width: effectivePageWidth }}
      ref={setPageRef}
      onClick={(e) => onPageClick(e, pageNum)}
      onMouseDown={(e) => onPageMouseDown(e, pageNum)}
      onMouseMove={(e) => onPageMouseMove(e, pageNum)}
      onMouseUp={(e) => onPageMouseUp(e, pageNum)}
      className={cn(
        'bg-canvas overflow-hidden relative shrink-0 mx-auto min-h-[400px]',
        themeMode === 'dark' && 'brightness-90 contrast-95',
        themeMode === 'invert' && 'invert-[0.92] hue-rotate-180 contrast-90 brightness-95',
        themeMode === 'sepia' && 'sepia-[0.3] contrast-95 brightness-95',
        (activeTool === 'area' || activeTool === 'note' || activeTool === 'ink' || activeTool === 'eraser') &&
          'cursor-crosshair select-none pdf-disable-links',
        activeTool === 'text' && 'cursor-text',
      )}
    >
      {inWindow && (!pdfDocument || isPdfDocumentValid(pdfDocument)) ? (
        <Page
          pdf={isPdfDocumentValid(pdfDocument) ? (pdfDocument as never) : undefined}
          pageNumber={pageNum}
          width={effectivePageWidth}
          rotate={rotation}
          canvasBackground={themeMode === 'dark' ? '#1a1a22' : '#fcfcfb'}
          renderTextLayer={true}
          renderAnnotationLayer={false}
          devicePixelRatio={getCappedDevicePixelRatio(2)}
          onLoadSuccess={handlePageLoadSuccess}
          onLoadError={() => {}}
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
        <div
          className="bg-canvas select-none mx-auto"
          style={{ width: effectivePageWidth, height: skeletonHeight }}
          aria-hidden="true"
        />
      )}

      {/* INLINE TEXT TOOL INPUT */}
      {inWindow && inlineTextInput && inlineTextInput.pageNum === pageNum && (
        <div
          className="absolute z-40 bg-background/95 backdrop-blur-xs border border-border shadow-raised-200 rounded-md p-1.5 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100"
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
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onSaveInlineText}
                className="size-6 rounded-md text-primary hover:bg-primary/10 flex items-center justify-center cursor-pointer transition-colors relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Save text (Enter)"
              >
                <Check className="size-3.5" strokeWidth={2} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="text-11">
              Save text (Enter)
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onInlineTextChange(null)}
                className="size-6 rounded-md text-muted-foreground hover:bg-muted flex items-center justify-center cursor-pointer transition-colors relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Cancel (Esc)"
              >
                <X className="size-3.5" strokeWidth={2} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="text-11">
              Cancel (Esc)
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* ACTIVE AREA SELECTION MARQUEE */}
      {areaSelection?.active && areaSelection.pageNum === pageNum && (
        <div
          className="absolute pointer-events-none border-2 border-dashed rounded-sm z-30 transition-none"
          style={{
            borderColor: activeColor || DEFAULT_ANNOTATION_COLOR,
            backgroundColor: `${activeColor || DEFAULT_ANNOTATION_COLOR}25`,
            left: Math.min(areaSelection.startX, areaSelection.currentX),
            top: Math.min(areaSelection.startY, areaSelection.currentY),
            width: Math.abs(areaSelection.currentX - areaSelection.startX),
            height: Math.abs(areaSelection.currentY - areaSelection.startY),
          }}
        />
      )}

      {/* ACTIVE INK DRAWING PREVIEW */}
      {inkDrawing?.active && inkDrawing.pageNum === pageNum && inkDrawing.currentPoints.length > 1 && (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none z-30"
        >
          <path
            d={getFreehandStrokePath(inkDrawing.currentPoints, undefined, 0.7)}
            fill={activeColor || DEFAULT_ANNOTATION_COLOR}
            stroke="none"
          />
        </svg>
      )}

      {/* ZOTERO-STYLE PDF LINK OVERLAY (getAnnotations external + internal links) */}
      {inWindow && Boolean(pdfDocument) && (
        <PagePdfLinkOverlay
          pdfDocument={pdfDocument}
          pageNum={pageNum}
          rotation={rotation}
          disabled={activeTool === 'area' || activeTool === 'note' || activeTool === 'ink' || activeTool === 'eraser'}
          onHoverExternalLink={onHoverExternalLink}
          onLeaveLink={onLeaveLink}
          onNavigatePage={onNavigatePage}
        />
      )}

      {/* PRE-COMPUTED SEMANTIC CITATION / LINK OVERLAYS */}
      {inWindow && semanticOverlays && semanticOverlays.length > 0 && (
        <PageSemanticOverlay
          overlays={semanticOverlays}
          hoveredOverlayId={hoveredSemanticOverlayId}
          rotation={rotation}
          themeMode={themeMode}
        />
      )}

      {/* VISUAL HIGHLIGHTS / UNDERLINE / TEXT / STICKY NOTE / INK OVERLAY */}
      {inWindow && pageAnnotations && (
        <PageAnnotationOverlay
          annotations={pageAnnotations}
          rotation={rotation}
          pulsingAnnotationId={pulsingAnnotationId}
          activeAnnotationId={activeAnnotationId}
          isEraser={activeTool === 'eraser'}
          onSelectAnnotation={onOpenAnnotationCard}
          onDeleteAnnotation={onDeleteAnnotation}
          onUpdateAnnotation={onUpdateAnnotation}
        />
      )}
    </div>
  );
});
