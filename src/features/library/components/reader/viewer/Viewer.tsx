'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Document, Page } from 'react-pdf';
import { AlertTriangle, Check, X } from 'lucide-react';
import type {
  DocumentFulltext,
  ReaderDocument,
  ReaderAnnotation,
  AnnotationRect,
  ReaderNavigationTarget,
} from '@/features/library/types/reader.types';
import type { ReaderAnnotationTool } from '@/features/library/store/reader.store';
import { ZOTERO_COLORS } from '@/features/library/components/reader/ReaderToolbar';
import { useViewerSearch, ViewerSearchBar } from './ViewerSearchBar';
import { TextSelectionToolbar } from './TextSelectionToolbar';
import {
  PageAnnotationOverlay,
  AnnotationQuickEditCard,
  type ActiveHighlightTooltipState,
} from './PageAnnotationOverlay';

import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import { cn } from '@/shared/lib/utils';
import { setupPdfWorker } from '@/shared/lib/pdfjs-worker';

export { ZOTERO_COLORS };

setupPdfWorker();

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
        'flex flex-col gap-3 p-8 bg-card border border-border rounded-md select-none',
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

interface ViewerProps {
  blobUrl: string | null;
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
  onAskAi: (selectedText: string) => void;
  onAddToNote?: (selectedText: string, pageNumber?: number, annotationId?: string) => void;
  onAnnotate?: (
    selectedText: string,
    pageNumber: number,
    colorHex?: string,
    rects?: AnnotationRect[],
    type?: 'highlight' | 'underline' | 'note' | 'text' | 'rect' | 'area',
    comment?: string,
  ) => void;
  onUpdateAnnotation?: (
    annotationId: string,
    expectedVersion: number | undefined,
    dto: { color?: string; comment?: string; tags?: string[] },
  ) => Promise<unknown>;
  annotations?: ReaderAnnotation[];
  onDeleteAnnotation?: (annotation: ReaderAnnotation) => void;
  fulltext?: DocumentFulltext | null;
  isLoadingFulltext?: boolean;
  targetPage?: ReaderNavigationTarget | null;
  paper?: ReaderDocument;
  onVisiblePageChange?: (page: number) => void;
  onTotalPagesChange?: (total: number) => void;
  zoom?: number;
  rotation?: number;
  themeMode?: 'normal' | 'sepia' | 'dark';
  interactionMode?: 'select' | 'hand';
  activeColor?: string;
  activeTool?: ReaderAnnotationTool;
  isSearchOpen?: boolean;
  onCloseSearch?: () => void;
  initialSearchQuery?: string;
  viewMode?: 'single' | 'continuous' | 'spread';
  fitMode?: 'fit-width' | 'fit-page' | 'auto';
}

export default function Viewer({
  blobUrl,
  isLoading,
  error,
  onRetry,
  onAskAi,
  onAddToNote,
  onAnnotate,
  onUpdateAnnotation,
  annotations = [],
  onDeleteAnnotation,
  fulltext,
  targetPage,
  paper,
  onVisiblePageChange,
  onTotalPagesChange,
  zoom: zoomProp,
  rotation = 0,
  themeMode = 'normal',
  interactionMode = 'select',
  activeColor,
  activeTool = 'highlight',
  isSearchOpen = false,
  onCloseSearch,
  initialSearchQuery,
  viewMode = 'continuous',
  fitMode = 'fit-width',
}: ViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [visiblePage, setVisiblePage] = useState<number>(1);
  const [docError, setDocError] = useState<string | null>(null);

  useEffect(() => {
    if (blobUrl) {
      setDocError(null);
    }
  }, [blobUrl]);

  // Text selection floating menu & normalized rects
  const [selectedText, setSelectedText] = useState<string>('');
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const [showFloatingMenu, setShowFloatingMenu] = useState<boolean>(false);
  const [selectedPageNum, setSelectedPageNum] = useState<number>(1);
  const [selectedRects, setSelectedRects] = useState<AnnotationRect[]>([]);
  const [activeHighlightTooltip, setActiveHighlightTooltip] =
    useState<ActiveHighlightTooltipState | null>(null);

  // Inline floating text tool state (Zotero 7 parity)
  const [inlineTextInput, setInlineTextInput] = useState<{
    pageNum: number;
    normX: number;
    normY: number;
    text: string;
  } | null>(null);

  // Area Selection (Scan Tool) State for marquee dragging
  const [areaSelection, setAreaSelection] = useState<{
    pageNum: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    active: boolean;
  } | null>(null);

  // Group annotations by 1-based page number
  const pageAnnotationsMap = useMemo(() => {
    const map: Record<number, ReaderAnnotation[]> = {};
    for (const ann of annotations || []) {
      const p =
        ann.pageIndex !== undefined && ann.pageIndex !== null
          ? ann.pageIndex + 1
          : ann.pageNumber || 1;
      if (!map[p]) map[p] = [];
      map[p].push(ann);
    }
    return map;
  }, [annotations]);

  const [pageDimensions, setPageDimensions] = useState<
    Record<number, { width: number; height: number }>
  >({});

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return Math.max(600, window.innerWidth - 360);
    }
    return 1000;
  });
  const [containerHeight, setContainerHeight] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return Math.max(600, window.innerHeight - 100);
    }
    return 800;
  });
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const scrollToPage = useCallback((page: number) => {
    const el = pageRefs.current.get(page);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const {
    searchQuery,
    setSearchQuery,
    currentMatchIdx,
    searchMatches,
    searchInputRef,
    handleNextMatch,
    handlePrevMatch,
    customTextRenderer,
  } = useViewerSearch({
    isSearchOpen,
    initialSearchQuery,
    fulltext,
    numPages,
    pageRefs,
    scrollToPage,
  });

  // Track container width and height for fit layout
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const el = scrollContainerRef.current;
    const update = (entries?: ResizeObserverEntry[]) => {
      const entry = entries?.[0];
      const width = entry ? entry.contentRect.width : el.clientWidth || el.getBoundingClientRect().width;
      const height = entry ? entry.contentRect.height : el.clientHeight || el.getBoundingClientRect().height;
      if (width > 0) setContainerWidth(Math.round(width));
      if (height > 0) setContainerHeight(Math.round(height));
    };
    update();
    const obs = new ResizeObserver((entries) => update(entries));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Track most visible page in viewport
  useEffect(() => {
    if (numPages === 0) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const obs = new IntersectionObserver(
      (entries) => {
        let best: { page: number; ratio: number } | null = null;
        for (const entry of entries) {
          const page = Number((entry.target as HTMLElement).dataset.pageNum);
          if (isNaN(page)) continue;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { page, ratio: entry.intersectionRatio };
          }
        }
        if (best && best.ratio > 0) {
          setVisiblePage(best.page);
          onVisiblePageChange?.(best.page);
        }
      },
      { root: container, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    pageRefs.current.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [numPages, onVisiblePageChange]);

  const onDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    onTotalPagesChange?.(n);
    setDocError(null);
  };

  const onDocumentLoadError = () => {
    setDocError('Failed to render PDF. The file may be corrupted.');
  };

  const [pulsingAnnotationId, setPulsingAnnotationId] = useState<string | null>(null);

  // Zotero-standard Active Backlink navigation handler
  useEffect(() => {
    if (!targetPage || targetPage.pageNumber < 1) return;

    scrollToPage(targetPage.pageNumber);

    if (targetPage.annotationId) {
      const annId = targetPage.annotationId;
      setPulsingAnnotationId(annId);

      const attemptFocus = (retries = 8) => {
        const el = document.querySelector(
          `[data-annotation-id="${annId}"]`,
        ) as HTMLElement | null;
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (retries > 0) {
          setTimeout(() => attemptFocus(retries - 1), 120);
        }
      };

      const focusTimer = setTimeout(() => attemptFocus(), 80);
      const clearTimer = setTimeout(() => setPulsingAnnotationId(null), 2500);

      return () => {
        clearTimeout(focusTimer);
        clearTimeout(clearTimer);
      };
    }
  }, [targetPage, scrollToPage]);

  // Area Selection (Scan Tool) Mouse Handlers
  const handlePageMouseDown = (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
    if (activeTool !== 'area' || e.button !== 0) return;
    e.preventDefault();
    const pageRect = e.currentTarget.getBoundingClientRect();
    const startX = e.clientX - pageRect.left;
    const startY = e.clientY - pageRect.top;
    setAreaSelection({
      pageNum,
      startX,
      startY,
      currentX: startX,
      currentY: startY,
      active: true,
    });
  };

  const handlePageMouseMove = (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
    if (!areaSelection?.active || areaSelection.pageNum !== pageNum) return;
    const pageRect = e.currentTarget.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(pageRect.width, e.clientX - pageRect.left));
    const currentY = Math.max(0, Math.min(pageRect.height, e.clientY - pageRect.top));
    setAreaSelection((prev) => (prev ? { ...prev, currentX, currentY } : null));
  };

  const handlePageMouseUp = (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
    if (!areaSelection?.active || areaSelection.pageNum !== pageNum) return;
    const pageRect = e.currentTarget.getBoundingClientRect();
    const xMin = Math.min(areaSelection.startX, areaSelection.currentX);
    const yMin = Math.min(areaSelection.startY, areaSelection.currentY);
    const widthPx = Math.abs(areaSelection.currentX - areaSelection.startX);
    const heightPx = Math.abs(areaSelection.currentY - areaSelection.startY);

    setAreaSelection(null);

    if (widthPx >= 16 && heightPx >= 16) {
      const normX1 = xMin / pageRect.width;
      const normY1 = yMin / pageRect.height;
      const normW = widthPx / pageRect.width;
      const normH = heightPx / pageRect.height;

      const rect: AnnotationRect = {
        x1: normX1,
        y1: normY1,
        x2: normX1 + normW,
        y2: normY1 + normH,
        width: normW,
        height: normH,
      };

      onAnnotate?.('', pageNum, activeColor || '#ffd400', [rect], 'rect');
    }
  };

  // Tool click handler on PDF page (Text and Sticky Note placement)
  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
    if (activeTool === 'text') {
      const rect = e.currentTarget.getBoundingClientRect();
      const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      setInlineTextInput({ pageNum, normX, normY, text: '' });
      return;
    }

    if (activeTool === 'note') {
      const rect = e.currentTarget.getBoundingClientRect();
      const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      const noteRect: AnnotationRect = {
        x1: normX,
        y1: normY,
        x2: Math.min(1, normX + 0.03),
        y2: Math.min(1, normY + 0.03),
        width: 0.03,
        height: 0.03,
      };
      onAnnotate?.('', pageNum, activeColor || '#ffd400', [noteRect], 'note');
    }
  };

  const handleSaveInlineText = () => {
    if (!inlineTextInput || !inlineTextInput.text.trim()) {
      setInlineTextInput(null);
      return;
    }
    const text = inlineTextInput.text.trim();
    const annotationRect: AnnotationRect = {
      x1: inlineTextInput.normX,
      y1: inlineTextInput.normY,
      x2: Math.min(1, inlineTextInput.normX + 0.25),
      y2: Math.min(1, inlineTextInput.normY + 0.04),
      width: 0.25,
      height: 0.04,
    };
    onAnnotate?.(text, inlineTextInput.pageNum, activeColor || '#ffd400', [annotationRect], 'text');
    setInlineTextInput(null);
  };

  const openAnnotationCard = (ann: ReaderAnnotation, el: HTMLElement) => {
    const target = el.getBoundingClientRect();
    const container = scrollContainerRef.current?.getBoundingClientRect();
    const top =
      target.bottom -
      (container?.top || 0) +
      (scrollContainerRef.current?.scrollTop || 0) +
      6;
    const left = Math.max(
      10,
      Math.min(
        (container?.width || 800) - 340,
        target.left -
          (container?.left || 0) +
          (scrollContainerRef.current?.scrollLeft || 0),
      ),
    );

    setActiveHighlightTooltip({
      id: ann.id,
      quote: ann.quoteText,
      comment: ann.comment,
      color: ann.color || '#ffd400',
      top,
      left,
      ann,
    });
  };

  // Text selection floating menu
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    const container = scrollContainerRef.current;
    if (!text || !container || !container.contains(selection.anchorNode)) return;

    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const menuHeight = 40;
      const menuGap = 10;
      const menuHalfWidth = 110;
      const selectionTop = rect.top - containerRect.top + container.scrollTop;
      const selectionBottom = rect.bottom - containerRect.top + container.scrollTop;
      const visibleTop = container.scrollTop + menuGap;
      const visibleBottom = container.scrollTop + container.clientHeight - menuHeight - menuGap;
      const preferredTop = selectionTop - menuHeight - menuGap;
      const fallbackTop = selectionBottom + menuGap;
      const top = Math.max(
        visibleTop,
        Math.min(preferredTop >= visibleTop ? preferredTop : fallbackTop, visibleBottom),
      );
      const left = Math.max(
        menuHalfWidth + menuGap,
        Math.min(
          rect.left - containerRect.left + rect.width / 2,
          container.clientWidth - menuHalfWidth - menuGap,
        ),
      );

      setMenuPosition({ top, left });
      setSelectedText(text);

      const anchorNode = selection.anchorNode;
      const anchorEl = (
        anchorNode?.nodeType === Node.ELEMENT_NODE ? anchorNode : anchorNode?.parentElement
      ) as HTMLElement | null;
      const pageEl = anchorEl?.closest('[data-page-num]') as HTMLElement | null;
      const pNum = pageEl ? Number(pageEl.dataset.pageNum) : visiblePage;
      setSelectedPageNum(pNum);

      let relative: AnnotationRect[] = [];
      if (pageEl) {
        const pageRect = pageEl.getBoundingClientRect();
        const clientRects = Array.from(range.getClientRects());
        relative = clientRects
          .map((cr) => {
            const x1 = Math.max(0, (cr.left - pageRect.left) / pageRect.width);
            const y1 = Math.max(0, (cr.top - pageRect.top) / pageRect.height);
            const width = Math.min(1 - x1, cr.width / pageRect.width);
            const height = Math.min(1 - y1, cr.height / pageRect.height);
            return { x1, y1, x2: x1 + width, y2: y1 + height, width, height };
          })
          .filter((r) => r.width > 0.001 && r.height > 0.001);
      }
      setSelectedRects(relative);

      if ((activeTool === 'highlight' || activeTool === 'underline') && onAnnotate) {
        onAnnotate(text, pNum, activeColor || '#ffd400', relative, activeTool);
        setShowFloatingMenu(false);
        window.getSelection()?.removeAllRanges();
        return;
      }

      setShowFloatingMenu(true);
    } catch {
      setShowFloatingMenu(false);
    }
  }, [visiblePage, activeTool, activeColor, onAnnotate]);

  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (interactionMode === 'hand') {
        isPanningRef.current = true;
        if (scrollContainerRef.current) {
          panStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            scrollLeft: scrollContainerRef.current.scrollLeft,
            scrollTop: scrollContainerRef.current.scrollTop,
          };
        }
        return;
      }
      const target = e.target as HTMLElement;
      if (!target.closest('.pdf-floating-selection-menu')) {
        setShowFloatingMenu(false);
      }
    },
    [interactionMode],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (interactionMode === 'hand' && isPanningRef.current && scrollContainerRef.current) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        scrollContainerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
        scrollContainerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
      }
    },
    [interactionMode],
  );

  const handleMouseUpCombined = useCallback(() => {
    if (interactionMode === 'hand') {
      isPanningRef.current = false;
      return;
    }
    handleMouseUp();
  }, [interactionMode, handleMouseUp]);

  const currentZoom = zoomProp ?? 1.0;
  const containerH = containerHeight || 800;
  const fitPageWidth = Math.max(260, Math.round(((containerH - 72) / 1.414) * currentZoom));
  const fitWidthWidth = Math.max(320, Math.round((containerWidth - 16) * currentZoom));
  const spreadPageWidth = Math.max(260, Math.round(((containerWidth - 32) / 2) * currentZoom));

  const standardPageWidth = fitMode === 'fit-page' ? fitPageWidth : fitWidthWidth;
  const effectivePageWidth = viewMode === 'spread' ? spreadPageWidth : standardPageWidth;

  const spreadPairs = useMemo(() => {
    if (numPages === 0) return [];
    const pairs: [number, number | null][] = [];
    for (let i = 1; i <= numPages; i += 2) {
      pairs.push([i, i + 1 <= numPages ? i + 1 : null]);
    }
    return pairs;
  }, [numPages]);

  const isPageInWindow = (pageNum: number) => {
    if (numPages <= 6 || viewMode === 'single') return true;
    if (targetPage && targetPage.pageNumber === pageNum) return true;
    if (areaSelection?.pageNum === pageNum || inlineTextInput?.pageNum === pageNum) return true;
    return Math.abs(pageNum - visiblePage) <= 2;
  };

  const renderPageCard = (pageNum: number) => {
    const inWindow = isPageInWindow(pageNum);
    const cachedDim = pageDimensions[pageNum];
    const isRotatedSideways = Math.abs(rotation) % 180 === 90;
    const aspectRatio = cachedDim
      ? isRotatedSideways
        ? cachedDim.width / Math.max(1, cachedDim.height)
        : cachedDim.height / Math.max(1, cachedDim.width)
      : isRotatedSideways
        ? 1 / 1.414
        : 1.414;
    const skeletonHeight = Math.round(effectivePageWidth * aspectRatio);

    return (
      <div
        key={pageNum}
        data-page-num={pageNum}
        style={{ width: effectivePageWidth }}
        ref={(el) => {
          if (el) pageRefs.current.set(pageNum, el);
          else pageRefs.current.delete(pageNum);
        }}
        onClick={(e) => handlePageClick(e, pageNum)}
        onMouseDown={(e) => handlePageMouseDown(e, pageNum)}
        onMouseMove={(e) => handlePageMouseMove(e, pageNum)}
        onMouseUp={(e) => handlePageMouseUp(e, pageNum)}
        className={cn(
          'bg-card border border-border rounded-md overflow-hidden transition-all relative shrink-0 mx-auto shadow-sm',
          themeMode === 'dark' && 'invert-[0.9] hue-rotate-180 contrast-90 brightness-95',
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
            renderTextLayer={true}
            renderAnnotationLayer={true}
            onLoadSuccess={(page) => {
              const origW =
                (page as { originalWidth?: number; width?: number }).originalWidth ||
                page.width ||
                600;
              const origH =
                (page as { originalHeight?: number; height?: number }).originalHeight ||
                page.height ||
                848;
              setPageDimensions((prev) => {
                const existing = prev[pageNum];
                if (existing && existing.width === origW && existing.height === origH) {
                  return prev;
                }
                return { ...prev, [pageNum]: { width: origW, height: origH } };
              });
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
              placeholder="Type text annotation..."
              value={inlineTextInput.text}
              onChange={(e) => setInlineTextInput({ ...inlineTextInput, text: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveInlineText();
                else if (e.key === 'Escape') setInlineTextInput(null);
              }}
              className="text-12 px-2 py-1 rounded border border-border/60 bg-muted/30 text-foreground w-56 font-sans focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={handleSaveInlineText}
              className="size-6 rounded-md text-primary hover:bg-primary/10 flex items-center justify-center cursor-pointer transition-colors relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              title="Save text (Enter)"
              aria-label="Save text"
            >
              <Check className="size-3.5" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setInlineTextInput(null)}
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
        {inWindow && pageAnnotationsMap[pageNum] && (
          <PageAnnotationOverlay
            annotations={pageAnnotationsMap[pageNum]}
            pulsingAnnotationId={pulsingAnnotationId}
            onSelectAnnotation={openAnnotationCard}
          />
        )}
      </div>
    );
  };

  return (
    <div
      className={cn(
        'relative flex-1 flex flex-col min-w-0 h-full overflow-hidden transition-colors',
        themeMode === 'dark'
          ? 'bg-background'
          : themeMode === 'sepia'
            ? 'bg-[#efe7d7]'
            : 'bg-muted',
      )}
    >
      <div
        ref={scrollContainerRef}
        onMouseUp={handleMouseUpCombined}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        className={cn(
          'flex-1 w-full overflow-auto relative',
          interactionMode === 'hand'
            ? 'cursor-grab active:cursor-grabbing select-none'
            : 'select-text',
        )}
      >
        {isSearchOpen && (
          <ViewerSearchBar
            searchInputRef={searchInputRef}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            matchCount={searchMatches.length}
            currentMatchIdx={currentMatchIdx}
            onNextMatch={handleNextMatch}
            onPrevMatch={handlePrevMatch}
            onClose={onCloseSearch}
          />
        )}

        {error || docError ? (
          <div className="flex flex-col items-center justify-center text-center p-10 max-w-md mx-auto mt-20 gap-3">
            <div className="size-12 rounded-md bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
              <AlertTriangle className="size-6 shrink-0" />
            </div>
            <p className="text-sm font-semibold text-foreground">Unable to load document</p>
            <p className="text-xs text-foreground/80 leading-relaxed">{error || docError}</p>
            {onRetry && (
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={onRetry}
                  className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary-hover focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none transition-colors cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        ) : !blobUrl ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-6">
                <DocumentPageSkeleton width={effectivePageWidth} />
              </div>
            ) : (
              <>
                <div className="size-12 rounded-md bg-background border border-border flex items-center justify-center text-foreground">
                  <AlertTriangle className="size-6 shrink-0" />
                </div>
                <p className="text-xs text-foreground/80 max-w-sm leading-relaxed">
                  No valid PDF document path found for this entry.
                </p>
              </>
            )}
          </div>
        ) : (
          <Document
            file={blobUrl}
            className="w-full min-w-full flex flex-col items-center"
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="w-full flex flex-col items-center gap-4 py-4 px-2">
                <DocumentPageSkeleton width={effectivePageWidth} />
              </div>
            }
          >
            {viewMode === 'spread' ? (
              <div className="w-full flex flex-col items-center gap-4 py-4 px-2 max-w-[1920px] mx-auto">
                {spreadPairs.map(([p1, p2]) => (
                  <div key={p1} className="flex flex-row justify-center items-start gap-4">
                    {renderPageCard(p1)}
                    {p2 && renderPageCard(p2)}
                  </div>
                ))}
              </div>
            ) : viewMode === 'single' ? (
              <div className="w-full flex flex-col items-center gap-3 py-4 px-2 min-h-full justify-center">
                {renderPageCard(Math.min(Math.max(1, visiblePage), numPages || 1))}
              </div>
            ) : (
              <div className="w-full flex flex-col items-center gap-3 py-4 px-2">
                {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) =>
                  renderPageCard(pageNum),
                )}
              </div>
            )}
          </Document>
        )}

        {activeHighlightTooltip && (
          <AnnotationQuickEditCard
            tooltip={activeHighlightTooltip}
            visiblePage={visiblePage}
            onUpdateAnnotation={onUpdateAnnotation}
            onDeleteAnnotation={onDeleteAnnotation}
            onAddToNote={onAddToNote}
            onUpdateTooltip={setActiveHighlightTooltip}
            onClose={() => setActiveHighlightTooltip(null)}
          />
        )}

        {showFloatingMenu && selectedText && (
          <TextSelectionToolbar
            selectedText={selectedText}
            selectedPageNum={selectedPageNum}
            selectedRects={selectedRects}
            menuPosition={menuPosition}
            activeColor={activeColor}
            activeTool={activeTool}
            paper={paper}
            visiblePage={visiblePage}
            onAnnotate={onAnnotate}
            onAddToNote={onAddToNote}
            onAskAi={onAskAi}
            onClose={() => setShowFloatingMenu(false)}
          />
        )}
      </div>
    </div>
  );
}
