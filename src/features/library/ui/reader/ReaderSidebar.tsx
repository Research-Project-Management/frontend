"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Document, Page } from "react-pdf";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  setupPdfWorker,
  getSharedPdfDocumentOptions,
  releaseCanvasMemory,
} from "@/shared/lib/pdfjs-worker";

setupPdfWorker();
const SHARED_PDF_OPTIONS = getSharedPdfDocumentOptions();
import { ChevronRight, Search, X, Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { PlaneEmptyState } from "@/shared/components/ui/PlaneEmptyState";
import { PlaneErrorState } from "@/shared/components/ui/PlaneErrorState";
import { Input } from "@/shared/components/ui/input";
import type {
  DocumentFulltext,
  ReaderDocument,
} from "@/features/library/domain/types/reader.types";
import AnnotationsPanel from "./panel/AnnotationsPanel";
import { ReaderLeftRail, type ReaderSidebarTab } from "./ReaderLeftRail";
import { usePanelResize } from "@/features/library/ui/hooks/usePanelResize";

interface PdfDocumentHandle {
  cleanup?: () => Promise<void> | void;
  destroy?: () => Promise<void> | void;
}

const LazyThumbnailPage = React.memo(function LazyThumbnailPage({
  pageNum,
  isCurrent,
  showPdfCanvas = true,
  onJumpToPage,
}: {
  pageNum: number;
  isCurrent: boolean;
  showPdfCanvas?: boolean;
  onJumpToPage: (page: number) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pageCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const el = buttonRef.current;
    return () => {
      if (pageCanvasRef.current) {
        pageCanvasRef.current.width = 0;
        pageCanvasRef.current.height = 0;
        pageCanvasRef.current = null;
      }
      releaseCanvasMemory(el);
    };
  }, []);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => onJumpToPage(pageNum)}
      className={cn(
        "flex flex-col items-center p-1 rounded-md border transition-all group cursor-pointer overflow-hidden",
        isCurrent
          ? "border-primary ring-2 ring-primary bg-primary/10"
          : "border-border hover:border-border-hover bg-card",
      )}
    >
      <div className="w-full aspect-[1/1.4] rounded-sm bg-background border border-border overflow-hidden flex items-center justify-center">
        {showPdfCanvas ? (
          <Page
            pageNumber={pageNum}
            width={100}
            devicePixelRatio={1}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            canvasRef={(node) => {
              if (node) {
                pageCanvasRef.current = node;
              } else if (pageCanvasRef.current) {
                pageCanvasRef.current.width = 0;
                pageCanvasRef.current.height = 0;
                pageCanvasRef.current = null;
              }
            }}
            loading={
              <div className="size-full flex items-center justify-center text-foreground text-11 font-mono">
                {pageNum}
              </div>
            }
          />
        ) : (
          <div className="size-full flex items-center justify-center text-muted-foreground text-11 font-mono tabular-nums">
            {pageNum}
          </div>
        )}
      </div>
      <span
        className={cn(
          "text-11 font-mono tabular-nums mt-1",
          isCurrent ? "font-semibold text-primary" : "text-foreground",
        )}
      >
        Page {pageNum}
      </span>
    </button>
  );
});

export interface ReaderSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onToggleOpen?: () => void;
  currentPage: number;
  totalPages?: number;
  onJumpToPage: (page: number, annotationId?: string) => void;
  fulltext?: DocumentFulltext | null;
  paper?: ReaderDocument | null;
  scopeId?: string;
  attachmentId?: string;
  pdfBlobUrl?: string | null;
  selectedIds?: Set<string>;
  onSelectIds?: (ids: Set<string>) => void;
  onToggleSelect?: (id: string) => void;
  onBatchChangeColor?: (
    colorHex: string,
    targetIds?: string[],
  ) => Promise<void>;
  onBatchDelete?: (targetIds?: string[]) => Promise<void>;
  onBatchAddToNote?: (targetIds?: string[]) => void;
  annotations?: import("@/features/library/domain/types/reader.types").ReaderAnnotation[];
  annotationsCount?: number;
  onAddToNote?: (text: string, pageNumber?: number) => void;
}

export type SidebarProps = ReaderSidebarProps;

export function ReaderSidebar({
  isOpen,
  onClose,
  onToggleOpen,
  currentPage,
  totalPages = 1,
  onJumpToPage,
  fulltext,
  paper,
  scopeId,
  attachmentId,
  pdfBlobUrl,
  selectedIds,
  onSelectIds,
  onToggleSelect,
  onBatchChangeColor,
  onBatchDelete,
  onBatchAddToNote,
  annotations,
  annotationsCount = 0,
  onAddToNote,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<ReaderSidebarTab>("outline");
  const [outlineFilter, setOutlineFilter] = useState("");
  const [width, setWidth] = useState(288);
  const thumbContainerRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<PdfDocumentHandle | null>(null);

  useEffect(() => {
    return () => {
      const doc = pdfDocRef.current;
      pdfDocRef.current = null;
      void doc?.cleanup?.();
      void doc?.destroy?.();
    };
  }, [pdfBlobUrl]);

  const numRows = Math.ceil(Math.max(0, totalPages) / 2);
  const thumbVirtualizer = useVirtualizer({
    count: numRows,
    getScrollElement: () => thumbContainerRef.current,
    estimateSize: () => 196,
    overscan: 4,
  });

  const { isDragging, handleMouseDown } = usePanelResize({
    width,
    setWidth,
    direction: "right",
    minWidth: 240,
    maxWidth: 520,
  });

  const sections = useMemo(
    () => fulltext?.sections || [],
    [fulltext?.sections],
  );

  const filteredSections = useMemo(() => {
    if (!outlineFilter.trim()) return sections;
    const q = outlineFilter.toLowerCase().trim();
    return sections.filter(
      (s) =>
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.num && s.num.toLowerCase().includes(q)),
    );
  }, [sections, outlineFilter]);

  const panelTitle = useMemo(() => {
    switch (activeTab) {
      case "outline":
        return "Document Outline";
      case "pages":
        return "Thumbnails";
      case "annotations":
        return "Annotations";
    }
  }, [activeTab]);

  const handleToggle = onToggleOpen || onClose;

  return (
    <div className="flex h-full min-h-full self-stretch shrink-0 select-none z-20">
      {/* ── Leftmost Vertical Panel Bar (Activity Rail: w-10) ── */}
      <ReaderLeftRail
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
        }}
        isOpen={isOpen}
        onToggleOpen={handleToggle}
        annotationsCount={annotationsCount}
      />

      {/* ── Expandable Content Panel (w-72 or resized) ── */}
      {isOpen && (
        <aside
          aria-label="Document navigation panel"
          style={{ width: `${width}px` }}
          className={cn(
            "relative h-full min-h-full self-stretch border-r border-border bg-background flex flex-col shrink-0 select-text",
            isDragging && "select-none transition-none",
          )}
        >
          {/* Header with Title */}
          <div className="h-10 shrink-0 border-b border-border px-3 flex items-center bg-muted">
            <h2 className="text-12 font-semibold text-foreground truncate">
              {panelTitle}
            </h2>
          </div>

          {/* Outline Search Filter */}
          {activeTab === "outline" && sections.length > 0 && (
            <div className="p-1.5 border-b border-border bg-background shrink-0">
              <div className="relative flex items-center">
                <Search
                  className="size-3.5 absolute left-2 text-muted-foreground pointer-events-none shrink-0"
                  strokeWidth={1.5}
                />
                <Input
                  type="text"
                  value={outlineFilter}
                  onChange={(e) => setOutlineFilter(e.target.value)}
                  placeholder="Filter headings in outline..."
                  className="h-7 pl-7 pr-6 text-11 bg-background font-sans"
                />
                {outlineFilter && (
                  <button
                    type="button"
                    onClick={() => setOutlineFilter("")}
                    className="size-5 absolute right-1 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer"
                    aria-label="Clear filter"
                  >
                    <X className="size-3" strokeWidth={1.5} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Content Body */}
          <div
            ref={thumbContainerRef}
            className={cn(
              "flex-1 min-h-0",
              activeTab === "annotations"
                ? "overflow-hidden"
                : "overflow-y-auto p-2 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
            )}
          >
            {activeTab === "outline" ? (
              filteredSections.length > 0 ? (
                <div className="space-y-0.5">
                  {filteredSections.map((s, idx) => {
                    const isCurrent = s.page === currentPage;
                    const level = s.num
                      ? Math.min(4, s.num.split(".").filter(Boolean).length)
                      : 1;
                    return (
                      <button
                        key={s.id || idx}
                        type="button"
                        onClick={() => onJumpToPage(s.page || 1)}
                        className={cn(
                          "w-full flex items-start gap-1.5 px-2 py-1.5 text-left rounded-md text-12 leading-snug transition-colors cursor-pointer group",
                          isCurrent
                            ? "bg-muted text-foreground font-medium"
                            : "text-foreground hover:bg-muted text-muted-foreground hover:text-foreground",
                        )}
                        style={{ paddingLeft: `${Math.max(8, level * 10)}px` }}
                      >
                        <ChevronRight
                          className="size-3 shrink-0 mt-0.5 text-muted-foreground group-hover:text-foreground"
                          strokeWidth={1.5}
                        />
                        <span className="truncate flex-1">
                          {s.num ? `${s.num} ` : ""}
                          {s.title}
                        </span>
                        {s.page && (
                          <span className="text-11 font-mono tabular-nums text-muted-foreground group-hover:text-foreground shrink-0 ml-1">
                            {s.page}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : outlineFilter ? (
                <PlaneEmptyState
                  variant="search"
                  title="No matching headings"
                  description={`No headings match "${outlineFilter}".`}
                  action={{
                    label: "Clear filter",
                    onClick: () => setOutlineFilter(""),
                  }}
                  isCompact
                />
              ) : (
                <PlaneEmptyState
                  variant="document"
                  title="No document outline"
                  description="This PDF does not contain an embedded outline or table of contents."
                  isCompact
                />
              )
            ) : activeTab === "annotations" ? (
              paper ? (
                <AnnotationsPanel
                  paper={paper}
                  scopeId={scopeId || "user"}
                  attachmentId={attachmentId}
                  annotations={annotations}
                  onNavigateToPage={onJumpToPage}
                  selectedIds={selectedIds}
                  onSelectIds={onSelectIds}
                  onToggleSelect={onToggleSelect}
                  onBatchChangeColor={onBatchChangeColor}
                  onBatchDelete={onBatchDelete}
                  onBatchAddToNote={onBatchAddToNote}
                  onAddToNote={onAddToNote}
                />
              ) : (
                <PlaneEmptyState
                  variant="document"
                  title="No document loaded"
                  description="Load a document to view annotations and highlights."
                  isCompact
                />
              )
            ) : /* Pages grid */
            totalPages === 0 ? (
              <PlaneEmptyState
                variant="document"
                title="No pages found"
                description="Unable to detect pages for thumbnail rendering."
                isCompact
              />
            ) : pdfBlobUrl ? (
              <Document
                file={pdfBlobUrl}
                options={SHARED_PDF_OPTIONS}
                onLoadSuccess={(doc) => {
                  pdfDocRef.current = doc as unknown as PdfDocumentHandle;
                }}
                loading={
                  <div className="flex flex-col items-center justify-center p-8 text-center gap-2">
                    <Loader2
                      className="size-5 animate-spin text-muted-foreground"
                      strokeWidth={1.5}
                    />
                    <p className="text-11 font-sans text-muted-foreground">
                      Loading thumbnails...
                    </p>
                  </div>
                }
                error={
                  <PlaneErrorState
                    title="Unable to load thumbnails"
                    error="Failed to render PDF page previews."
                  />
                }
              >
                <div
                  className="relative w-full p-1"
                  style={{ height: `${thumbVirtualizer.getTotalSize()}px` }}
                >
                  {thumbVirtualizer.getVirtualItems().map((virtualRow) => {
                    const p1 = virtualRow.index * 2 + 1;
                    const p2 = p1 + 1 <= totalPages ? p1 + 1 : null;
                    return (
                      <div
                        key={virtualRow.key}
                        data-index={virtualRow.index}
                        ref={thumbVirtualizer.measureElement}
                        className="absolute top-0 left-0 w-full grid grid-cols-2 gap-2 pb-2"
                        style={{
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <LazyThumbnailPage
                          pageNum={p1}
                          isCurrent={p1 === currentPage}
                          showPdfCanvas={true}
                          onJumpToPage={onJumpToPage}
                        />
                        {p2 !== null && (
                          <LazyThumbnailPage
                            pageNum={p2}
                            isCurrent={p2 === currentPage}
                            showPdfCanvas={true}
                            onJumpToPage={onJumpToPage}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </Document>
            ) : (
              <div
                className="relative w-full p-1"
                style={{ height: `${thumbVirtualizer.getTotalSize()}px` }}
              >
                {thumbVirtualizer.getVirtualItems().map((virtualRow) => {
                  const p1 = virtualRow.index * 2 + 1;
                  const p2 = p1 + 1 <= totalPages ? p1 + 1 : null;
                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={thumbVirtualizer.measureElement}
                      className="absolute top-0 left-0 w-full grid grid-cols-2 gap-2 pb-2"
                      style={{
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <LazyThumbnailPage
                        pageNum={p1}
                        isCurrent={p1 === currentPage}
                        showPdfCanvas={false}
                        onJumpToPage={onJumpToPage}
                      />
                      {p2 !== null && (
                        <LazyThumbnailPage
                          pageNum={p2}
                          isCurrent={p2 === currentPage}
                          showPdfCanvas={false}
                          onJumpToPage={onJumpToPage}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right edge drag resize handle */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-valuenow={width}
            aria-valuemin={240}
            aria-valuemax={520}
            aria-label="Resize document navigation panel"
            tabIndex={0}
            onMouseDown={handleMouseDown}
            onDoubleClick={() => setWidth(288)}
            className="absolute top-0 bottom-0 -right-1.5 w-3 cursor-col-resize z-30 flex items-center justify-center group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <div
              className={cn(
                "w-0.5 h-full transition-colors duration-150",
                "group-hover:bg-primary",
                isDragging && "bg-primary",
              )}
            />
          </div>
        </aside>
      )}
    </div>
  );
}

export { ReaderSidebar as Sidebar };
export default ReaderSidebar;
