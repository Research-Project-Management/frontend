'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import {
  useReaderUIStore,
  useReaderSidebarStore,
  useReaderViewStore,
  useReaderModalStore,
} from '../../store/reader-ui.store';
import {
  useLibraryItemDetailQuery,
  useUpdateLibraryItemMutation,
  useCollections,
  useRelations,
} from '../../data';
import type { InspectorSectionId } from '../../types/reader.types';
import { normalizeTags } from '../../utils/reader.util';

/**
 * 7 Inspector Levels counted from bottom icon to top icon:
 * Level 1: 'cite' (1 bar: Citation)
 * Level 2: 'relations' (2 bars: Related, Citation)
 * Level 3: 'tags' (3 bars: Tags, Related, Citation)
 * Level 4: 'collections' (4 bars: Collections, Tags, Related, Citation)
 * Level 5: 'notes' (5 bars: Notes, Collections, Tags, Related, Citation)
 * Level 6: 'files' (6 bars: Attachments, Notes, Collections, Tags, Related, Citation)
 * Level 7: 'info' (7 bars: Details including bibliographic metadata, authors, abstract)
 */
export const INSPECTOR_LEVELS_FROM_BOTTOM: InspectorSectionId[] = [
  'cite',
  'relations',
  'tags',
  'collections',
  'notes',
  'files',
  'info',
];

export const INSPECTOR_LEVELS = INSPECTOR_LEVELS_FROM_BOTTOM;
import { useInspectorResize } from './useInspectorResize';
import { InspectorHeader } from './InspectorHeader';
import { InspectorTabs } from './InspectorTabs';

import dynamic from 'next/dynamic';
import InfoSection from './InfoSection';
const AttachmentsSection = dynamic(() => import('./AttachmentsSection'), {
  ssr: false,
});
import CiteSection from './CiteSection';
import NotesSection from './NotesSection';
import TagsSection from './TagsSection';
import CollectionsSection from './CollectionsSection';
import RelatedSection from './RelatedSection';

import { cn } from '@/shared/lib/utils';
import type { Item, Collection } from '../../types/reader.types';

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
  contentClassName = 'pl-3 pr-1.5 pt-1.5 pb-2.5 w-full min-w-0',
  canEdit = true,
}: InspectorSectionProps) {
  return (
    <div id={`inspector-section-${id}`} className="group/section border-b border-border/60 last:border-b-0 w-full min-w-0">
      {/* Section Header Bar: Standard h-8 height to synchronize with Table Rows */}
      <div
        onClick={!isExpanded ? onToggleExpand : undefined}
        className={cn(
          "flex items-center justify-between pl-3 pr-1.5 h-8 box-border select-none transition-colors w-full",
          isExpanded
            ? "bg-transparent"
            : "bg-transparent hover:bg-muted/40 cursor-pointer"
        )}
      >
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
          aria-controls={`section-content-${id}`}
          className="flex-1 flex items-center gap-1.5 min-w-0 text-left outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-xs py-0.5 cursor-pointer"
        >
          <span className="text-12 font-medium text-foreground tracking-tight">
            {title}
          </span>
          {count !== undefined && count > 0 && (
            <span className="text-11 font-mono font-medium text-foreground px-1.5 py-0.5 rounded-md bg-muted">
              {count}
            </span>
          )}
        </button>

        {/* Right Corner Action Cluster: [ + ] [ > / v ] */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {actionSlot ? (
            actionSlot
          ) : onAdd && canEdit ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!isExpanded) {
                  onToggleExpand();
                }
                onAdd();
              }}
              className="size-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
              title={`Add ${title.toLowerCase()}`}
              aria-label={`Add ${title.toLowerCase()}`}
            >
              <Plus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            </button>
          ) : null}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="size-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
            title={isExpanded ? 'Collapse section' : 'Expand section'}
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
        </div>
      </div>

      {/* Section Content (collapsible) */}
      {isExpanded && (
        <div id={`section-content-${id}`} className={cn('bg-background w-full min-w-0', contentClassName)}>
          {children}
        </div>
      )}
    </div>
  );
}

export interface LibraryInspectorProps {
  item?: Item | null;
  paper?: Item | null;
  collection?: Collection | null;
  scopeId?: string;
  projectId?: string;
  canEdit?: boolean;
  onClose?: () => void;
  onSelectPaper?: (paperId: string) => void;
  pendingNoteText?: string;
  onClearPendingText?: () => void;
  onNavigateToAnnotation?: (pageNumber: number, annotationId?: string) => void;
}

/**
 * Autonomous Zone 4: LibraryInspector
 * Modern, high-performance, modular right-side document inspector.
 * Replaces the previous 1,300-line monolithic Panel.tsx.
 */
export function LibraryInspector({
  item: propItem,
  paper: propPaper,
  scopeId,
  projectId,
  canEdit = true,
  onClose: propOnClose,
  onSelectPaper,
  pendingNoteText,
  onClearPendingText,
  onNavigateToAnnotation,
}: LibraryInspectorProps) {
  // Sidebar & View store state
  const isInspectorOpen = useReaderSidebarStore((s) => s.isInspectorOpen);
  const setIsInspectorOpen = useReaderSidebarStore((s) => s.setIsInspectorOpen);
  const toggleInspector = useReaderSidebarStore((s) => s.toggleInspector);
  const activeInspectorTab = useReaderSidebarStore((s) => s.activeInspectorTab);
  const setActiveInspectorTab = useReaderSidebarStore((s) => s.setActiveInspectorTab);

  const activeItemId = useReaderViewStore((s) => s.activeItemId);
  const selectOnly = useReaderViewStore((s) => s.selectOnly);
  const handleSelectPaper = onSelectPaper || selectOnly;
  const openModal = useReaderModalStore((s) => s.openModal);
  const { width, isDragging, handleMouseDown, setWidth, resetWidth } = useInspectorResize();

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

  // Scope & Item resolution
  const targetScope = scopeId || projectId || 'user';
  const incomingItem = propItem || propPaper || null;

  // If item was not passed directly as a prop, query by activeItemId
  const queryItemId = !incomingItem && activeItemId ? activeItemId : undefined;
  const { data: queriedItem, isLoading } = useLibraryItemDetailQuery(
    targetScope,
    queryItemId,
  );

  const queryClient = useQueryClient();

  // Fast-lookup in existing query cache to eliminate any loading flicker/jump when clicking different papers
  // without triggering an unneeded network fetch of the entire library
  const cachedListItem = useMemo(() => {
    if (!queryItemId) return null;
    const directCached = queryClient.getQueryData<any>(['library', 'item', targetScope, queryItemId]);
    const resolvedDirect = directCached?.item ?? directCached;
    if (resolvedDirect && resolvedDirect.id === queryItemId) return resolvedDirect as Item;

    const queries = queryClient.getQueriesData<any>({ queryKey: ['library', 'items', targetScope] });
    for (const [_, data] of queries) {
      if (Array.isArray(data?.items)) {
        const found = data.items.find((it: Item) => it.id === queryItemId);
        if (found) return found;
      }
    }
    return null;
  }, [queryClient, targetScope, queryItemId]);

  // Keep previous item while switching papers to prevent unmounting and layout bounce
  const lastItemRef = useRef<Item | null>(null);
  if (queriedItem) {
    lastItemRef.current = queriedItem;
  } else if (cachedListItem) {
    lastItemRef.current = cachedListItem;
  } else if (!activeItemId) {
    lastItemRef.current = null;
  }

  const effectiveItem =
    incomingItem ||
    queriedItem ||
    cachedListItem ||
    (activeItemId ? lastItemRef.current : null);
  const handleClose = propOnClose || toggleInspector;

  // Calculate file & note counts for tab badges
  const attachmentCount = useMemo(() => {
    return effectiveItem?.attachments?.length || 0;
  }, [effectiveItem?.attachments]);

  const noteCount = useMemo(() => {
    return effectiveItem?.notes?.length || 0;
  }, [effectiveItem?.notes]);

  const updateMutation = useUpdateLibraryItemMutation(targetScope);

  const handleUpdatePaper = (
    payload: Partial<Item>,
    options?: { silent?: boolean },
  ) => {
    if (!effectiveItem) return;
    const version =
      (payload as any)?.expectedVersion ??
      (payload as any)?.version ??
      effectiveItem.version;
    const isSilent = Boolean(options?.silent || (payload as any)?.silent);
    updateMutation.mutate({
      itemId: effectiveItem.id,
      data: payload as any,
    });
  };

  // Collapsible section state: Only "Details" (info) is expanded by default, all others remain collapsed until user interaction
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    info: true,
    files: false,
    notes: false,
    collections: false,
    tags: false,
    relations: false,
    cite: false,
  });

  const toggleSection = (id: InspectorSectionId) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Add / action states for configured sections
  const attachmentsAddRef = useRef<(() => void) | null>(null);
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

  // Collections data & actions
  const { data: rawCollections } = useCollections(targetScope);
  const collections = useMemo(() => (Array.isArray(rawCollections) ? rawCollections : []), [rawCollections]);

  const itemCollectionIds = useMemo(() => {
    if (!effectiveItem) return [];
    const ids = new Set<string>();
    if (effectiveItem.collectionId) ids.add(effectiveItem.collectionId);
    if (Array.isArray(effectiveItem.collectionIds)) {
      effectiveItem.collectionIds.forEach((id: string) => id && ids.add(id));
    }
    if (Array.isArray(effectiveItem.collections)) {
      effectiveItem.collections.forEach((c: { id?: string }) => c?.id && ids.add(c.id));
    }
    return Array.from(ids);
  }, [effectiveItem]);


  // Relations data
  const { relatedItems } = useRelations(targetScope, effectiveItem?.id || '');

  // Tags list
  const tagsList = useMemo(() => {
    return normalizeTags(effectiveItem);
  }, [effectiveItem]);

  // Section emptiness flags (to prevent empty padding when clean/empty)
  const hasFiles = Boolean(
    effectiveItem?.filename ||
    (effectiveItem?.attachments && effectiveItem.attachments.length > 0) ||
    (effectiveItem as any)?.openAccessPdfUrl
  );
  const hasNotes = noteCount > 0 || isAddingNote;
  const hasTags = tagsList.length > 0 || isAddingTag;
  const hasRelations = relatedItems.length > 0 || isAddRelatedOpen;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Level calculation (Level 1 to 8 counted from bottom icon up: cite=1 ... info=8)
  const currentLevel = useMemo(() => {
    const idx = INSPECTOR_LEVELS_FROM_BOTTOM.indexOf(activeInspectorTab);
    return idx !== -1 ? idx + 1 : 8;
  }, [activeInspectorTab]);

  const visibleSectionIds = useMemo(() => {
    return new Set(INSPECTOR_LEVELS_FROM_BOTTOM.slice(0, currentLevel));
  }, [currentLevel]);

  const handleTabChange = (tabId: InspectorSectionId) => {
    setActiveInspectorTab(tabId);
    if (tabId === 'relations' && relatedItems.length === 0) {
      // Do not expand relations if empty
      const container = scrollContainerRef.current;
      if (!container) return;
      requestAnimationFrame(() => {
        const el = document.getElementById(`inspector-section-${tabId}`);
        if (el && container) {
          container.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
        }
      });
      return;
    }
    setExpandedSections((prev) => ({ ...prev, [tabId]: true }));
    const container = scrollContainerRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(`inspector-section-${tabId}`);
      if (el && container) {
        container.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
      }
    });
  };

  if (!isInspectorOpen) {
    return null;
  }

  const inspectorContent = (
    <>
      {effectiveItem ? (
            <>
              {/* Header with Title and Quick Actions */}
              <InspectorHeader
                item={effectiveItem}
                scopeId={targetScope}
                canEdit={canEdit}
                onClose={handleClose}
              />

              {/* Scrollable Collapsible Sections */}
              <div
                ref={scrollContainerRef}
                className="relative flex-1 overflow-y-auto overflow-x-hidden min-h-0 bg-background inspector-scrollbar scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              >
                {/* 1. Details (Level 8) */}
                {visibleSectionIds.has('info') && (
                  <InspectorSection
                    id="info"
                    title="Details"
                    isExpanded={expandedSections.info}
                    onToggleExpand={() => toggleSection('info')}
                    contentClassName="pl-3 pr-1 pt-1 pb-2 flex flex-col gap-0.5 w-full min-w-0"
                    canEdit={canEdit}
                  >
                    <InfoSection
                      paper={effectiveItem}
                      onUpdatePaper={handleUpdatePaper}
                      canEdit={canEdit}
                    />
                  </InspectorSection>
                )}

                {/* 2. Attachments (Level 6) */}
                {visibleSectionIds.has('files') && (
                  <InspectorSection
                    id="files"
                    title="Attachments"
                    count={attachmentCount}
                    isExpanded={expandedSections.files}
                    onToggleExpand={() => toggleSection('files')}
                    onAdd={() => {
                      setExpandedSections((prev) => ({ ...prev, files: true }));
                      attachmentsAddRef.current?.();
                    }}
                    contentClassName={hasFiles ? 'pl-3 pr-1.5 pt-1.5 pb-2.5 flex flex-col gap-2 w-full min-w-0' : 'p-0'}
                    canEdit={canEdit}
                  >
                    <AttachmentsSection
                      paper={effectiveItem}
                      scopeId={targetScope}
                      hideHeader
                      canEdit={canEdit}
                      onRegisterAdd={(fn) => {
                        attachmentsAddRef.current = fn;
                      }}
                    />
                  </InspectorSection>
                )}

                {/* 4. Notes (Level 5) */}
                {visibleSectionIds.has('notes') && (
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
                    contentClassName={hasNotes ? 'pl-3 pr-1.5 pt-1.5 pb-2.5 flex flex-col gap-2 w-full min-w-0' : 'p-0'}
                    canEdit={canEdit}
                  >
                    <NotesSection
                      paper={effectiveItem}
                      scopeId={targetScope}
                      hideHeader
                      forceAdding={isAddingNote || Boolean(pendingNoteText)}
                      pendingText={pendingNoteText}
                      onClearPendingText={onClearPendingText}
                      onNavigateToAnnotation={onNavigateToAnnotation}
                      onCancelAdding={() => setIsAddingNote(false)}
                      canEdit={canEdit}
                    />
                  </InspectorSection>
                )}

                {/* 5. Libraries and Collections (Level 4) */}
                {visibleSectionIds.has('collections') && (
                  <InspectorSection
                    id="collections"
                    title="Libraries and Collections"
                    count={itemCollectionIds.length}
                    isExpanded={expandedSections.collections}
                    onToggleExpand={() => toggleSection('collections')}
                    onAdd={() => {
                      setExpandedSections((prev) => ({ ...prev, collections: true }));
                      openModal('CREATE_COLLECTION');
                    }}
                    contentClassName="pl-3 pr-1.5 pt-1.5 pb-2.5 flex flex-col gap-1 w-full min-w-0"
                    canEdit={canEdit}
                  >
                    <CollectionsSection
                      paper={effectiveItem}
                      scopeId={targetScope}
                      hideHeader
                      canEdit={canEdit}
                    />
                  </InspectorSection>
                )}

                {/* 6. Tags (Level 3) */}
                {visibleSectionIds.has('tags') && (
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
                    contentClassName={hasTags ? 'pl-3 pr-1.5 pt-1.5 pb-2.5 flex flex-col gap-1 w-full min-w-0' : 'p-0'}
                    canEdit={canEdit}
                  >
                    <TagsSection
                      paper={effectiveItem}
                      hideHeader
                      forceAdding={isAddingTag}
                      onCancelAdding={() => setIsAddingTag(false)}
                      canEdit={canEdit}
                    />
                  </InspectorSection>
                )}

                {/* 7. Related (Level 2) */}
                {visibleSectionIds.has('relations') && (
                  <InspectorSection
                    id="relations"
                    title="Related"
                    count={relatedItems.length}
                    isExpanded={expandedSections.relations}
                    onToggleExpand={() => toggleSection('relations')}
                    onAdd={() => {
                      handleAddRelatedOpenChange(true);
                    }}
                    contentClassName={relatedItems.length > 0 ? 'pl-3 pr-1.5 pt-1.5 pb-2.5 flex flex-col gap-2 w-full min-w-0' : 'p-0'}
                    canEdit={canEdit}
                  >
                    <RelatedSection
                      paper={effectiveItem}
                      scopeId={targetScope}
                      onSelectPaper={handleSelectPaper}
                      hideHeader
                      isAddOpen={isAddRelatedOpen}
                      onAddOpenChange={handleAddRelatedOpenChange}
                      canEdit={canEdit}
                    />
                  </InspectorSection>
                )}

                {/* 8. Citation (Level 1) */}
                {visibleSectionIds.has('cite') && (
                  <InspectorSection
                    id="cite"
                    title="Citation"
                    isExpanded={expandedSections.cite}
                    onToggleExpand={() => toggleSection('cite')}
                    contentClassName="pl-3 pr-1.5 pt-1.5 pb-2.5 flex flex-col gap-2 w-full min-w-0"
                    canEdit={canEdit}
                  >
                    <CiteSection
                      paper={effectiveItem}
                      scopeId={targetScope}
                      hideHeader
                    />
                  </InspectorSection>
                )}
              </div>
            </>
          ) : (
            /* Empty State */
            <>
              <div className="sticky top-0 z-10 h-11 px-3 flex items-center justify-between border-b border-border bg-background shrink-0 select-none">
                <span className="text-12 font-semibold text-foreground">Inspector</span>
                {isMobile && (
                  <button
                    type="button"
                    onClick={handleClose}
                    className="size-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                    title="Close inspector"
                    aria-label="Close inspector"
                  >
                    <X className="size-4 shrink-0" />
                  </button>
                )}
              </div>
              <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-muted-foreground gap-2">
                {isLoading ? (
                  <p className="text-13 text-muted-foreground">Loading item details...</p>
                ) : (
                  <>
                    <p className="text-13 font-semibold text-foreground">No item selected</p>
                    <p className="text-13 text-muted-foreground leading-relaxed max-w-[240px]">
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
              className="fixed inset-0 bg-background/80 backdrop-blur-xs z-40"
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
      <div className="flex h-full shrink-0 select-none">
        {/* Desktop In-Flow Inspector Pane */}
        {!isMobile && (
          <aside
            style={{ width: `${width}px` }}
            className={cn(
              'relative h-full border-l border-border bg-background flex flex-col shrink-0 select-text',
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
                  'group-hover:bg-primary/60',
                  isDragging && 'bg-primary',
                )}
              />
            </div>

            {inspectorContent}
          </aside>
        )}

        {/* ── Right Part: Vertical Icon Panel Bar ── */}
        <InspectorTabs
          activeTab={activeInspectorTab}
          onTabChange={handleTabChange}
          attachmentCount={attachmentCount}
          noteCount={noteCount}
          isInspectorOpen={isInspectorOpen}
          onToggleInspector={toggleInspector}
        />
      </div>
    </>
  );
}

export const ReaderInspector = LibraryInspector;
export type ReaderInspectorProps = LibraryInspectorProps;
export default ReaderInspector;
