"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Document, pdfjs } from "react-pdf";
import { PlaneEmptyState } from "@/shared/components/ui/PlaneEmptyState";
import { PlaneErrorState } from "@/shared/components/ui/PlaneErrorState";
import type {
  DocumentFulltext,
  ReaderDocument,
  ReaderAnnotation,
  AnnotationRect,
  ReaderNavigationTarget,
  PdfOutlineItem,
} from "@/features/library/domain/types/reader.types";
import type { ReaderAnnotationTool } from "@/features/library/core/store/reader.store";
import { ANNOTATION_PALETTE_COLORS } from "@/features/library/ui/reader/ReaderToolbar";
import {
  computeEffectivePdfPageWidth,
  computeSpreadPairs,
  isPageInVirtualWindow,
} from "@/features/library/domain/pdf-viewport.model";
import {
  useViewerSearch,
  ViewerSearchBar,
  type PdfSearchDocumentProxy,
} from "./ViewerSearchBar";
import { TextSelectionToolbar } from "./TextSelectionToolbar";
import { AnnotationQuickEditCard } from "./PageAnnotationOverlay";
import { DocumentPageSkeleton } from "./DocumentPageSkeleton";
import { ViewerPageCanvas } from "./ViewerPageCanvas";
import { usePdfViewerInteraction } from "./usePdfViewerInteraction";

import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { cn } from "@/shared/lib/utils";
import { setupPdfWorker, getSharedPdfDocumentOptions } from "@/shared/lib/pdfjs-worker";

export { ANNOTATION_PALETTE_COLORS, DocumentPageSkeleton };

// Register PDF.js worker synchronously before Document mounts
if (typeof window !== "undefined" && pdfjs?.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
}
setupPdfWorker();
const SHARED_PDF_OPTIONS = getSharedPdfDocumentOptions();
const EMPTY_ANNOTATIONS: ReaderAnnotation[] = [];

interface ViewerProps {
  blobUrl: string | null;
  isLoading: boolean;
  error: string | null;
  onAddToNote?: (
    selectedText: string,
    pageNumber?: number,
    annotationId?: string,
  ) => void;
  onAskAi?: (selectedText: string, pageNumber?: number) => void;
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
  targetPage?: ReaderNavigationTarget | null;
  paper?: ReaderDocument;
  onVisiblePageChange?: (page: number) => void;
  onTotalPagesChange?: (total: number) => void;
  onOutlineLoad?: (outline: PdfOutlineItem[]) => void;
  zoom?: number;
  onZoomChange?: (nextZoom: number) => void;
  onSelectFitMode?: (mode: "fit-width" | "fit-page" | "auto" | "custom") => void;
  rotation?: number;
  themeMode?: "normal" | "sepia" | "dark" | "invert";
  interactionMode?: "select" | "hand";
  activeColor?: string;
  activeTool?: ReaderAnnotationTool;
  isSearchOpen?: boolean;
  onCloseSearch?: () => void;
  initialSearchQuery?: string;
  viewMode?: "single" | "continuous" | "spread";
  fitMode?: "fit-width" | "fit-page" | "auto" | "custom";
}

export default function Viewer({
  blobUrl,
  isLoading,
  error,
  onAddToNote,
  onAskAi,
  onAnnotate,
  onUpdateAnnotation,
  annotations = [],
  onDeleteAnnotation,
  fulltext,
  targetPage,
  paper,
  onVisiblePageChange,
  onTotalPagesChange,
  onOutlineLoad,
  zoom: zoomProp,
  onZoomChange,
  onSelectFitMode,
  rotation = 0,
  themeMode = "normal",
  interactionMode = "select",
  activeColor,
  activeTool = "select",
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
  const [pdfDocument, setPdfDocument] = useState<PdfSearchDocumentProxy | null>(
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
      pdfDocRef.current = null;
      setPdfDocument(null);
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
    pdfDocument,
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

    pageRefs.current.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [numPages, onVisiblePageChange, viewMode]);

  const onDocumentLoadSuccess = (
    doc: PdfSearchDocumentProxy & {
      cleanup?: () => Promise<void> | void;
      destroy?: () => Promise<void> | void;
    },
  ) => {
    pdfDocRef.current = doc;
    setPdfDocument(doc);
    setNumPages(doc.numPages);
    onTotalPagesChange?.(doc.numPages);
    setDocError(null);

    const outlineDoc = doc as unknown as {
      getOutline?: () => Promise<
        Array<{
          title?: string;
          dest?: string | Array<unknown> | null;
          items?: Array<unknown>;
        }> | null
      >;
      getDestination?: (dest: string) => Promise<Array<unknown> | null>;
      getPageIndex?: (ref: unknown) => Promise<number>;
    };

    if (onOutlineLoad && typeof outlineDoc.getOutline === "function") {
      void (async () => {
        try {
          const rawOutline = await outlineDoc.getOutline!();
          if (!Array.isArray(rawOutline) || rawOutline.length === 0) {
            onOutlineLoad([]);
            return;
          }
          const resolvePageNum = async (
            dest: string | Array<unknown> | null | undefined,
          ): Promise<number> => {
            if (!dest) return 1;
            try {
              const destArray =
                typeof dest === "string"
                  ? typeof outlineDoc.getDestination === "function"
                    ? await outlineDoc.getDestination(dest)
                    : null
                  : Array.isArray(dest)
                    ? dest
                    : null;
              if (!destArray || destArray.length === 0) return 1;
              const pageRef = destArray[0];
              if (typeof pageRef === "number") {
                return Math.max(1, pageRef + 1);
              }
              if (pageRef && typeof outlineDoc.getPageIndex === "function") {
                const idx = await outlineDoc.getPageIndex(pageRef);
                return Math.max(1, idx + 1);
              }
            } catch {
              // Ignore destination resolution error
            }
            return 1;
          };

          const mapNodes = async (
            nodes: Array<{
              title?: string;
              dest?: string | Array<unknown> | null;
              items?: Array<unknown>;
            }>,
          ): Promise<PdfOutlineItem[]> => {
            const mapped: PdfOutlineItem[] = [];
            for (const node of nodes) {
              const title = (node.title || "").trim();
              if (!title) continue;
              const pageNumber = await resolvePageNum(node.dest);
              const children =
                Array.isArray(node.items) && node.items.length > 0
                  ? await mapNodes(
                      node.items as Array<{
                        title?: string;
                        dest?: string | Array<unknown> | null;
                        items?: Array<unknown>;
                      }>,
                    )
                  : undefined;
              mapped.push({
                title,
                pageNumber,
                dest: node.dest,
                items: children,
              });
            }
            return mapped;
          };

          const resolvedOutline = await mapNodes(rawOutline);
          onOutlineLoad(resolvedOutline);
        } catch {
          onOutlineLoad([]);
        }
      })();
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

  const currentZoom = Math.min(3.0, Math.max(0.25, zoomProp ?? 1.0));
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
      const nextZoom = Math.min(3.0, Math.max(0.25, +(currentZoom + delta).toFixed(2)));
      onSelectFitMode?.("custom");
      onZoomChange(nextZoom);
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [currentZoom, onZoomChange, onSelectFitMode]);

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
    <div className="relative flex-1 flex flex-col min-w-0 h-full overflow-hidden transition-colors bg-white dark:bg-background">
      <div
        ref={scrollContainerRef}
        onMouseUp={interaction.handleMouseUpCombined}
        onMouseDown={interaction.handleMouseDown}
        onMouseMove={interaction.handleMouseMove}
        className={cn(
          "flex-1 w-full relative bg-white dark:bg-background",
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
            externalLinkTarget="_blank"
            externalLinkRel="noopener noreferrer"
            onItemClick={({ pageNumber }) => {
              if (pageNumber >= 1) {
                scrollToPage(pageNumber);
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
            onAnnotate={onAnnotate}
            onAddToNote={onAddToNote}
            onAskAi={onAskAi}
            onClose={() => interaction.setShowFloatingMenu(false)}
          />
        )}
      </div>
    </div>
  );
}
