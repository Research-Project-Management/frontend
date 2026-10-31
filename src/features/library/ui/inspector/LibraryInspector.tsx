'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, FileText, Loader2, Upload, Link2, FolderSync } from 'lucide-react';
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

import { InspectorTabs } from './InspectorTabs';
import {
  INSPECTOR_LEVELS,
} from './inspector-levels.constants';
export {
  INSPECTOR_LEVELS,
};
import { InspectorSection, type InspectorSectionProps } from './InspectorSection';
export { InspectorSection, type InspectorSectionProps };
import { usePanelResize } from '@/features/library/ui/hooks/usePanelResize';
import { InspectorHeader } from './InspectorHeader';

import dynamic from 'next/dynamic';
const InfoSection = dynamic(() => import('./InfoSection'), { ssr: false });
const AbstractSection = dynamic(() => import('./AbstractSection'), { ssr: false });
const AttachmentsSection = dynamic(() => import('./AttachmentsSection'), { ssr: false });
const CiteSection = dynamic(() => import('./CiteSection'), { ssr: false });
const NotesSection = dynamic(() => import('./NotesSection'), { ssr: false });
const TagsSection = dynamic(() => import('./TagsSection'), { ssr: false });
const CollectionsSection = dynamic(() => import('./CollectionsSection'), { ssr: false });
const CollectionPickerPopover = dynamic(
  () => import('./CollectionsSection').then((m) => m.CollectionPickerPopover),
  { ssr: false },
);
const RelatedSection = dynamic(() => import('./RelatedSection'), { ssr: false });

import { cn } from '@/shared/lib/utils';
import type { Item } from '@/features/library/domain/types/library.types';

export interface LibraryInspectorProps {
  item?: Item | null;
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

  const selectOnly = useLibraryUIStore((s) => s.selectOnly);
  const handleSelectItem = onSelectItem || selectOnly;
  const width = useLibraryUIStore((s) => s.inspectorWidth);
  const setInspectorWidth = useLibraryUIStore((s) => s.setInspectorWidth);
  const { isDragging, handleMouseDown } = usePanelResize({
    width,
    setWidth: setInspectorWidth,
    direction: 'left',
    minWidth: 260,
    maxWidth: 640,
  });
  const setWidth = useCallback(
    (nextWidth: number) => setInspectorWidth(Math.min(Math.max(nextWidth, 260), 640)),
    [setInspectorWidth],
  );
  const resetWidth = useCallback(() => setInspectorWidth(320), [setInspectorWidth]);

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

  // Collapsible section state: All 8 sections expanded by default
  const [expandedSections, setExpandedSections] = useState<Record<InspectorSectionId, boolean>>({
    info: true,
    abstract: true,
    files: true,
    notes: true,
    collections: true,
    tags: true,
    relations: true,
    cite: true,
  });

  const needsFullDetail = Boolean(
    expandedSections.info ||
      expandedSections.abstract ||
      expandedSections.files ||
      expandedSections.notes,
  );

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
  } = useInspectorItemResolver({ propItem, scopeId, canEdit, needsFullDetail });

  const handleClose = propOnClose || toggleInspector;

  const toggleSection = (id: InspectorSectionId) => {
    setExpandedSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Add / action states for configured sections
  const attachmentsAddRef = useRef<(() => void) | null>(null);
  const attachmentsAddLinkRef = useRef<(() => void) | null>(null);
  const attachmentsFindOaPdfRef = useRef<(() => void) | null>(null);
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
    enabled: Boolean(
      effectiveItem?.id && expandedSections.relations,
    ),
  });

  // Section emptiness flags (to prevent empty padding when clean/empty)
  const [extractNotesState, setExtractNotesState] = useState<{
    extract: (() => Promise<void>) | null;
    isExtracting: boolean;
  }>({ extract: null, isExtracting: false });
  const handleRegisterExtract = useCallback(
    (action: { extract: () => Promise<void>; isExtracting: boolean }) => {
      setExtractNotesState((prev) => {
        if (
          prev.extract === action.extract &&
          prev.isExtracting === action.isExtracting
        ) {
          return prev;
        }
        return action;
      });
    },
    [],
  );

  const hasAbstract = Boolean(
    effectiveItem?.abstractNote
  );
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [highlightedSection, setHighlightedSection] = useState<InspectorSectionId | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  // Tab change: Clicking a tab in the vertical rail activates only that tab, ensures the section is expanded, and scrolls to it
  const handleTabChange = (tabId: InspectorSectionId) => {
    setActiveInspectorTab(tabId);
    setExpandedSections((prev) => ({
      ...prev,
      [tabId]: true,
    }));

    setHighlightedSection(tabId);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedSection(null);
    }, 900);

    requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      const sectionEl = document.getElementById(`inspector-section-${tabId}`);
      if (container && sectionEl) {
        const containerRect = container.getBoundingClientRect();
        const sectionRect = sectionEl.getBoundingClientRect();
        const targetTop = Math.max(
          0,
          container.scrollTop + (sectionRect.top - containerRect.top),
        );
        container.scrollTo({ top: targetTop, behavior: 'smooth' });
      } else if (sectionEl) {
        sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (container) {
        container.scrollTop = 0;
      }
    });
  };

  const inspectorContent = (
    <>
      {effectiveItem ? (
            <>
              {!shouldHideHeader && (
                <InspectorHeader
                  item={effectiveItem}
                  scopeId={targetScope}
                  canEdit={effectiveCanEdit}
                  onUpdateItem={handleUpdateItem}
                  onClose={handleClose}
                />
              )}

              {/* Scrollable Collapsible Sections */}
              <div
                ref={scrollContainerRef}
                className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-[60vh] bg-background inspector-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              >
                {/* Details */}
                <InspectorSection
                  id="info"
                  title="Details"
                  isExpanded={expandedSections.info}
                  isHighlighted={highlightedSection === 'info'}
                  onToggleExpand={() => toggleSection('info')}
                  contentClassName="px-2.5 pt-1.5 pb-2.5 flex flex-col gap-1"
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

                {/* Abstract */}
                <InspectorSection
                  id="abstract"
                  title="Abstract"
                  isExpanded={expandedSections.abstract}
                  isHighlighted={highlightedSection === 'abstract'}
                  onToggleExpand={() => toggleSection('abstract')}
                  onAdd={
                    !hasAbstract && effectiveCanEdit
                      ? () => {
                          setExpandedSections((prev) => ({ ...prev, abstract: true }));
                        }
                      : undefined
                  }
                  contentClassName={hasAbstract ? "px-2.5 pt-1.5 pb-2.5 flex flex-col gap-2" : "px-2.5 pt-1.5 pb-2.5"}
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

                {/* Attachments */}
                <InspectorSection
                  id="files"
                  title="Attachments"
                  count={attachmentCount}
                  isExpanded={expandedSections.files}
                  isHighlighted={highlightedSection === 'files'}
                  onToggleExpand={() => toggleSection('files')}
                  actionSlot={
                    effectiveCanEdit ? (
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="size-5 rounded flex items-center justify-center text-foreground hover:bg-muted cursor-pointer transition-colors relative before:absolute before:-inset-2.5 md:before:hidden"
                            aria-label="Add attachment"
                          >
                            <Plus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 text-12">
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
                          {effectiveItem.id && (
                            <DropdownMenuItem
                              onClick={() => {
                                setExpandedSections((prev) => ({ ...prev, files: true }));
                                attachmentsFindOaPdfRef.current?.();
                              }}
                              className="cursor-pointer gap-2"
                            >
                              <FolderSync className="size-3.5 shrink-0 text-muted-foreground" />
                              <span>Find Available Open Access PDF...</span>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : undefined
                  }
                  contentClassName="px-2.5 pt-1.5 pb-2.5 flex flex-col gap-2"
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
                    onRegisterFindOaPdf={(fn) => {
                      attachmentsFindOaPdfRef.current = fn;
                    }}
                  />
                </InspectorSection>

                {/* Notes */}
                <InspectorSection
                  id="notes"
                  title="Notes"
                  count={noteCount}
                  isExpanded={expandedSections.notes}
                  isHighlighted={highlightedSection === 'notes'}
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
                  contentClassName="px-2.5 pt-1.5 pb-2.5 flex flex-col gap-2"
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

                {/* Libraries and Collections */}
                <InspectorSection
                  id="collections"
                  title="Libraries and Collections"
                  count={itemCollectionIds.length}
                  isExpanded={expandedSections.collections}
                  isHighlighted={highlightedSection === 'collections'}
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
                  contentClassName="px-2.5 pt-1.5 pb-2.5 flex flex-col gap-1"
                  canEdit={effectiveCanEdit}
                >
                  <CollectionsSection
                    item={effectiveItem}
                    scopeId={targetScope}
                    hideHeader
                    canEdit={effectiveCanEdit}
                  />
                </InspectorSection>

                {/* Tags */}
                <InspectorSection
                  id="tags"
                  title="Tags"
                  count={tagsList.length}
                  isExpanded={expandedSections.tags}
                  isHighlighted={highlightedSection === 'tags'}
                  onToggleExpand={() => toggleSection('tags')}
                  onAdd={() => {
                    setExpandedSections((prev) => ({ ...prev, tags: true }));
                    setIsAddingTag(true);
                  }}
                  contentClassName="px-2.5 pt-1.5 pb-2.5 flex flex-col gap-1"
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

                {/* Related */}
                <InspectorSection
                  id="relations"
                  title="Related"
                  count={relatedItems.length}
                  isExpanded={expandedSections.relations}
                  isHighlighted={highlightedSection === 'relations'}
                  onToggleExpand={() => toggleSection('relations')}
                  onAdd={() => {
                    handleAddRelatedOpenChange(true);
                  }}
                  contentClassName="px-2.5 pt-1.5 pb-2.5 flex flex-col gap-2"
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

                {/* Citation */}
                <InspectorSection
                  id="cite"
                  title="Citation"
                  isExpanded={expandedSections.cite}
                  isHighlighted={highlightedSection === 'cite'}
                  onToggleExpand={() => toggleSection('cite')}
                  contentClassName="px-2.5 pt-1.5 pb-2.5 flex flex-col gap-2"
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
              aria-valuemin={260}
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
                  setWidth(260);
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

