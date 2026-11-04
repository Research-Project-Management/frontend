"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Document, pdfjs } from "react-pdf";
import { PlaneEmptyState } from "@/shared/components/ui/PlaneEmptyState";
import { PlaneErrorState } from "@/shared/components/ui/PlaneErrorState";
import type {
  DocumentFulltext, ReaderDocument, ReaderAnnotation, AnnotationRect, ReaderNavigationTarget, PdfOutlineItem,
} from "@/features/library/domain/types/reader.schema";
import type { ReaderAnnotationTool } from "@/features/library/core/store/reader.store";
import { ANNOTATION_PALETTE_COLORS } from "@/features/library/ui/reader/ReaderToolbar";
import {
  computeEffectivePdfPageWidth, computeSpreadPairs, isPageInVirtualWindow, resolvePdfOutlineFromDoc, type PdfOutlineProxyDoc,
} from "@/features/library/domain/reader-search-outline";
import { useViewerSearch, ViewerSearchBar, type PdfSearchDocumentProxy } from "./ViewerSearchBar";
import { TextSelectionToolbar } from "./ViewerSmartHover";
import { AnnotationQuickEditCard } from "./PageAnnotationOverlay";
import { ViewerPageCanvas, DocumentPageSkeleton } from "./ViewerPageCanvas";
import { useViewerSmartHover, ViewerSmartHoverPopover } from "./ViewerSmartHover";
import { usePdfViewerInteraction } from "@/features/library/core/coordinator/reader/use-pdf-interaction";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { cn } from "@/shared/lib/utils";
import { setupPdfWorker, getSharedPdfDocumentOptions } from "@/shared/lib/pdfjs-worker";

export { ANNOTATION_PALETTE_COLORS, DocumentPageSkeleton };

if (typeof window !== "undefined" && pdfjs?.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
}
setupPdfWorker();
const SHARED_PDF_OPTIONS = getSharedPdfDocumentOptions();
const EMPTY_ANNOTATIONS: ReaderAnnotation[] = [];

interface ViewerProps {
  blobUrl: string | null; isLoading: boolean; error: string | null; attachmentId?: string; scopeId?: string;
  onAddToNote?: (selectedText: string, pageNumber?: number, annotationId?: string) => void;
  onAskAi?: (selectedText: string, pageNumber?: number) => void;
  onAnnotate?: (
    selectedText: string, pageNumber: number, colorHex?: string, rects?: AnnotationRect[],
    type?: "highlight" | "underline" | "note" | "text" | "rect" | "area" | "ink", comment?: string, pageLabel?: string | null,
  ) => Promise<ReaderAnnotation | void | unknown> | void;
  onUpdateAnnotation?: (
    annotationId: string, expectedVersion: number | undefined,
    dto: { color?: string; comment?: string; tags?: string[]; rects?: AnnotationRect[] },
  ) => Promise<unknown>;
  annotations?: ReaderAnnotation[]; onDeleteAnnotation?: (annotation: ReaderAnnotation) => void;
  fulltext?: DocumentFulltext | null; targetPage?: ReaderNavigationTarget | null; paper?: ReaderDocument;
  onVisiblePageChange?: (page: number) => void; onNavigateWithHistory?: (page: number) => void;
  onTotalPagesChange?: (total: number) => void; onOutlineLoad?: (outline: PdfOutlineItem[]) => void;
  onDocumentLoad?: (doc: unknown) => void; onDocumentLoaded?: (doc: unknown) => void;
  sharedPdfDocument?: unknown; onOpenInSplitView?: (pageNumber: number) => void;
  zoom?: number; onZoomChange?: (nextZoom: number) => void;
  onSelectFitMode?: (mode: "fit-width" | "fit-page" | "auto" | "custom") => void;
  rotation?: number; themeMode?: "normal" | "sepia" | "dark" | "invert";
  interactionMode?: "select" | "hand"; activeColor?: string; activeTool?: ReaderAnnotationTool;
  isSearchOpen?: boolean; onCloseSearch?: () => void; initialSearchQuery?: string;
  viewMode?: "single" | "continuous" | "spread"; fitMode?: "fit-width" | "fit-page" | "auto" | "custom";
}

export default function Viewer({
  blobUrl, isLoading, error, attachmentId, scopeId, onAddToNote, onAskAi, onAnnotate, onUpdateAnnotation,
  annotations = [], onDeleteAnnotation, fulltext, targetPage, paper,
  onVisiblePageChange, onNavigateWithHistory, onTotalPagesChange, onOutlineLoad,
  onDocumentLoad, onDocumentLoaded, sharedPdfDocument, onOpenInSplitView,
  zoom: zoomProp, onZoomChange, onSelectFitMode, rotation = 0, themeMode = "normal",
  interactionMode = "select", activeColor, activeTool = "select",
  isSearchOpen = false, onCloseSearch, initialSearchQuery,
  viewMode = "continuous", fitMode = "fit-width",
}: ViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [visiblePage, setVisiblePage] = useState<number>(1);
  const [docError, setDocError] = useState<string | null>(null);
  const [pulsingAnnotationId, setPulsingAnnotationId] = useState<string | null>(null);
  const [pdfDocument, setPdfDocument] = useState<PdfSearchDocumentProxy | null>(null);
  const pageLabelsRef = useRef<Array<string | null>>([]);
  const pdfDocRef = useRef<{ cleanup?: () => Promise<void> | void; destroy?: () => Promise<void> | void } | null>(null);

  const sharedPdfDocProxy = sharedPdfDocument as
    | (PdfSearchDocumentProxy & { cleanup?: () => Promise<void> | void; destroy?: () => Promise<void> | void })
    | null
    | undefined;
  const isSharedDocumentConsumer = Boolean(sharedPdfDocProxy);

  useEffect(() => {
    if (!sharedPdfDocProxy) return;
    pdfDocRef.current = sharedPdfDocProxy;
    setPdfDocument(sharedPdfDocProxy);
    if (typeof sharedPdfDocProxy.numPages === "number" && sharedPdfDocProxy.numPages > 0) {
      setNumPages(sharedPdfDocProxy.numPages);
      onTotalPagesChange?.(sharedPdfDocProxy.numPages);
    }
    const outlineDoc = sharedPdfDocProxy as unknown as PdfOutlineProxyDoc & {
      getPageLabels?: () => Promise<Array<string | null> | null>;
    };
    if (typeof outlineDoc.getPageLabels === "function") {
      void outlineDoc
        .getPageLabels()
        .then((labels) => {
          pageLabelsRef.current = Array.isArray(labels) ? labels : [];
        })
        .catch(() => {
          pageLabelsRef.current = [];
        });
    }
  }, [sharedPdfDocProxy, onTotalPagesChange]);

  useEffect(() => {
    setDocError(null);
    if (!sharedPdfDocProxy) {
      setNumPages(0);
    }
    setPageDimensions({});
    pageLabelsRef.current = [];
    return () => {
      if (!isSharedDocumentConsumer) {
        try {
          void pdfDocRef.current?.cleanup?.();
        } catch {
          // Ignore cleanup errors on unmount/blob transition
        }
        try {
          void pdfDocRef.current?.destroy?.();
        } catch {
          // Ignore destroy errors on unmount/blob transition
        }
      }
      pdfDocRef.current = null;
      setPdfDocument(null);
    };
  }, [blobUrl, isSharedDocumentConsumer]);

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
  const observerRef = useRef<IntersectionObserver | null>(null);
  const visiblePageRef = useRef<number>(1);
  const programmaticScrollTargetRef = useRef<{
    page: number;
    expiresAt: number;
  } | null>(null);

  const scrollToPage = useCallback(
    (page: number) => {
      programmaticScrollTargetRef.current = {
        page,
        expiresAt: Date.now() + 700,
      };
      if (page !== visiblePageRef.current) {
        visiblePageRef.current = page;
        setVisiblePage(page);
        onVisiblePageChange?.(page);
      }
      const el = pageRefs.current.get(page);
      if (el) el.scrollIntoView({ behavior: "auto", block: "start" });
    },
    [onVisiblePageChange],
  );

  const {
    searchQuery,
    setSearchQuery,
    matchCase,
    setMatchCase,
    wholeWords,
    setWholeWords,
    currentMatchIdx,
    searchMatches,
    searchInputRef,
    handleNextMatch,
    handlePrevMatch,
    customTextRenderer,
  } = useViewerSearch({
    isSearchOpen,
    initialSearchQuery,
    attachmentId,
    scopeId,
    fulltext,
    numPages,
    pageRefs,
    pdfDocument,
    scrollToPage,
  });

  const {
    smartHoverCard,
    setSmartHoverCard,
    cancelHoverDismiss,
    scheduleDismissSmartHover,
    handleContainerMouseOver,
  } = useViewerSmartHover({
    fulltext,
    numPages,
    scrollContainerRef,
  });

  const handleAnnotateWithPageLabel = useCallback(
    (
      selectedText: string,
      pageNumber: number,
      colorHex?: string,
      rects?: AnnotationRect[],
      type?: "highlight" | "underline" | "note" | "text" | "rect" | "area" | "ink",
      comment?: string,
    ) => {
      const resolvedLabel = pageLabelsRef.current[pageNumber - 1] ?? undefined;
      return onAnnotate?.(
        selectedText,
        pageNumber,
        colorHex,
        rects,
        type,
        comment,
        resolvedLabel,
      );
    },
    [onAnnotate],
  );

  const interaction = usePdfViewerInteraction({
    scrollContainerRef,
    visiblePage,
    activeTool,
    activeColor,
    interactionMode,
    onAnnotate: handleAnnotateWithPageLabel,
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
          const pendingScroll = programmaticScrollTargetRef.current;
          if (pendingScroll) {
            if (best.page === pendingScroll.page || Date.now() >= pendingScroll.expiresAt) {
              programmaticScrollTargetRef.current = null;
            } else {
              return;
            }
          }
          if (best.page !== visiblePageRef.current) {
            visiblePageRef.current = best.page;
            setVisiblePage(best.page);
            onVisiblePageChange?.(best.page);
          }
        }
      },
      { root: container, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    observerRef.current = obs;
    pageRefs.current.forEach((el) => obs.observe(el));
    return () => {
      obs.disconnect();
      observerRef.current = null;
    };
  }, [numPages, onVisiblePageChange, viewMode]);

  const onDocumentLoadSuccess = (
    doc: PdfSearchDocumentProxy & {
      cleanup?: () => Promise<void> | void;
      destroy?: () => Promise<void> | void;
    },
  ) => {
    pdfDocRef.current = doc;
    setPdfDocument(doc);
    onDocumentLoad?.(doc);
    onDocumentLoaded?.(doc);
    setNumPages(doc.numPages);
    onTotalPagesChange?.(doc.numPages);
    setDocError(null);

    const outlineDoc = doc as unknown as PdfOutlineProxyDoc & {
      getPageLabels?: () => Promise<Array<string | null> | null>;
    };

    if (typeof outlineDoc.getPageLabels === "function") {
      void outlineDoc
        .getPageLabels()
        .then((labels) => {
          pageLabelsRef.current = Array.isArray(labels) ? labels : [];
        })
        .catch(() => {
          pageLabelsRef.current = [];
        });
    }

    if (onOutlineLoad && typeof outlineDoc.getOutline === "function") {
      void resolvePdfOutlineFromDoc(outlineDoc)
        .then((resolvedOutline) => onOutlineLoad(resolvedOutline))
        .catch(() => onOutlineLoad([]));
    }
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

      let cancelled = false;
      let observer: MutationObserver | null = null;
      const safeAnnId =
        typeof CSS !== "undefined" && typeof CSS.escape === "function"
          ? CSS.escape(annId)
          : annId.replace(/(["\\])/g, "\\$1");
      const selector = `[data-annotation-id="${safeAnnId}"]`;

      const tryFocusAnnotation = (): boolean => {
        if (cancelled) return false;
        const container = scrollContainerRef.current;
        if (!container) return false;
        const el = container.querySelector(selector) as HTMLElement | null;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          observer?.disconnect();
          observer = null;
          return true;
        }
        return false;
      };

      if (!tryFocusAnnotation() && typeof MutationObserver !== "undefined") {
        const observeTarget = scrollContainerRef.current;
        if (observeTarget) {
          observer = new MutationObserver(() => {
            tryFocusAnnotation();
          });
          observer.observe(observeTarget, {
            childList: true,
            subtree: true,
          });
        }
      }

      const safetyTimeoutId = setTimeout(() => {
        observer?.disconnect();
        observer = null;
        if (!cancelled) {
          setPulsingAnnotationId(null);
        }
      }, 3000);

      return () => {
        cancelled = true;
        observer?.disconnect();
        observer = null;
        clearTimeout(safetyTimeoutId);
      };
    }
  }, [targetPage, scrollToPage]);

  const currentZoom = Math.min(5.0, Math.max(0.25, zoomProp ?? 1.0));
  const currentZoomRef = useRef<number>(currentZoom);
  currentZoomRef.current = currentZoom;
  const normalizedFitMode =
    fitMode === "fit-page" || fitMode === "auto" || fitMode === "custom"
      ? fitMode
      : "fit-width";
  const effectivePageWidth = computeEffectivePdfPageWidth({
    containerWidth,
    containerHeight,
    zoom: currentZoom,
    fitMode: normalizedFitMode,
    viewMode,
  });

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !onZoomChange) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.15 : -0.15;
      const nextZoom = Math.min(
        5.0,
        Math.max(0.25, +(currentZoomRef.current + delta).toFixed(2)),
      );
      onSelectFitMode?.("custom");
      onZoomChange(nextZoom);
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [onZoomChange, onSelectFitMode]);

  const spreadPairs = useMemo(() => computeSpreadPairs(numPages), [numPages]);

  const handleRegisterPageRef = useCallback(
    (pageNum: number, el: HTMLDivElement | null) => {
      const prevEl = pageRefs.current.get(pageNum);
      if (prevEl && prevEl !== el) {
        observerRef.current?.unobserve(prevEl);
      }
      if (el) {
        pageRefs.current.set(pageNum, el);
        observerRef.current?.observe(el);
      } else {
        pageRefs.current.delete(pageNum);
      }
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
    const pageInkDrawing =
      interaction.inkDrawing?.pageNum === pageNum
        ? interaction.inkDrawing
        : null;

    return (
      <ViewerPageCanvas
        key={pageNum} pageNum={pageNum} inWindow={inWindow}
        effectivePageWidth={effectivePageWidth} rotation={rotation} themeMode={themeMode}
        activeTool={activeTool} activeColor={activeColor} cachedDim={pageDimensions[pageNum]}
        pdfDocument={sharedPdfDocProxy} pageAnnotations={pageAnns}
        pulsingAnnotationId={pagePulsingId} inlineTextInput={pageInlineInput}
        areaSelection={pageAreaSelection} inkDrawing={pageInkDrawing}
        customTextRenderer={customTextRenderer} onRegisterPageRef={handleRegisterPageRef}
        onPageDimensionsLoad={handlePageDimensionsLoad} onPageClick={interaction.handlePageClick}
        onPageMouseDown={interaction.handlePageMouseDown} onPageMouseMove={interaction.handlePageMouseMove}
        onPageMouseUp={interaction.handlePageMouseUp} onInlineTextChange={interaction.setInlineTextInput}
        onSaveInlineText={interaction.handleSaveInlineText} onOpenAnnotationCard={interaction.openAnnotationCard}
        onDeleteAnnotation={onDeleteAnnotation} onUpdateAnnotation={onUpdateAnnotation}
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
        onMouseOver={handleContainerMouseOver}
        onMouseLeave={scheduleDismissSmartHover}
        className={cn(
          "flex-1 w-full relative bg-background",
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
            matchCase={matchCase}
            onToggleMatchCase={() => setMatchCase((v) => !v)}
            wholeWords={wholeWords}
            onToggleWholeWords={() => setWholeWords((v) => !v)}
            matchCount={searchMatches.length}
            currentMatchIdx={currentMatchIdx}
            onNextMatch={handleNextMatch}
            onPrevMatch={handlePrevMatch}
            onClose={onCloseSearch}
          />
        )}

        {smartHoverCard && (
          <ViewerSmartHoverPopover
            card={smartHoverCard}
            onCancelDismiss={cancelHoverDismiss}
            onScheduleDismiss={scheduleDismissSmartHover}
            onDismiss={() => setSmartHoverCard(null)}
            onJumpToPage={(page) => {
              if (onNavigateWithHistory) onNavigateWithHistory(page);
              else scrollToPage(page);
            }}
            onOpenInSplitView={onOpenInSplitView}
          />
        )}

        {error || docError ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
            <PlaneErrorState
              title="Unable to load document"
              error={
                error ||
                docError ||
                "An error occurred while loading this document."
              }
            />
          </div>
        ) : !blobUrl && !sharedPdfDocProxy ? (
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
        ) : sharedPdfDocProxy ? (
          <div className="w-full min-w-full flex flex-col items-center">
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
          </div>
        ) : (
          <Document
            file={blobUrl}
            options={SHARED_PDF_OPTIONS}
            externalLinkTarget="_blank"
            externalLinkRel="noopener noreferrer"
            onItemClick={({ pageNumber }) => {
              if (pageNumber >= 1) {
                if (onNavigateWithHistory) {
                  onNavigateWithHistory(pageNumber);
                } else {
                  scrollToPage(pageNumber);
                }
              }
            }}
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
            onAskAi={onAskAi}
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
            onAnnotate={handleAnnotateWithPageLabel}
            onAddToNote={onAddToNote}
            onAskAi={onAskAi}
            onClose={() => interaction.setShowFloatingMenu(false)}
          />
        )}
      </div>
    </div>
  );
}
