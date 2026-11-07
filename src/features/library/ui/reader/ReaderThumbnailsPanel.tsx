'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import { Document, Page } from 'react-pdf';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Bookmark, Loader2, ListTree, LayoutGrid, Highlighter, ChevronRight } from 'lucide-react';
import { setupPdfWorker, getSharedPdfDocumentOptions, isPdfDocumentValid } from '@/shared/lib/pdfjs-worker';
import { cn } from '@/shared/lib/utils';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { PlaneErrorState } from '@/shared/components/ui/PlaneErrorState';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import type { FlattenedOutlineSection } from '@/features/library/domain/reader-search-outline.domain';

setupPdfWorker();
const SHARED_PDF_OPTIONS = getSharedPdfDocumentOptions();

export const LazyThumbnailPage = React.memo(function LazyThumbnailPage({
  pageNum,
  isCurrent,
  isBookmarked = false,
  showPdfCanvas = true,
  pdfDocument,
  onJumpToPage,
  onToggleBookmarkPage,
}: {
  pageNum: number;
  isCurrent: boolean;
  isBookmarked?: boolean;
  showPdfCanvas?: boolean;
  pdfDocument?: unknown;
  onJumpToPage: (page: number) => void;
  onToggleBookmarkPage?: (page: number) => void;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center p-1 rounded-md border transition-colors group overflow-hidden",
        isCurrent
          ? "border-primary bg-muted/40"
          : "border-border hover:border-border/80 bg-card",
      )}
    >
      {onToggleBookmarkPage && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleBookmarkPage(pageNum);
          }}
          aria-label={
            isBookmarked
              ? `Remove bookmark on page ${pageNum}`
              : `Bookmark page ${pageNum}`
          }
          className={cn(
            "absolute top-1.5 right-1.5 z-10 size-5 rounded-sm flex items-center justify-center transition-opacity cursor-pointer",
            isBookmarked
              ? "opacity-100 bg-background/90 text-foreground"
              : "opacity-0 group-hover:opacity-100 bg-background/80 text-muted-foreground hover:text-foreground",
          )}
        >
          <Bookmark
            className={cn(
              "size-3 shrink-0",
              isBookmarked && "fill-foreground text-foreground",
            )}
            strokeWidth={1.5}
          />
        </button>
      )}
      <button
        type="button"
        onClick={() => onJumpToPage(pageNum)}
        className="w-full flex flex-col items-center cursor-pointer outline-none"
      >
        <div className="w-full aspect-[1/1.4] rounded-sm bg-background border border-border overflow-hidden flex items-center justify-center">
          {showPdfCanvas && isPdfDocumentValid(pdfDocument) ? (
            <Page
              pdf={isPdfDocumentValid(pdfDocument) ? (pdfDocument as never) : undefined}
              pageNumber={pageNum}
              width={100}
              devicePixelRatio={1}
              canvasBackground="#fcfcfb"
              renderTextLayer={false}
              renderAnnotationLayer={false}
              onLoadError={() => {}}
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
            isCurrent ? "font-semibold text-foreground" : "text-muted-foreground",
          )}
        >
          Page {pageNum}
        </span>
      </button>
    </div>
  );
});

export interface ThumbnailsViewProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  totalPages: number;
  currentPage: number;
  bookmarkedPages: number[];
  showBookmarkedPagesOnly: boolean;
  isEnabled: boolean;
  pdfDocument?: unknown;
  pdfBlobUrl?: string | null;
  onJumpToPage: (page: number) => void;
  onToggleBookmarkPage?: (page: number) => void;
}

export function ThumbnailsView({
  scrollContainerRef,
  totalPages,
  currentPage,
  bookmarkedPages,
  showBookmarkedPagesOnly,
  isEnabled,
  pdfDocument,
  pdfBlobUrl,
  onJumpToPage,
  onToggleBookmarkPage,
}: ThumbnailsViewProps) {
  const thumbPdfDocRef = useRef<{ cleanup?: () => Promise<void> | void } | null>(
    null,
  );

  const [loadedThumbPdfDoc, setLoadedThumbPdfDoc] = React.useState<unknown>(null);

  useEffect(() => {
    setLoadedThumbPdfDoc(null);
    return () => {
      try {
        void thumbPdfDocRef.current?.cleanup?.();
      } catch {
        // Ignore cleanup errors on unmount
      }
      thumbPdfDocRef.current = null;
    };
  }, [pdfBlobUrl]);

  const bookmarkedPagesSet = useMemo(
    () => new Set(bookmarkedPages),
    [bookmarkedPages],
  );

  const filteredPageNumbers = useMemo(() => {
    if (showBookmarkedPagesOnly) {
      return [...bookmarkedPages]
        .filter((p) => p >= 1 && p <= totalPages)
        .sort((a, b) => a - b);
    }
    return Array.from({ length: Math.max(0, totalPages) }, (_, i) => i + 1);
  }, [showBookmarkedPagesOnly, bookmarkedPages, totalPages]);

  const numRows = Math.ceil(filteredPageNumbers.length / 2);
  const thumbVirtualizer = useVirtualizer({
    count: numRows,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 196,
    overscan: 4,
    enabled: isEnabled,
  });

  if (totalPages === 0) {
    return (
      <PlaneEmptyState
        variant="document"
        title="No pages found"
        description="Unable to detect pages for thumbnail rendering."
        isCompact
      />
    );
  }

  if (showBookmarkedPagesOnly && filteredPageNumbers.length === 0) {
    return (
      <PlaneEmptyState
        variant="document"
        title="No bookmarked pages"
        description="Bookmark pages from the toolbar or thumbnail cards to quickly jump back to them."
        isCompact
      />
    );
  }

  const validSharedDoc = isPdfDocumentValid(pdfDocument) ? pdfDocument : null;
  const validThumbDoc = isPdfDocumentValid(loadedThumbPdfDoc) ? loadedThumbPdfDoc : null;
  const effectivePdfDoc = validSharedDoc || validThumbDoc;
  const hasSharedPdfDoc = Boolean(validSharedDoc);
  const showPdfCanvas = Boolean(effectivePdfDoc);

  const gridElement = (
    <div
      className="relative w-full p-1"
      style={{ height: `${thumbVirtualizer.getTotalSize()}px` }}
    >
      {thumbVirtualizer.getVirtualItems().map((virtualRow) => {
        const p1 = filteredPageNumbers[virtualRow.index * 2];
        const p2 = filteredPageNumbers[virtualRow.index * 2 + 1] ?? null;
        if (p1 === undefined) return null;
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
              isBookmarked={bookmarkedPagesSet.has(p1)}
              showPdfCanvas={showPdfCanvas}
              pdfDocument={effectivePdfDoc}
              onJumpToPage={onJumpToPage}
              onToggleBookmarkPage={onToggleBookmarkPage}
            />
            {p2 !== null && (
              <LazyThumbnailPage
                pageNum={p2}
                isCurrent={p2 === currentPage}
                isBookmarked={bookmarkedPagesSet.has(p2)}
                showPdfCanvas={showPdfCanvas}
                pdfDocument={effectivePdfDoc}
                onJumpToPage={onJumpToPage}
                onToggleBookmarkPage={onToggleBookmarkPage}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  if (hasSharedPdfDoc && validSharedDoc) {
    return gridElement;
  }

  return pdfBlobUrl ? (
    <Document
      key={pdfBlobUrl}
      file={pdfBlobUrl}
      options={SHARED_PDF_OPTIONS}
      onLoadSuccess={(doc) => {
        thumbPdfDocRef.current = doc;
        setLoadedThumbPdfDoc(doc);
      }}
      onLoadError={() => {
        setLoadedThumbPdfDoc(null);
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
      {gridElement}
    </Document>
  ) : (
    gridElement
  );
}

export type ReaderSidebarTab = "outline" | "pages" | "annotations";

export interface ReaderLeftRailProps {
  activeTab: ReaderSidebarTab;
  onTabChange: (tab: ReaderSidebarTab) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  annotationsCount?: number;
  className?: string;
}

interface NavTabItem {
  id: ReaderSidebarTab;
  label: string;
  icon: React.ComponentType<{
    className?: string;
    strokeWidth?: number | string;
  }>;
  badge?: number;
}

/**
 * ReaderLeftRail
 * Vertical Navigation Activity Rail for the Reader Left Sidebar.
 * Mirrors the design pattern of the right InspectorTabs (w-10, h-full, border-r, icon buttons with tooltips).
 */
export function ReaderLeftRail({
  activeTab,
  onTabChange,
  isOpen,
  onToggleOpen,
  className,
}: ReaderLeftRailProps) {
  const tabs: NavTabItem[] = [
    { id: "outline", label: "Document Outline", icon: ListTree },
    { id: "pages", label: "Thumbnails & Pages", icon: LayoutGrid },
    { id: "annotations", label: "Annotations & Notes", icon: Highlighter },
  ];

  return (
    <aside
      aria-label="Reader navigation bar"
      className={cn(
        "w-10 shrink-0 h-full min-h-full self-stretch border-r border-border bg-background flex flex-col items-center select-none z-20",
        className,
      )}
    >
      <div className="flex flex-col items-center gap-1 w-full pt-1 px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = isOpen && activeTab === tab.id;

          return (
            <Tooltip key={tab.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    if (!isOpen) {
                      onToggleOpen();
                    }
                    onTabChange(tab.id);
                  }}
                  className={cn(
                    "relative size-8 flex items-center justify-center rounded-md outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors cursor-pointer text-foreground before:absolute before:-inset-1.5 md:before:hidden",
                    isActive
                      ? "bg-muted text-foreground font-semibold"
                      : "text-foreground hover:bg-muted font-normal",
                  )}
                  aria-label={tab.label}
                  aria-current={isActive ? "true" : undefined}
                >
                  <Icon className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={6} className="text-xs">
                <span>{tab.label}</span>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className="flex-1" />
    </aside>
  );
}

export interface OutlineNodeItemProps {
  section: FlattenedOutlineSection;
  isCurrent: boolean;
  isCollapsed: boolean;
  isSearchingOutline: boolean;
  onToggleCollapse: (sectionId: string, e: React.MouseEvent) => void;
  onSelect: (section: FlattenedOutlineSection) => void;
}

export const OutlineNodeItem = React.memo(function OutlineNodeItem({
  section,
  isCurrent,
  isCollapsed,
  isSearchingOutline,
  onToggleCollapse,
  onSelect,
}: OutlineNodeItemProps) {
  const level = section.level ?? 1;
  const indentPx = (level - 1) * 12 + 2;

  return (
    <div
      className={cn(
        "w-full flex items-center gap-1 pr-1.5 py-1 text-left rounded-md text-12 leading-snug transition-colors group",
        isCurrent
          ? "bg-muted text-foreground font-medium"
          : "text-foreground/85 hover:bg-muted/70 hover:text-foreground font-normal",
      )}
      style={{ paddingLeft: `${indentPx}px` }}
    >
      {section.hasChildren && !isSearchingOutline ? (
        <button
          type="button"
          onClick={(e) => onToggleCollapse(section.id, e)}
          aria-label={
            isCollapsed ? `Expand ${section.title}` : `Collapse ${section.title}`
          }
          aria-expanded={!isCollapsed}
          className="size-3.5 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-background/80 shrink-0 cursor-pointer transition-colors"
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
        <span className="size-3.5 shrink-0" aria-hidden="true" />
      )}
      <button
        type="button"
        onClick={() => onSelect(section)}
        className="flex-1 min-w-0 flex items-center justify-between gap-1.5 text-left cursor-pointer outline-none py-0.5"
      >
        <span className="truncate flex-1">
          {section.num ? `${section.num} ` : ""}
          {section.title}
        </span>
        {section.page && (
          <span
            className={cn(
              "text-11 font-mono tabular-nums shrink-0 ml-1",
              isCurrent
                ? "text-foreground font-medium"
                : "text-muted-foreground group-hover:text-foreground",
            )}
          >
            {section.page}
          </span>
        )}
      </button>
    </div>
  );
});

export interface OutlineTreeViewProps {
  filteredSections: FlattenedOutlineSection[];
  activeOutlineSectionId: string | null;
  collapsedOutlineIds: ReadonlySet<string>;
  outlineFilter: string;
  onToggleCollapse: (sectionId: string, e: React.MouseEvent) => void;
  onSelectSection: (section: FlattenedOutlineSection) => void;
}

export function OutlineTreeView({
  filteredSections,
  activeOutlineSectionId,
  collapsedOutlineIds,
  outlineFilter,
  onToggleCollapse,
  onSelectSection,
}: OutlineTreeViewProps) {
  if (filteredSections.length > 0) {
    const isSearchingOutline = Boolean(outlineFilter.trim());
    return (
      <div className="space-y-0.5">
        {filteredSections.map((s, idx) => (
          <OutlineNodeItem
            key={s.id || idx}
            section={s}
            isCurrent={s.id === activeOutlineSectionId}
            isCollapsed={collapsedOutlineIds.has(s.id)}
            isSearchingOutline={isSearchingOutline}
            onToggleCollapse={onToggleCollapse}
            onSelect={onSelectSection}
          />
        ))}
      </div>
    );
  }

  if (outlineFilter) {
    return (
      <PlaneEmptyState
        variant="search"
        title="No matching headings"
        description={`No headings match "${outlineFilter}".`}
        isCompact
      />
    );
  }

  return (
    <PlaneEmptyState
      variant="document"
      title="No document outline"
      description="This PDF does not contain an embedded outline or table of contents."
      isCompact
    />
  );
}
