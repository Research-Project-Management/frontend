"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Search,
  X,
  Loader2,
  Download,
  FileText,
  Bookmark,
  Filter,
  ArrowUpDown,
  MoreHorizontal,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/shared/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import { PlaneEmptyState } from "@/shared/components/ui/PlaneEmptyState";
import { Input } from "@/shared/components/ui/input";
import type {
  DocumentFulltext,
  ReaderDocument,
  PdfOutlineItem,
} from "@/features/library/types/reader.types";
import {
  buildOutlineSections,
  filterVisibleOutlineSections,
  resolveActiveOutlineSectionId,
} from "@/features/library/domain/reader-search-outline.domain";
import AnnotationsPanel from "./AnnotationsPanel";
import { ReaderLeftRail, type ReaderSidebarTab } from "./ReaderThumbnailsPanel";
import {
  LazyThumbnailPage,
  ThumbnailsView,
  type ThumbnailsViewProps,
} from "./ReaderThumbnailsPanel";
import {
  OutlineNodeItem,
  OutlineTreeView,
  type OutlineNodeItemProps,
  type OutlineTreeViewProps,
} from "./ReaderThumbnailsPanel";
import { usePanelResize } from "@/features/library/core/coordinator/inspector-item.coordinator";

export {
  LazyThumbnailPage,
  ThumbnailsView,
  OutlineNodeItem,
  OutlineTreeView,
  type ThumbnailsViewProps,
  type OutlineNodeItemProps,
  type OutlineTreeViewProps,
};

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
      className="size-3.5 absolute left-2 text-foreground pointer-events-none shrink-0"
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
          className="size-5 absolute right-1 flex items-center justify-center text-foreground hover:bg-muted rounded-sm cursor-pointer"
          aria-label={clearLabel}
        >
          <X className="size-3 text-foreground" strokeWidth={1.5} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4} className="text-11">
        {clearLabel}
      </TooltipContent>
    </Tooltip>
  </div>
);

interface ReaderSidebarProps {
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
  pdfDocument?: unknown;
  bookmarkedPages?: number[];
  onToggleBookmarkPage?: (page: number) => void;
  selectedIds?: Set<string>;
  onSelectIds?: (ids: Set<string>) => void;
  onToggleSelect?: (id: string) => void;
  onBatchChangeColor?: (
    colorHex: string,
    targetIds?: string[],
  ) => Promise<void>;
  onBatchDelete?: (targetIds?: string[]) => Promise<void>;
  onBatchAddToNote?: (targetIds?: string[]) => void;
  annotations?: import("@/features/library/types/reader.types").ReaderAnnotation[];
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
    dto: {
      type?: import("@/features/library/types/reader.types").AnnotationType;
      color?: string;
      comment?: string;
      quoteText?: string;
      pageLabel?: string | null;
      tags?: string[];
    },
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
  pdfDocument,
  bookmarkedPages = [],
  onToggleBookmarkPage,
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
  const [annotationsTypeFilter, setAnnotationsTypeFilter] = useState<string>("all");
  const [annotationsSortBy, setAnnotationsSortBy] = useState<
    "position" | "newest" | "oldest" | "color"
  >("position");
  const [showBookmarkedPagesOnly, setShowBookmarkedPagesOnly] = useState(false);
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
            "h-10 shrink-0 border-b border-border flex items-center select-none",
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
              <h2 className="text-12 font-semibold text-foreground truncate flex items-center gap-1.5">
                <span>{panelTitle}</span>
                {activeTab === "annotations" &&
                  annotations &&
                  annotations.length > 0 && (
                    <span className="text-10 font-normal text-muted-foreground tabular-nums">
                      ({annotations.length})
                    </span>
                  )}
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

                {activeTab === "pages" && (
                  <HeaderIconButton
                    onClick={() => setShowBookmarkedPagesOnly((v) => !v)}
                    label={
                      showBookmarkedPagesOnly
                        ? "Show all pages"
                        : `Show bookmarked pages only (${bookmarkedPages.length})`
                    }
                  >
                    <Bookmark
                      className={cn(
                        "size-3.5 shrink-0 transition-colors",
                        showBookmarkedPagesOnly
                          ? "fill-foreground text-foreground"
                          : "text-foreground",
                      )}
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

                    {/* Filter by Type */}
                    <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                "size-7 rounded-md flex items-center justify-center text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary",
                                annotationsTypeFilter !== "all" &&
                                  "bg-muted font-medium text-primary",
                              )}
                              aria-label="Filter by type"
                            >
                              <Filter className="size-3.5 shrink-0" strokeWidth={1.5} />
                            </button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={6} className="text-11">
                          Filter by type
                        </TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent
                        align="end"
                        className="w-36 text-xs p-1 bg-popover border border-border shadow-raised-200 rounded-lg z-50 font-sans"
                      >
                        {(
                          [
                            ["all", "All Types"],
                            ["highlight", "Highlights"],
                            ["underline", "Underlines"],
                            ["note", "Sticky Notes"],
                            ["rect", "Area / Image"],
                            ["ink", "Freehand Ink"],
                            ["text", "Text Notes"],
                          ] as const
                        ).map(([val, label]) => (
                          <DropdownMenuItem
                            key={val}
                            onClick={() => setAnnotationsTypeFilter(val)}
                            className="cursor-pointer text-11 flex items-center justify-between text-foreground"
                          >
                            <span>{label}</span>
                            {annotationsTypeFilter === val && (
                              <Check
                                className="size-3 text-primary shrink-0"
                                strokeWidth={1.5}
                              />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Sort Order */}
                    <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="size-7 rounded-md flex items-center justify-center text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary"
                              aria-label="Sort annotations"
                            >
                              <ArrowUpDown className="size-3.5 shrink-0" strokeWidth={1.5} />
                            </button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={6} className="text-11">
                          Sort annotations
                        </TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent
                        align="end"
                        className="w-36 text-xs p-1 bg-popover border border-border shadow-raised-200 rounded-lg z-50 font-sans"
                      >
                        {(
                          [
                            ["position", "Document Order"],
                            ["newest", "Newest First"],
                            ["oldest", "Oldest First"],
                            ["color", "By Color"],
                          ] as const
                        ).map(([val, label]) => (
                          <DropdownMenuItem
                            key={val}
                            onClick={() => setAnnotationsSortBy(val)}
                            className="cursor-pointer text-11 flex items-center justify-between text-foreground"
                          >
                            <span>{label}</span>
                            {annotationsSortBy === val && (
                              <Check
                                className="size-3 text-primary shrink-0"
                                strokeWidth={1.5}
                              />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* More Options Dropdown (Zotero-style overflow menu for batch utilities) */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="size-7 rounded-md flex items-center justify-center text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary"
                          aria-label="More options"
                        >
                          <MoreHorizontal
                            className="size-3.5 shrink-0"
                            strokeWidth={1.5}
                          />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-48 text-xs p-1 bg-popover border border-border shadow-raised-200 rounded-lg z-50 font-sans"
                      >
                        {paper && onExtractNotes && (
                          <DropdownMenuItem
                            onClick={() => void onExtractNotes(paper.id)}
                            disabled={
                              isExtractingNotes ||
                              (annotations?.length ?? 0) === 0
                            }
                            className="cursor-pointer text-11 flex items-center gap-2 text-foreground"
                          >
                            {isExtractingNotes ? (
                              <Loader2
                                className="size-3.5 animate-spin text-foreground shrink-0"
                                strokeWidth={1.5}
                              />
                            ) : (
                              <FileText
                                className="size-3.5 shrink-0"
                                strokeWidth={1.5}
                              />
                            )}
                            <span>Add All to Note</span>
                          </DropdownMenuItem>
                        )}
                        {onImportExternalAnnotations && (
                          <DropdownMenuItem
                            onClick={() => void onImportExternalAnnotations()}
                            disabled={isImportingAnnotations}
                            className="cursor-pointer text-11 flex items-center gap-2 text-foreground"
                          >
                            {isImportingAnnotations ? (
                              <Loader2
                                className="size-3.5 animate-spin text-foreground shrink-0"
                                strokeWidth={1.5}
                              />
                            ) : (
                              <Download
                                className="size-3.5 shrink-0"
                                strokeWidth={1.5}
                              />
                            )}
                            <span>Import from PDF</span>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
              : activeTab === "outline"
                ? "overflow-y-auto px-1.5 py-2 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                : "overflow-y-auto p-2 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          {activeTab === "outline" ? (
            <OutlineTreeView
              filteredSections={filteredSections}
              activeOutlineSectionId={activeOutlineSectionId}
              collapsedOutlineIds={collapsedOutlineIds}
              outlineFilter={outlineFilter}
              onToggleCollapse={toggleOutlineCollapse}
              onSelectSection={(s) => {
                setSelectedOutlineId(s.id);
                onJumpToPage(s.page || 1);
              }}
            />
          ) : activeTab === "annotations" ? (
            paper ? (
              <AnnotationsPanel
                paper={paper}
                scopeId={scopeId || "user"}
                attachmentId={attachmentId}
                annotations={annotations}
                searchQuery={annotationsSearchQuery}
                onSearchQueryChange={setAnnotationsSearchQuery}
                typeFilter={annotationsTypeFilter}
                onTypeFilterChange={setAnnotationsTypeFilter}
                sortBy={annotationsSortBy}
                onSortByChange={setAnnotationsSortBy}
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
          ) : (
            <ThumbnailsView
              scrollContainerRef={thumbContainerRef}
              totalPages={totalPages}
              currentPage={currentPage}
              bookmarkedPages={bookmarkedPages}
              showBookmarkedPagesOnly={showBookmarkedPagesOnly}
              isEnabled={activeTab === "pages" && isOpen}
              pdfDocument={pdfDocument}
              pdfBlobUrl={pdfBlobUrl}
              onJumpToPage={onJumpToPage}
              onToggleBookmarkPage={onToggleBookmarkPage}
            />
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
