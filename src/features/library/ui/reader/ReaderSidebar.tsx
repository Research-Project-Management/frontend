"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Document, Page } from "react-pdf";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  setupPdfWorker,
  getSharedPdfDocumentOptions,
} from "@/shared/lib/pdfjs-worker";

setupPdfWorker();
const SHARED_PDF_OPTIONS = getSharedPdfDocumentOptions();
import {
  ChevronRight,
  Search,
  X,
  Loader2,
  Download,
  FileText,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import { PlaneEmptyState } from "@/shared/components/ui/PlaneEmptyState";
import { PlaneErrorState } from "@/shared/components/ui/PlaneErrorState";
import { Input } from "@/shared/components/ui/input";
import type {
  DocumentFulltext,
  ReaderDocument,
  PdfOutlineItem,
} from "@/features/library/domain/types/reader.types";
import {
  buildOutlineSections,
  filterVisibleOutlineSections,
  resolveActiveOutlineSectionId,
} from "@/features/library/domain/reader-persistence.helpers";
import AnnotationsPanel from "./panel/AnnotationsPanel";
import { ReaderLeftRail, type ReaderSidebarTab } from "./ReaderLeftRail";
import { usePanelResize } from "@/features/library/ui/hooks/usePanelResize";

const HeaderIconButton = ({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="size-7 flex items-center justify-center rounded-md text-foreground hover:bg-muted disabled:opacity-50 cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary"
        aria-label={label}
      >
        {children}
      </button>
    </TooltipTrigger>
    <TooltipContent side="bottom" align="end" sideOffset={6} className="text-11">
      {label}
    </TooltipContent>
  </Tooltip>
);

const HeaderSearchBar = ({
  inputRef,
  value,
  onChange,
  onClear,
  onCollapseIfEmpty,
  placeholder,
  clearLabel,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (val: string) => void;
  onClear: () => void;
  onCollapseIfEmpty: () => void;
  placeholder: string;
  clearLabel: string;
}) => (
  <div className="relative flex items-center w-full h-7 rounded-md border border-border bg-background overflow-hidden">
    <Search
      className="size-3.5 absolute left-2 text-muted-foreground pointer-events-none shrink-0"
      strokeWidth={1.5}
    />
    <Input
      ref={inputRef}
      type="text"
      autoFocus
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClear();
      }}
      onBlur={() => {
        if (!value) onCollapseIfEmpty();
      }}
      placeholder={placeholder}
      className="h-full pl-7 pr-6 text-11 border-none bg-transparent shadow-none focus-visible:ring-0 font-sans"
    />
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={onClear}
          className="size-5 absolute right-1 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer"
          aria-label={clearLabel}
        >
          <X className="size-3" strokeWidth={1.5} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4} className="text-11">
        {clearLabel}
      </TooltipContent>
    </Tooltip>
  </div>
);

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
  return (
    <button
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
            canvasBackground="#ffffff"
            renderTextLayer={false}
            renderAnnotationLayer={false}
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
  isLoadingAnnotations?: boolean;
  isAnnotationsError?: boolean;
  onRefetchAnnotations?: () => Promise<unknown> | void;
  isUpdatingAnnotation?: boolean;
  isExtractingNotes?: boolean;
  isImportingAnnotations?: boolean;
  onImportExternalAnnotations?: () => Promise<unknown> | void;
  pdfOutline?: PdfOutlineItem[];
  onAddToNote?: (text: string, pageNumber?: number, annotationId?: string) => void;
  onAskAi?: (text: string, pageNumber?: number) => void;
  onUpdateAnnotation?: (
    annotationId: string,
    expectedVersion: number | undefined,
    dto: { color?: string; comment?: string; quoteText?: string; tags?: string[] },
  ) => Promise<unknown>;
  onDeleteAnnotation?: (annotationId: string, expectedVersion?: number) => Promise<unknown>;
  onExtractNotes?: (itemId: string) => Promise<unknown> | void;
}

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
  isLoadingAnnotations = false,
  isAnnotationsError = false,
  onRefetchAnnotations,
  isUpdatingAnnotation = false,
  isExtractingNotes = false,
  isImportingAnnotations = false,
  onImportExternalAnnotations,
  pdfOutline = [],
  onAddToNote,
  onAskAi,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onExtractNotes,
}: ReaderSidebarProps) {
  const [activeTab, setActiveTab] = useState<ReaderSidebarTab>("outline");
  const [outlineFilter, setOutlineFilter] = useState("");
  const [isOutlineSearchExpanded, setIsOutlineSearchExpanded] = useState(false);
  const [annotationsSearchQuery, setAnnotationsSearchQuery] = useState("");
  const [isAnnotationsSearchExpanded, setIsAnnotationsSearchExpanded] =
    useState(false);
  const [selectedOutlineId, setSelectedOutlineId] = useState<string | null>(
    null,
  );
  const [collapsedOutlineIds, setCollapsedOutlineIds] = useState<Set<string>>(
    () => new Set(),
  );
  const outlineSearchInputRef = useRef<HTMLInputElement | null>(null);
  const annotationsSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [width, setWidth] = useState(288);
  const thumbContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSelectedOutlineId(null);
    setCollapsedOutlineIds(new Set());
  }, [paper?.id, attachmentId]);

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
    () => buildOutlineSections(fulltext?.sections, pdfOutline, outlineFilter),
    [fulltext?.sections, pdfOutline, outlineFilter],
  );

  const hasAnyOutline = Boolean(
    (fulltext?.sections && fulltext.sections.length > 0) ||
      (pdfOutline && pdfOutline.length > 0),
  );

  const filteredSections = useMemo(
    () =>
      filterVisibleOutlineSections(
        sections,
        outlineFilter,
        Boolean(fulltext?.sections && fulltext.sections.length > 0),
        collapsedOutlineIds,
      ),
    [sections, outlineFilter, fulltext?.sections, collapsedOutlineIds],
  );

  const activeOutlineSectionId = useMemo(
    () =>
      resolveActiveOutlineSectionId(
        filteredSections,
        selectedOutlineId,
        currentPage,
      ),
    [filteredSections, selectedOutlineId, currentPage],
  );

  const toggleOutlineCollapse = (sectionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setCollapsedOutlineIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

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
  const isOutlineSearchOpen =
    activeTab === "outline" &&
    (isOutlineSearchExpanded || Boolean(outlineFilter));
  const isAnnotationsSearchOpen =
    activeTab === "annotations" &&
    (isAnnotationsSearchExpanded || Boolean(annotationsSearchQuery));

  if (!isOpen) return null;

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
      <aside
          aria-label="Document navigation panel"
          style={{ width: `${width}px` }}
          className={cn(
            "relative h-full min-h-full self-stretch border-r border-border bg-background flex flex-col shrink-0 select-text",
            isDragging && "select-none transition-none",
          )}
        >
          {/* Header with Title & Right-Aligned Actions */}
          <div
            className={cn(
              "h-10 shrink-0 border-b border-border flex items-center bg-background select-none",
              isOutlineSearchOpen || isAnnotationsSearchOpen
                ? "px-2"
                : "justify-between px-3",
            )}
          >
            {isOutlineSearchOpen ? (
              <HeaderSearchBar
                inputRef={outlineSearchInputRef}
                value={outlineFilter}
                onChange={setOutlineFilter}
                onClear={() => {
                  setOutlineFilter("");
                  setIsOutlineSearchExpanded(false);
                }}
                onCollapseIfEmpty={() => setIsOutlineSearchExpanded(false)}
                placeholder="Filter headings in outline..."
                clearLabel="Clear filter"
              />
            ) : isAnnotationsSearchOpen ? (
              <HeaderSearchBar
                inputRef={annotationsSearchInputRef}
                value={annotationsSearchQuery}
                onChange={setAnnotationsSearchQuery}
                onClear={() => {
                  setAnnotationsSearchQuery("");
                  setIsAnnotationsSearchExpanded(false);
                }}
                onCollapseIfEmpty={() => setIsAnnotationsSearchExpanded(false)}
                placeholder="Search highlights..."
                clearLabel="Clear search"
              />
            ) : (
              <>
                <h2 className="text-12 font-semibold text-foreground truncate">
                  {panelTitle}
                </h2>

                <div className="flex items-center gap-0.5 shrink-0">
                  {activeTab === "outline" && (
                    <HeaderIconButton
                      onClick={() => {
                        setIsOutlineSearchExpanded(true);
                        setTimeout(
                          () => outlineSearchInputRef.current?.focus(),
                          50,
                        );
                      }}
                      disabled={!hasAnyOutline}
                      label="Filter headings in outline"
                    >
                      <Search
                        className="size-3.5 shrink-0 text-foreground"
                        strokeWidth={1.5}
                      />
                    </HeaderIconButton>
                  )}

                  {activeTab === "annotations" && (
                    <>
                      <HeaderIconButton
                        onClick={() => {
                          setIsAnnotationsSearchExpanded(true);
                          setTimeout(
                            () => annotationsSearchInputRef.current?.focus(),
                            50,
                          );
                        }}
                        disabled={(annotations?.length ?? 0) === 0}
                        label="Search highlights"
                      >
                        <Search
                          className="size-3.5 shrink-0 text-foreground"
                          strokeWidth={1.5}
                        />
                      </HeaderIconButton>

                      {onImportExternalAnnotations && (
                        <HeaderIconButton
                          onClick={() => void onImportExternalAnnotations()}
                          disabled={isImportingAnnotations}
                          label="Import embedded annotations from PDF"
                        >
                          {isImportingAnnotations ? (
                            <Loader2
                              className="size-3.5 animate-spin text-foreground shrink-0"
                              strokeWidth={1.5}
                            />
                          ) : (
                            <Download
                              className="size-3.5 text-foreground shrink-0"
                              strokeWidth={1.5}
                            />
                          )}
                        </HeaderIconButton>
                      )}

                      {paper && (
                        <HeaderIconButton
                          onClick={() => {
                            if (
                              (selectedIds?.size ?? 0) > 0 &&
                              onBatchAddToNote
                            ) {
                              onBatchAddToNote(Array.from(selectedIds!));
                            } else if (onExtractNotes) {
                              void onExtractNotes(paper.id);
                            }
                          }}
                          disabled={
                            isExtractingNotes || (annotations?.length ?? 0) === 0
                          }
                          label={
                            (selectedIds?.size ?? 0) > 0
                              ? `Add ${selectedIds!.size} selected highlights to Note`
                              : "Add all highlights to Notes"
                          }
                        >
                          {isExtractingNotes ? (
                            <Loader2
                              className="size-3.5 animate-spin text-foreground shrink-0"
                              strokeWidth={1.5}
                            />
                          ) : (
                            <FileText
                              className="size-3.5 text-foreground shrink-0"
                              strokeWidth={1.5}
                            />
                          )}
                        </HeaderIconButton>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>

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
                    const isCurrent = s.id === activeOutlineSectionId;
                    const isCollapsed = collapsedOutlineIds.has(s.id);
                    const isSearchingOutline = Boolean(outlineFilter.trim());
                    const level = s.level ?? 1;
                    const indentPx = Math.max(8, (level - 1) * 14 + 8);
                    return (
                      <div
                        key={s.id || idx}
                        className={cn(
                          "w-full flex items-center gap-1 pr-2 py-1 text-left rounded-md text-12 leading-snug transition-colors group",
                          isCurrent
                            ? "bg-muted text-foreground font-medium"
                            : "text-foreground/85 hover:bg-muted/70 hover:text-foreground font-normal",
                        )}
                        style={{ paddingLeft: `${indentPx}px` }}
                      >
                        {s.hasChildren && !isSearchingOutline ? (
                          <button
                            type="button"
                            onClick={(e) => toggleOutlineCollapse(s.id, e)}
                            aria-label={
                              isCollapsed
                                ? `Expand ${s.title}`
                                : `Collapse ${s.title}`
                            }
                            aria-expanded={!isCollapsed}
                            className="size-4 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-background/80 shrink-0 cursor-pointer transition-colors"
                          >
                            <ChevronRight
                              className={cn(
                                "size-3 shrink-0 transition-transform duration-150",
                                !isCollapsed && "rotate-90",
                              )}
                              strokeWidth={1.5}
                            />
                          </button>
                        ) : (
                          <span className="size-4 shrink-0" aria-hidden="true" />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOutlineId(s.id);
                            onJumpToPage(s.page || 1);
                          }}
                          className="flex-1 min-w-0 flex items-center justify-between gap-2 text-left cursor-pointer outline-none py-0.5"
                        >
                          <span className="truncate flex-1">
                            {s.num ? `${s.num} ` : ""}
                            {s.title}
                          </span>
                          {s.page && (
                            <span
                              className={cn(
                                "text-11 font-mono tabular-nums shrink-0",
                                isCurrent
                                  ? "text-foreground font-medium"
                                  : "text-muted-foreground group-hover:text-foreground",
                              )}
                            >
                              {s.page}
                            </span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : outlineFilter ? (
                <PlaneEmptyState
                  variant="search"
                  title="No matching headings"
                  description={`No headings match "${outlineFilter}".`}
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
                  searchQuery={annotationsSearchQuery}
                  onSearchQueryChange={setAnnotationsSearchQuery}
                  hideSearchBar={true}
                  isLoading={isLoadingAnnotations}
                  isError={isAnnotationsError}
                  refetch={onRefetchAnnotations}
                  isUpdating={isUpdatingAnnotation}
                  isExtracting={isExtractingNotes}
                  isImporting={isImportingAnnotations}
                  onImportExternal={onImportExternalAnnotations}
                  onNavigateToPage={onJumpToPage}
                  selectedIds={selectedIds}
                  onSelectIds={onSelectIds}
                  onToggleSelect={onToggleSelect}
                  onBatchChangeColor={onBatchChangeColor}
                  onBatchDelete={onBatchDelete}
                  onBatchAddToNote={onBatchAddToNote}
                  onAddToNote={onAddToNote}
                  onAskAi={onAskAi}
                  onUpdateAnnotation={onUpdateAnnotation}
                  onDeleteAnnotation={onDeleteAnnotation}
                  onExtractNotes={onExtractNotes}
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
    </div>
  );
}

export default ReaderSidebar;
