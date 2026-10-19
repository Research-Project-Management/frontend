"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Document } from "react-pdf";
import { PlaneEmptyState } from "@/shared/components/ui/PlaneEmptyState";
import { PlaneErrorState } from "@/shared/components/ui/PlaneErrorState";
import type {
  DocumentFulltext,
  ReaderDocument,
  ReaderAnnotation,
  AnnotationRect,
  ReaderNavigationTarget,
} from "@/features/library/domain/types/reader.types";
import type { ReaderAnnotationTool } from "@/features/library/core/store/reader.store";
import { ZOTERO_COLORS } from "@/features/library/ui/reader/ReaderToolbar";
import {
  computeEffectivePdfPageWidth,
  computeSpreadPairs,
  isPageInVirtualWindow,
} from "@/features/library/domain/pdf-viewport.model";
import { useViewerSearch, ViewerSearchBar } from "./ViewerSearchBar";
import { TextSelectionToolbar } from "./TextSelectionToolbar";
import { AnnotationQuickEditCard } from "./PageAnnotationOverlay";
import { DocumentPageSkeleton } from "./DocumentPageSkeleton";
import { ViewerPageCanvas } from "./ViewerPageCanvas";
import { usePdfViewerInteraction } from "./usePdfViewerInteraction";

import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { cn } from "@/shared/lib/utils";
import { setupPdfWorker, getSharedPdfDocumentOptions } from "@/shared/lib/pdfjs-worker";

export { ZOTERO_COLORS, DocumentPageSkeleton };

setupPdfWorker();
const SHARED_PDF_OPTIONS = getSharedPdfDocumentOptions();
const EMPTY_ANNOTATIONS: ReaderAnnotation[] = [];

interface ViewerProps {
  blobUrl: string | null;
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
  onAddToNote?: (
    selectedText: string,
    pageNumber?: number,
    annotationId?: string,
  ) => void;
  onAnnotate?: (
    selectedText: string,
    pageNumber: number,
    colorHex?: string,
    rects?: AnnotationRect[],
    type?: "highlight" | "underline" | "note" | "text" | "rect" | "area",
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
  themeMode?: "normal" | "sepia" | "dark";
  interactionMode?: "select" | "hand";
  activeColor?: string;
  activeTool?: ReaderAnnotationTool;
  isSearchOpen?: boolean;
  onCloseSearch?: () => void;
  initialSearchQuery?: string;
  viewMode?: "single" | "continuous" | "spread";
  fitMode?: "fit-width" | "fit-page" | "auto";
}

export default function Viewer({
  blobUrl,
  isLoading,
  error,
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
  themeMode = "normal",
  interactionMode = "select",
  activeColor,
  activeTool = "highlight",
  isSearchOpen = false,
  onCloseSearch,
  initialSearchQuery,
  viewMode = "continuous",
  fitMode = "fit-width",
}: ViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [visiblePage, setVisiblePage] = useState<number>(1);
  const [docError, setDocError] = useState<string | null>(null);
  const [pulsingAnnotationId, setPulsingAnnotationId] = useState<string | null>(
    null,
  );
  const pdfDocRef = useRef<{
    cleanup?: () => Promise<void> | void;
    destroy?: () => Promise<void> | void;
  } | null>(null);

  useEffect(() => {
    if (blobUrl) {
      setDocError(null);
    }
    return () => {
      const doc = pdfDocRef.current;
      pdfDocRef.current = null;
      void doc?.cleanup?.();
      void doc?.destroy?.();
    };
  }, [blobUrl]);

  const annotationsByPage = useMemo(() => {
    const map = new Map<number, ReaderAnnotation[]>();
    for (const ann of annotations || []) {
      const p =
        ann.pageIndex !== undefined && ann.pageIndex !== null
          ? ann.pageIndex + 1
          : ann.pageNumber || 1;
      const list = map.get(p);
      if (list) {
        list.push(ann);
      } else {
        map.set(p, [ann]);
      }
    }
    return map;
  }, [annotations]);

  const [pageDimensions, setPageDimensions] = useState<
    Record<number, { width: number; height: number }>
  >({});

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return Math.max(600, window.innerWidth - 360);
    }
    return 1000;
  });
  const [containerHeight, setContainerHeight] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return Math.max(600, window.innerHeight - 100);
    }
    return 800;
  });
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const scrollToPage = useCallback((page: number) => {
    const el = pageRefs.current.get(page);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const interaction = usePdfViewerInteraction({
    scrollContainerRef,
    visiblePage,
    activeTool,
    activeColor,
    interactionMode,
    onAnnotate,
  });

  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const el = scrollContainerRef.current;
    let rafId: number | null = null;

    const commitDimensions = () => {
      if (!scrollContainerRef.current) return;
      const target = scrollContainerRef.current;
      const width = Math.round(target.clientWidth);
      const height = Math.round(target.clientHeight);
      if (width > 0) {
        setContainerWidth((prev) => (Math.abs(prev - width) >= 2 ? width : prev));
      }
      if (height > 0) {
        setContainerHeight((prev) => (Math.abs(prev - height) >= 2 ? height : prev));
      }
    };

    commitDimensions();
    const obs = new ResizeObserver(() => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        commitDimensions();
      });
    });
    obs.observe(el);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      obs.disconnect();
    };
  }, []);

  const visiblePageRef = useRef<number>(1);
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
        if (best && best.ratio > 0 && best.page !== visiblePageRef.current) {
          visiblePageRef.current = best.page;
          setVisiblePage(best.page);
          onVisiblePageChange?.(best.page);
        }
      },
      { root: container, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    pageRefs.current.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [numPages, onVisiblePageChange]);

  const onDocumentLoadSuccess = (doc: {
    numPages: number;
    cleanup?: () => Promise<void> | void;
    destroy?: () => Promise<void> | void;
  }) => {
    pdfDocRef.current = doc;
    setNumPages(doc.numPages);
    onTotalPagesChange?.(doc.numPages);
    setDocError(null);
  };

  const onDocumentLoadError = () => {
    setDocError("Failed to render PDF. The file may be corrupted.");
  };

  useEffect(() => {
    if (!targetPage || targetPage.pageNumber < 1) return;

    scrollToPage(targetPage.pageNumber);

    if (targetPage.annotationId) {
      const annId = targetPage.annotationId;
      setPulsingAnnotationId(annId);

      let activeTimerId: ReturnType<typeof setTimeout> | null = null;
      let cancelled = false;

      const attemptFocus = (retries = 8) => {
        if (cancelled) return;
        const el = document.querySelector(
          `[data-annotation-id="${annId}"]`,
        ) as HTMLElement | null;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        } else if (retries > 0) {
          activeTimerId = setTimeout(() => attemptFocus(retries - 1), 120);
        }
      };

      activeTimerId = setTimeout(() => attemptFocus(), 80);
      const clearTimer = setTimeout(() => {
        if (!cancelled) setPulsingAnnotationId(null);
      }, 2500);

      return () => {
        cancelled = true;
        if (activeTimerId) clearTimeout(activeTimerId);
        clearTimeout(clearTimer);
      };
    }
  }, [targetPage, scrollToPage]);

  const currentZoom = zoomProp ?? 1.0;
  const effectivePageWidth = computeEffectivePdfPageWidth({
    containerWidth,
    containerHeight,
    zoom: currentZoom,
    fitMode,
    viewMode,
  });

  const spreadPairs = useMemo(() => computeSpreadPairs(numPages), [numPages]);

  const handleRegisterPageRef = useCallback(
    (pageNum: number, el: HTMLDivElement | null) => {
      if (el) pageRefs.current.set(pageNum, el);
      else pageRefs.current.delete(pageNum);
    },
    [],
  );

  const handlePageDimensionsLoad = useCallback(
    (pageNum: number, origW: number, origH: number) => {
      setPageDimensions((prev) => {
        const existing = prev[pageNum];
        if (existing && existing.width === origW && existing.height === origH) {
          return prev;
        }
        return { ...prev, [pageNum]: { width: origW, height: origH } };
      });
    },
    [],
  );

  const renderPageCard = (pageNum: number) => {
    const inWindow =
      numPages <= 6 ||
      viewMode === "single" ||
      interaction.areaSelection?.pageNum === pageNum ||
      interaction.inlineTextInput?.pageNum === pageNum ||
      isPageInVirtualWindow({
        pageNum,
        visiblePage,
        totalPages: numPages,
        viewMode,
        pinnedPage: targetPage?.pageNumber,
      });

    const pageAnns = annotationsByPage.get(pageNum) ?? EMPTY_ANNOTATIONS;
    const pagePulsingId =
      pulsingAnnotationId && pageAnns.some((a) => a.id === pulsingAnnotationId)
        ? pulsingAnnotationId
        : null;
    const pageInlineInput =
      interaction.inlineTextInput?.pageNum === pageNum
        ? interaction.inlineTextInput
        : null;
    const pageAreaSelection =
      interaction.areaSelection?.pageNum === pageNum
        ? interaction.areaSelection
        : null;

    return (
      <ViewerPageCanvas
        key={pageNum}
        pageNum={pageNum}
        inWindow={inWindow}
        effectivePageWidth={effectivePageWidth}
        rotation={rotation}
        themeMode={themeMode}
        activeTool={activeTool}
        activeColor={activeColor}
        cachedDim={pageDimensions[pageNum]}
        pageAnnotations={pageAnns}
        pulsingAnnotationId={pagePulsingId}
        inlineTextInput={pageInlineInput}
        areaSelection={pageAreaSelection}
        customTextRenderer={customTextRenderer}
        onRegisterPageRef={handleRegisterPageRef}
        onPageDimensionsLoad={handlePageDimensionsLoad}
        onPageClick={interaction.handlePageClick}
        onPageMouseDown={interaction.handlePageMouseDown}
        onPageMouseMove={interaction.handlePageMouseMove}
        onPageMouseUp={interaction.handlePageMouseUp}
        onInlineTextChange={interaction.setInlineTextInput}
        onSaveInlineText={interaction.handleSaveInlineText}
        onOpenAnnotationCard={interaction.openAnnotationCard}
      />
    );
  };

  return (
    <div className="relative flex-1 flex flex-col min-w-0 h-full overflow-hidden transition-colors bg-background">
      <div
        ref={scrollContainerRef}
        onMouseUp={interaction.handleMouseUpCombined}
        onMouseDown={interaction.handleMouseDown}
        onMouseMove={interaction.handleMouseMove}
        className={cn(
          "flex-1 w-full relative",
          currentZoom > 1.0
            ? "overflow-auto"
            : "overflow-y-auto overflow-x-hidden",
          interactionMode === "hand"
            ? "cursor-grab active:cursor-grabbing select-none"
            : "select-text",
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
          <div className="flex-1 flex items-center justify-center p-8">
            <PlaneErrorState
              title="Unable to load document"
              error={
                error ||
                docError ||
                "An error occurred while loading this document."
              }
            />
          </div>
        ) : !blobUrl ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-6">
                <DocumentPageSkeleton width={effectivePageWidth} />
              </div>
            ) : (
              <PlaneEmptyState
                variant="document"
                title="Document file not found"
                description="No valid PDF document path found for this entry."
              />
            )}
          </div>
        ) : (
          <Document
            file={blobUrl}
            options={SHARED_PDF_OPTIONS}
            className="w-full min-w-full flex flex-col items-center"
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="w-full flex flex-col items-center pb-8">
                <DocumentPageSkeleton width={effectivePageWidth} />
              </div>
            }
          >
            {viewMode === "spread" ? (
              <div className="w-full flex flex-col items-center gap-4 pb-8 max-w-[1920px] mx-auto">
                {spreadPairs.map(([p1, p2]) => (
                  <div
                    key={p1}
                    className="flex flex-row justify-center items-start gap-4"
                  >
                    {renderPageCard(p1)}
                    {p2 && renderPageCard(p2)}
                  </div>
                ))}
              </div>
            ) : viewMode === "single" ? (
              <div className="w-full flex flex-col items-center min-h-full justify-center">
                {renderPageCard(
                  Math.min(Math.max(1, visiblePage), numPages || 1),
                )}
              </div>
            ) : (
              <div className="w-full flex flex-col items-center gap-0 pb-8">
                {Array.from({ length: numPages }, (_, i) => i + 1).map(
                  (pageNum) => renderPageCard(pageNum),
                )}
              </div>
            )}
          </Document>
        )}

        {interaction.activeHighlightTooltip && (
          <AnnotationQuickEditCard
            tooltip={interaction.activeHighlightTooltip}
            visiblePage={visiblePage}
            onUpdateAnnotation={onUpdateAnnotation}
            onDeleteAnnotation={onDeleteAnnotation}
            onAddToNote={onAddToNote}
            onUpdateTooltip={interaction.setActiveHighlightTooltip}
            onClose={() => interaction.setActiveHighlightTooltip(null)}
          />
        )}

        {interaction.showFloatingMenu && interaction.selectedText && (
          <TextSelectionToolbar
            selectedText={interaction.selectedText}
            selectedPageNum={interaction.selectedPageNum}
            selectedRects={interaction.selectedRects}
            menuPosition={interaction.menuPosition}
            activeColor={activeColor}
            activeTool={activeTool}
            paper={paper}
            visiblePage={visiblePage}
            onAnnotate={onAnnotate}
            onAddToNote={onAddToNote}
            onClose={() => interaction.setShowFloatingMenu(false)}
          />
        )}
      </div>
    </div>
  );
}
