'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, Plus, X, FileText, Loader2, Upload, Link2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useLibraryUIStore, type InspectorSectionId } from '@/features/library/core/store/library-ui.store';
import { useRelations } from '@/features/library/sdk/queries/saved-searches-relations.queries';
import { useInspectorItemResolver } from '@/features/library/core/coordinator/inspector-item.coordinator';

import {
  InspectorTabs,
  INSPECTOR_LEVELS_FROM_BOTTOM,
  INSPECTOR_LEVELS,
  SECTION_TO_LEVEL,
  LEVEL_TO_SECTION,
} from './InspectorTabs';

export {
  INSPECTOR_LEVELS_FROM_BOTTOM,
  INSPECTOR_LEVELS,
  SECTION_TO_LEVEL,
  LEVEL_TO_SECTION,
};
import { usePanelResize } from '@/features/library/ui/hooks/usePanelResize';
import { InspectorHeader } from './InspectorHeader';

import dynamic from 'next/dynamic';
const InfoSection = dynamic(() => import('./InfoSection'), { ssr: false });
const AbstractSection = dynamic(() => import('./AbstractSection'), { ssr: false });
const AttachmentsSection = dynamic(() => import('./AttachmentsSection'), {
  ssr: false,
});
const CiteSection = dynamic(() => import('./CiteSection'), { ssr: false });
const NotesSection = dynamic(() => import('./NotesSection'), { ssr: false });
const TagsSection = dynamic(() => import('./TagsSection'), { ssr: false });
import CollectionsSection, { CollectionPickerPopover } from './CollectionsSection';
const RelatedSection = dynamic(() => import('./RelatedSection'), { ssr: false });

import { cn } from '@/shared/lib/utils';
import type { Item, Collection } from '@/features/library/domain/types/library.types';

interface InspectorSectionProps {
  id: InspectorSectionId;
  title: string;
  count?: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onAdd?: () => void;
  actionSlot?: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
  canEdit?: boolean;
  keepMounted?: boolean;
}

function InspectorSection({
  id,
  title,
  count,
  isExpanded,
  onToggleExpand,
  onAdd,
  actionSlot,
  children,
  contentClassName = 'px-3 pt-1.5 pb-2.5',
  canEdit = true,
  keepMounted = false,
}: InspectorSectionProps) {
  return (
    <div id={`inspector-section-${id}`} className="group/section border-b border-border last:border-b-0 w-full">
      {/* Section Header Bar: Standard h-8 height to synchronize with Table Rows */}
      <div
        onClick={onToggleExpand}
        className="flex items-center justify-between px-3 h-8 box-border select-none transition-colors w-full cursor-pointer hover:bg-muted/50"
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          aria-expanded={isExpanded}
          aria-controls={`section-content-${id}`}
          className="flex-1 flex items-center gap-1.5 min-w-0 text-left outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-xs py-0.5 cursor-pointer"
        >
          <span className="text-12 font-medium text-foreground tracking-tight">
            {title}
          </span>
          {count !== undefined && count > 0 && (
            <span className="text-11 font-mono font-medium text-foreground px-1.5 py-0.5 rounded bg-muted">
              {count}
            </span>
          )}
        </button>

        {/* Right Corner Action Cluster: [ actionSlot ] [ + ] [ > / v ] */}
        <div role="presentation" className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {actionSlot}
          {onAdd && canEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd();
                  }}
                  className="size-5 rounded flex items-center justify-center text-foreground hover:bg-muted cursor-pointer transition-colors relative before:absolute before:-inset-2.5 md:before:hidden"
                  aria-label={`Add ${title.toLowerCase()}`}
                >
                  <Plus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                {`Add ${title.toLowerCase()}`}
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand();
                }}
                className="size-5 rounded flex items-center justify-center text-foreground hover:bg-muted cursor-pointer transition-colors relative before:absolute before:-inset-2.5 md:before:hidden"
                aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
                aria-expanded={isExpanded}
                aria-controls={`section-content-${id}`}
              >
                {isExpanded ? (
                  <ChevronDown className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                ) : (
                  <ChevronRight className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6}>
              {isExpanded ? 'Collapse section' : 'Expand section'}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Section Content (collapsible) */}
      {(isExpanded || keepMounted) && (
        <div
          id={`section-content-${id}`}
          className={cn('bg-background', isExpanded ? contentClassName : 'hidden')}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export interface LibraryInspectorProps {
  item?: Item | null;
  collection?: Collection | null;
  scopeId?: string;
  canEdit?: boolean;
  onClose?: () => void;
  onSelectItem?: (itemId: string) => void;
  pendingNoteText?: string;
  onClearPendingText?: () => void;
  onNavigateToAnnotation?: (pageNumber: number, annotationId?: string) => void;
  hideRailToggle?: boolean;
  defaultOpen?: boolean;
  isReader?: boolean;
  isLibrary?: boolean;
  hideHeader?: boolean;
  hideTabs?: boolean;
}

/**
 * Autonomous Zone 4: LibraryInspector
 * Modern, high-performance, modular right-side document inspector.
 * Replaces the previous 1,300-line monolithic Panel.tsx.
 */
export function LibraryInspector(props: LibraryInspectorProps) {
  const storeIsInspectorOpen = useLibraryUIStore((s) => s.isInspectorOpen);
  const effectiveIsOpen =
    props.defaultOpen !== undefined
      ? Boolean(props.defaultOpen)
      : storeIsInspectorOpen;
  if (!effectiveIsOpen) {
    return null;
  }
  return <LibraryInspectorContent {...props} />;
}

function LibraryInspectorContent({
  item: propItem,
  scopeId,
  canEdit = true,
  onClose: propOnClose,
  onSelectItem,
  pendingNoteText,
  onClearPendingText,
  onNavigateToAnnotation,
  hideRailToggle = false,
  defaultOpen,
  isReader = false,
  isLibrary,
  hideHeader,
  hideTabs,
}: LibraryInspectorProps) {
  const shouldHideHeader = hideHeader ?? false;
  const shouldHideTabs = hideTabs ?? false;
  // Sidebar & View store state
  const storeIsInspectorOpen = useLibraryUIStore((s) => s.isInspectorOpen);
  const isInspectorOpen =
    defaultOpen !== undefined ? Boolean(defaultOpen) : storeIsInspectorOpen;
  const setIsInspectorOpen = useLibraryUIStore((s) => s.setIsInspectorOpen);
  const toggleInspector = useLibraryUIStore((s) => s.toggleInspector);
  const activeInspectorTab = useLibraryUIStore((s) => s.activeInspectorTab);
  const setActiveInspectorTab = useLibraryUIStore((s) => s.setActiveInspectorTab);

  const activeItemId = useLibraryUIStore((s) => s.activeItemId);
  const selectOnly = useLibraryUIStore((s) => s.selectOnly);
  const openModal = useLibraryUIStore((s) => s.openModal);
  const handleSelectItem = onSelectItem || selectOnly;
  const width = useLibraryUIStore((s) => s.inspectorWidth);
  const setInspectorWidth = useLibraryUIStore((s) => s.setInspectorWidth);
  const { isDragging, handleMouseDown } = usePanelResize({
    width,
    setWidth: setInspectorWidth,
    direction: 'left',
    minWidth: 300,
    maxWidth: 640,
  });
  const setWidth = useCallback(
    (nextWidth: number) => setInspectorWidth(Math.min(Math.max(nextWidth, 300), 640)),
    [setInspectorWidth],
  );
  const resetWidth = useCallback(() => setInspectorWidth(360), [setInspectorWidth]);

  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const mql = window.matchMedia('(max-width: 767px)');
      setIsMobile(mql.matches);
      const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
  }, []);

  // Scope & Item resolution via Repository / Resolver Pattern
  const {
    effectiveItem,
    targetScope,
    isLoading,
    effectiveCanEdit,
    attachmentCount,
    noteCount,
    tagsList,
    itemCollectionIds,
    handleUpdateItem,
  } = useInspectorItemResolver({ propItem, scopeId, canEdit });

  const handleClose = propOnClose || toggleInspector;

  // Collapsible section state: ONLY Details is expanded by default, all others closed
  const [expandedSections, setExpandedSections] = useState<Record<InspectorSectionId, boolean>>({
    info: true,
    abstract: false,
    files: false,
    notes: false,
    collections: false,
    tags: false,
    relations: false,
    cite: false,
  });

  const toggleSection = (id: InspectorSectionId) => {
    setExpandedSections((prev) => {
      const nextExpanded = !prev[id];
      if (nextExpanded) {
        setActiveInspectorTab(id);
      }
      return { ...prev, [id]: nextExpanded };
    });
  };

  // Add / action states for configured sections
  const attachmentsAddRef = useRef<(() => void) | null>(null);
  const attachmentsAddLinkRef = useRef<(() => void) | null>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);

  // When pending text is passed from PDF viewer (e.g. "Add to Note"), open inspector and activate notes tab
  useEffect(() => {
    if (pendingNoteText) {
      setIsInspectorOpen(true);
      setActiveInspectorTab('notes');
      setExpandedSections((prev) => ({ ...prev, notes: true }));
    }
  }, [pendingNoteText, setIsInspectorOpen, setActiveInspectorTab]);

  const [isAddRelatedOpen, setIsAddRelatedOpen] = useState(false);
  const handleAddRelatedOpenChange = useCallback((open: boolean) => {
    setIsAddRelatedOpen(open);
    if (open) {
      setExpandedSections((prev) => ({ ...prev, relations: true }));
    }
  }, []);

  // Relations data
  const { relatedItems } = useRelations(targetScope, effectiveItem?.id || '', {
    enabled: Boolean(effectiveItem?.id && expandedSections.relations),
  });

  // Section emptiness flags (to prevent empty padding when clean/empty)
  const [extractNotesState, setExtractNotesState] = useState<{
    extract: (() => Promise<void>) | null;
    isExtracting: boolean;
  }>({ extract: null, isExtracting: false });
  const handleRegisterExtract = useCallback(
    (action: { extract: () => Promise<void>; isExtracting: boolean }) => {
      setExtractNotesState(action);
    },
    [],
  );

  const hasFiles = Boolean(
    effectiveItem?.filename ||
    (effectiveItem?.attachments && effectiveItem.attachments.length > 0) ||
    effectiveItem?.openAccessPdfUrl ||
    effectiveItem?.url
  );
  const hasAbstract = Boolean(
    effectiveItem?.abstractNote
  );
  const hasNotes = noteCount > 0 || isAddingNote;
  const hasTags = tagsList.length > 0 || isAddingTag;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Tab change: Selecting a tab from the vertical rail expands that section and scrolls to it
  const handleTabChange = (tabId: InspectorSectionId) => {
    setActiveInspectorTab(tabId);
    setExpandedSections((prev) => ({
      ...prev,
      [tabId]: true,
    }));

    const container = scrollContainerRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      const targetElement = document.getElementById(`inspector-section-${tabId}`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  };

  const inspectorContent = (
    <>
      {effectiveItem ? (
            <>
              {/* Header with Title and Quick Actions */}
              {!shouldHideHeader && (
                <InspectorHeader
                  item={effectiveItem}
                  scopeId={targetScope}
                  canEdit={effectiveCanEdit}
                  onClose={handleClose}
                />
              )}

              {/* Scrollable Collapsible Sections */}
              <div
                ref={scrollContainerRef}
                className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-background inspector-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              >
                {/* 1. Details */}
                <InspectorSection
                  id="info"
                  title="Details"
                  isExpanded={expandedSections.info}
                  onToggleExpand={() => toggleSection('info')}
                  contentClassName="px-3 pt-1.5 pb-2.5 flex flex-col gap-1"
                  canEdit={effectiveCanEdit}
                >
                  <InfoSection
                    key={effectiveItem.id}
                    item={effectiveItem}
                    onUpdateItem={handleUpdateItem}
                    canEdit={effectiveCanEdit}
                    scopeId={targetScope}
                  />
                </InspectorSection>

                {/* 2. Abstract */}
                <InspectorSection
                  id="abstract"
                  title="Abstract"
                  isExpanded={expandedSections.abstract}
                  onToggleExpand={() => toggleSection('abstract')}
                  onAdd={
                    !hasAbstract && effectiveCanEdit
                      ? () => {
                          setExpandedSections((prev) => ({ ...prev, abstract: true }));
                        }
                      : undefined
                  }
                  contentClassName={hasAbstract ? "px-3 pt-1.5 pb-2.5 flex flex-col gap-2" : "px-3 pt-1.5 pb-2.5"}
                  canEdit={effectiveCanEdit}
                >
                  <AbstractSection
                    key={effectiveItem.id}
                    item={effectiveItem}
                    onUpdateItem={handleUpdateItem}
                    canEdit={effectiveCanEdit}
                    hideHeader
                  />
                </InspectorSection>

                {/* 3. Attachments */}
                <InspectorSection
                  id="files"
                  title="Attachments"
                  count={attachmentCount}
                  isExpanded={expandedSections.files}
                  onToggleExpand={() => toggleSection('files')}
                  actionSlot={
                    effectiveCanEdit ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="size-5 rounded flex items-center justify-center text-foreground hover:bg-muted cursor-pointer transition-colors relative before:absolute before:-inset-2.5 md:before:hidden"
                            aria-label="Add attachment"
                          >
                            <Plus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 text-12">
                          <DropdownMenuItem
                            onClick={() => {
                              setExpandedSections((prev) => ({ ...prev, files: true }));
                              attachmentsAddRef.current?.();
                            }}
                            className="cursor-pointer gap-2"
                          >
                            <Upload className="size-3.5 shrink-0 text-muted-foreground" />
                            <span>Attach Stored File...</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setExpandedSections((prev) => ({ ...prev, files: true }));
                              attachmentsAddLinkRef.current?.();
                            }}
                            className="cursor-pointer gap-2"
                          >
                            <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
                            <span>Attach Link to URI...</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : undefined
                  }
                  contentClassName={hasFiles ? 'px-3 pt-1.5 pb-2.5 flex flex-col gap-2' : 'p-0'}
                  canEdit={effectiveCanEdit}
                  keepMounted
                >
                  <AttachmentsSection
                    item={effectiveItem}
                    scopeId={targetScope}
                    hideHeader
                    canEdit={effectiveCanEdit}
                    onRegisterAdd={(fn) => {
                      attachmentsAddRef.current = fn;
                    }}
                    onRegisterAddLink={(fn) => {
                      attachmentsAddLinkRef.current = fn;
                    }}
                  />
                </InspectorSection>

                {/* 4. Notes */}
                <InspectorSection
                  id="notes"
                  title="Notes"
                  count={noteCount}
                  isExpanded={expandedSections.notes}
                  onToggleExpand={() => toggleSection('notes')}
                  onAdd={() => {
                    setExpandedSections((prev) => ({ ...prev, notes: true }));
                    setIsAddingNote(true);
                  }}
                  actionSlot={
                    isReader && effectiveCanEdit ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              extractNotesState.extract?.();
                            }}
                            disabled={extractNotesState.isExtracting}
                            className="size-5 rounded flex items-center justify-center text-foreground hover:bg-muted cursor-pointer transition-colors relative before:absolute before:-inset-2.5 md:before:hidden disabled:opacity-50"
                            aria-label="Extract from PDF highlights"
                          >
                            {extractNotesState.isExtracting ? (
                              <Loader2 className="size-3.5 animate-spin text-foreground shrink-0" />
                            ) : (
                              <FileText
                                className="size-3.5 text-foreground shrink-0"
                                strokeWidth={1.5}
                              />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          From PDF Highlights
                        </TooltipContent>
                      </Tooltip>
                    ) : undefined
                  }
                  contentClassName={hasNotes ? 'px-3 pt-1.5 pb-2.5 flex flex-col gap-2' : 'p-0'}
                  canEdit={effectiveCanEdit}
                >
                  <NotesSection
                    item={effectiveItem}
                    scopeId={targetScope}
                    hideHeader
                    forceAdding={isAddingNote || Boolean(pendingNoteText)}
                    pendingText={pendingNoteText}
                    onClearPendingText={onClearPendingText}
                    onNavigateToAnnotation={onNavigateToAnnotation}
                    onCancelAdding={() => setIsAddingNote(false)}
                    canEdit={effectiveCanEdit}
                    isReader={isReader}
                    onRegisterExtract={handleRegisterExtract}
                  />
                </InspectorSection>

                {/* 5. Libraries and Collections */}
                <InspectorSection
                  id="collections"
                  title="Libraries and Collections"
                  count={itemCollectionIds.length}
                  isExpanded={expandedSections.collections}
                  onToggleExpand={() => toggleSection('collections')}
                  actionSlot={
                    effectiveCanEdit && effectiveItem ? (
                      <CollectionPickerPopover
                        item={effectiveItem}
                        scopeId={targetScope}
                        canEdit={effectiveCanEdit}
                        align="end"
                      >
                        <button
                          type="button"
                          className="size-5 rounded flex items-center justify-center text-foreground hover:bg-muted cursor-pointer transition-colors relative before:absolute before:-inset-2.5 md:before:hidden"
                          aria-label="Add or remove from collections"
                        >
                          <Plus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                        </button>
                      </CollectionPickerPopover>
                    ) : null
                  }
                  contentClassName="px-3 pt-1.5 pb-2.5 flex flex-col gap-1"
                  canEdit={effectiveCanEdit}
                >
                  <CollectionsSection
                    item={effectiveItem}
                    scopeId={targetScope}
                    hideHeader
                    canEdit={effectiveCanEdit}
                  />
                </InspectorSection>

                {/* 6. Tags */}
                <InspectorSection
                  id="tags"
                  title="Tags"
                  count={tagsList.length}
                  isExpanded={expandedSections.tags}
                  onToggleExpand={() => toggleSection('tags')}
                  onAdd={() => {
                    setExpandedSections((prev) => ({ ...prev, tags: true }));
                    setIsAddingTag(true);
                  }}
                  contentClassName={hasTags || isAddingTag ? 'px-3 pt-1.5 pb-2.5 flex flex-col gap-1' : 'p-0'}
                  canEdit={effectiveCanEdit}
                >
                  <TagsSection
                    item={effectiveItem}
                    precomputedTags={tagsList}
                    onUpdateItem={handleUpdateItem}
                    hideHeader
                    forceAdding={isAddingTag}
                    onCancelAdding={() => setIsAddingTag(false)}
                    canEdit={effectiveCanEdit}
                  />
                </InspectorSection>

                {/* 7. Related */}
                <InspectorSection
                  id="relations"
                  title="Related"
                  count={relatedItems.length}
                  isExpanded={expandedSections.relations}
                  onToggleExpand={() => toggleSection('relations')}
                  onAdd={() => {
                    handleAddRelatedOpenChange(true);
                  }}
                  contentClassName={relatedItems.length > 0 ? 'px-3 pt-1.5 pb-2.5 flex flex-col gap-2' : 'p-0'}
                  canEdit={effectiveCanEdit}
                >
                  <RelatedSection
                    item={effectiveItem}
                    scopeId={targetScope}
                    onSelectItem={handleSelectItem}
                    hideHeader
                    isAddOpen={isAddRelatedOpen}
                    onAddOpenChange={handleAddRelatedOpenChange}
                    canEdit={effectiveCanEdit}
                  />
                </InspectorSection>

                {/* 8. Citation */}
                <InspectorSection
                  id="cite"
                  title="Citation"
                  isExpanded={expandedSections.cite}
                  onToggleExpand={() => toggleSection('cite')}
                  contentClassName="px-3 pt-1.5 pb-2.5 flex flex-col gap-2"
                  canEdit={effectiveCanEdit}
                >
                  <CiteSection
                    item={effectiveItem}
                    scopeId={targetScope}
                  />
                </InspectorSection>
              </div>
            </>
          ) : (
            /* Empty State */
            <>
              {!shouldHideHeader && (
                <div className="sticky top-0 z-10 h-11 px-2.5 flex items-center justify-between gap-1.5 border-b border-border bg-background shrink-0 select-none">
                  <span className="text-12 font-semibold text-foreground px-1">Inspector</span>
                  {isMobile && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={handleClose}
                          className="size-7 flex items-center justify-center rounded-md hover:bg-muted text-foreground cursor-pointer shrink-0"
                          aria-label="Close inspector"
                        >
                          <X className="size-4 shrink-0 text-foreground" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" sideOffset={6}>
                        Close inspector
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}
              <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-foreground gap-2">
                {isLoading ? (
                  <p className="text-13 text-foreground">Loading item details...</p>
                ) : (
                  <>
                    <p className="text-13 font-semibold text-foreground">No item selected</p>
                    <p className="text-13 text-foreground leading-relaxed max-w-[240px]">
                      Select an item from the list to view its details, attachments, and citation metadata.
                    </p>
                  </>
                )}
              </div>
            </>
          )}
    </>
  );

  const mobileDrawer =
    isMobile && isMounted && typeof document !== 'undefined'
      ? createPortal(
          <div className="md:hidden">
            {/* Mobile Backdrop */}
            <div
              onClick={handleClose}
              className="fixed inset-0 bg-black/50 z-40"
              aria-hidden="true"
            />

            {/* Mobile Drawer */}
            <aside
              aria-label="Library Inspector"
              className="fixed inset-y-0 right-0 z-50 w-[calc(100vw-32px)] max-w-sm h-full border-l border-border bg-background flex flex-col select-text shadow-elevation-3"
            >
              {inspectorContent}
            </aside>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {mobileDrawer}
      <div className="flex h-full min-h-full self-stretch shrink-0 select-none">
        {/* Desktop In-Flow Inspector Pane */}
        {!isMobile && isInspectorOpen && (
          <aside
            style={{ width: `${width}px` }}
            className={cn(
              'relative h-full min-h-full self-stretch border-l border-border bg-background flex flex-col shrink-0 select-text',
              isDragging && 'select-none transition-none',
            )}
          >
            {/* Draggable left-border resize handle */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-valuenow={width}
              aria-valuemin={300}
              aria-valuemax={640}
              aria-label="Resize library inspector"
              tabIndex={0}
              onMouseDown={handleMouseDown}
              onDoubleClick={resetWidth}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  setWidth(width + 20);
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  setWidth(width - 20);
                } else if (e.key === 'Home') {
                  e.preventDefault();
                  setWidth(300);
                } else if (e.key === 'End') {
                  e.preventDefault();
                  setWidth(640);
                } else if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  resetWidth();
                }
              }}
              className="absolute top-0 bottom-0 -left-1.5 w-3 cursor-col-resize z-30 flex items-center justify-center group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <div
                className={cn(
                  'w-0.5 h-full transition-colors duration-150',
                  'group-hover:bg-primary',
                  isDragging && 'bg-primary',
                )}
              />
            </div>

            {inspectorContent}
          </aside>
        )}

        {/* ── Right Part: Vertical Icon Panel Bar ── */}
        {!shouldHideTabs && (
          <InspectorTabs
            activeTab={activeInspectorTab}
            onTabChange={handleTabChange}
            attachmentCount={attachmentCount}
            noteCount={noteCount}
            tagsCount={tagsList.length}
            isInspectorOpen={isInspectorOpen}
            onToggleInspector={toggleInspector}
            hideRailToggle={hideRailToggle}
          />
        )}
      </div>
    </>
  );
}

export default LibraryInspector;

