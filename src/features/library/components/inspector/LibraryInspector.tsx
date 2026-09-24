'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus, Folder, FolderPlus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/shared/components/ui';
import {
  useLibrarySidebarStore,
  useLibraryViewStore,
  useLibraryModalStore,
  type InspectorSectionId,
} from '../../store';
import {
  useLibraryItemDetailQuery,
  useUpdateLibraryItemMutation,
  useCollections,
  useRelations,
} from '../../data';
import { normalizeTags } from '../../domain';

export const INSPECTOR_LEVELS: InspectorSectionId[] = [
  'info',
  'abstract',
  'files',
  'notes',
  'collections',
  'tags',
  'relations',
  'cite',
];
import { useInspectorResize } from './useInspectorResize';
import { InspectorHeader } from './InspectorHeader';
import { InspectorTabs } from './InspectorTabs';

import InfoSection from './InfoSection';
import AbstractSection from './AbstractSection';
import AttachmentsSection from './AttachmentsSection';
import CiteSection from './CiteSection';
import NotesSection from './NotesSection';
import TagsSection from './TagsSection';
import CollectionsSection from './CollectionsSection';
import RelatedSection from './RelatedSection';

import { cn } from '@/shared/lib/utils';
import type { Item, Collection } from '../../types/library.types';

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
  contentClassName = 'px-[13px] pt-[5px] pb-[13px]',
  canEdit = true,
}: InspectorSectionProps) {
  return (
    <div id={`inspector-section-${id}`} className="group/section border-b border-border/60 last:border-b-0 w-full">
      {/* Section Header Bar: Exactly 34px height to synchronize with Table Rows */}
      <div
        onClick={!isExpanded ? onToggleExpand : undefined}
        className={cn(
          "flex items-center justify-between px-[13px] h-[34px] box-border select-none transition-colors w-full",
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
          className="flex-1 flex items-center gap-[5px] min-w-0 text-left outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-xs py-0.5 cursor-pointer"
        >
          <span className="text-12 font-medium text-foreground tracking-tight">
            {title}
          </span>
          {count !== undefined && count > 0 && (
            <span className="text-11 font-mono font-medium text-foreground px-[5px] py-0.5 rounded bg-muted">
              {count}
            </span>
          )}
        </button>

        {/* Right Corner Action Cluster: [ + ] [ > / v ] */}
        <div className="flex items-center gap-[5px] shrink-0" onClick={(e) => e.stopPropagation()}>
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
              className="size-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
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
            className="size-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
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
        <div id={`section-content-${id}`} className={cn('bg-background', contentClassName)}>
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
}: LibraryInspectorProps) {
  // Sidebar & View store state
  const isInspectorOpen = useLibrarySidebarStore((s) => s.isInspectorOpen);
  const toggleInspector = useLibrarySidebarStore((s) => s.toggleInspector);
  const activeInspectorTab = useLibrarySidebarStore((s) => s.activeInspectorTab);
  const setActiveInspectorTab = useLibrarySidebarStore((s) => s.setActiveInspectorTab);

  const activeItemId = useLibraryViewStore((s) => s.activeItemId);
  const openModal = useLibraryModalStore((s) => s.openModal);
  const { width, isDragging, handleMouseDown } = useInspectorResize();

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
      id: effectiveItem.id,
      payload: payload as any,
      expectedVersion: typeof version === 'number' ? version : undefined,
      silent: isSilent,
    });
  };

  // Collapsible section state: Only "Details" (info) is expanded by default, all others remain collapsed until user interaction
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
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Add / action states for configured sections
  const attachmentsAddRef = useRef<(() => void) | null>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isAddRelatedOpen, setIsAddRelatedOpen] = useState(false);

  // Collections data & actions
  const { state: colState } = useCollections(targetScope);
  const collections = useMemo(() => colState?.collections || [], [colState?.collections]);

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

  const unassignedCollections = useMemo(() => {
    if (!collections || collections.length === 0) return [];
    return collections.filter((c: Collection) => !itemCollectionIds.includes(c.id));
  }, [collections, itemCollectionIds]);

  const handleAddToCollection = (targetColId: string) => {
    if (!effectiveItem?.id) return;
    setExpandedSections((prev) => ({ ...prev, collections: true }));
    const newIds = Array.from(new Set([...itemCollectionIds, targetColId]));
    updateMutation.mutate({
      id: effectiveItem.id,
      payload: {
        collectionIds: newIds,
        collectionId: newIds[0] || null,
        expectedVersion: effectiveItem.version,
      } as any,
      expectedVersion: effectiveItem.version,
    });
  };

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

  return (
    <div className="flex h-full shrink-0 select-none">
      {/* Mobile Backdrop */}
      <div
        onClick={handleClose}
        className="fixed inset-0 bg-background/80 backdrop-blur-xs z-30 md:hidden"
        aria-hidden="true"
      />

      {/* Drawer content when open */}
      <aside
        style={{ width: `${width}px` }}
        onScroll={(e) => {
          e.currentTarget.scrollTop = 0;
        }}
        className={cn(
          'fixed inset-y-0 right-10 z-40 max-w-[calc(100vw-40px)] md:static md:max-w-none md:z-20',
          'h-full border-l border-border bg-background flex flex-col shrink-0 overflow-hidden select-text shadow-elevation-3 md:shadow-none',
          isDragging && 'select-none transition-none'
        )}
      >
        {/* Draggable left-border resize handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={width}
          aria-valuemin={320}
          aria-valuemax={640}
          aria-label="Resize library inspector"
          tabIndex={0}
          onMouseDown={handleMouseDown}
          className="absolute top-0 bottom-0 -left-1.5 w-3 cursor-col-resize z-30 flex items-center justify-center group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          title="Drag to resize inspector"
        >
          <div
            className={cn(
              "w-0.5 h-full transition-colors duration-150",
              "group-hover:bg-primary/60",
              isDragging && "bg-primary"
            )}
          />
        </div>

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
                className="relative flex-1 overflow-y-auto overflow-x-hidden min-h-0 bg-background inspector-scrollbar"
              >
                {/* 1. Details */}
                <InspectorSection
                  id="info"
                  title="Details"
                  isExpanded={expandedSections.info}
                  onToggleExpand={() => toggleSection('info')}
                  contentClassName="px-[13px] pt-[5px] pb-[13px] flex flex-col gap-[8px]"
                  canEdit={canEdit}
                >
                  <InfoSection
                    paper={effectiveItem}
                    onUpdatePaper={handleUpdatePaper}
                    canEdit={canEdit}
                  />
                </InspectorSection>

                {/* 2. Abstract */}
                <InspectorSection
                  id="abstract"
                  title="Abstract"
                  isExpanded={expandedSections.abstract}
                  onToggleExpand={() => toggleSection('abstract')}
                  contentClassName="px-[13px] pt-[5px] pb-[13px]"
                  canEdit={canEdit}
                >
                  <AbstractSection
                    paper={effectiveItem}
                    onUpdatePaper={handleUpdatePaper}
                    hideHeader
                    canEdit={canEdit}
                  />
                </InspectorSection>

                {/* 3. Attachments */}
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
                  contentClassName={hasFiles ? 'px-[13px] pt-[5px] pb-[13px] flex flex-col gap-[8px]' : 'p-0'}
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
                  contentClassName={hasNotes ? 'px-[13px] pt-[5px] pb-[13px] flex flex-col gap-[8px]' : 'p-0'}
                  canEdit={canEdit}
                >
                  <NotesSection
                    paper={effectiveItem}
                    scopeId={targetScope}
                    hideHeader
                    forceAdding={isAddingNote}
                    onCancelAdding={() => setIsAddingNote(false)}
                    canEdit={canEdit}
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
                    canEdit ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!expandedSections.collections) {
                                toggleSection('collections');
                              }
                            }}
                            className="size-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
                            title="Add to collection"
                            aria-label="Add to collection"
                          >
                            <Plus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-56 p-1.5 rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 space-y-0.5 text-xs font-sans"
                        >
                          <DropdownMenuItem
                            onClick={() => openModal('CREATE_COLLECTION')}
                            className="flex items-center gap-2 h-7 px-2 cursor-pointer text-foreground hover:bg-muted rounded-md"
                          >
                            <FolderPlus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                            <span className="font-medium">New Collection...</span>
                          </DropdownMenuItem>

                          {unassignedCollections.length > 0 ? (
                            <>
                              <DropdownMenuSeparator className="my-1" />
                              <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground">
                                Add to collection
                              </div>
                              {unassignedCollections.map((col: Collection) => (
                                <DropdownMenuItem
                                  key={col.id}
                                  onClick={() => handleAddToCollection(col.id)}
                                  className="flex items-center gap-2 h-7 px-2 cursor-pointer text-foreground hover:bg-muted rounded-md"
                                >
                                  <Folder className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                                  <span className="truncate">{col.name}</span>
                                </DropdownMenuItem>
                              ))}
                            </>
                          ) : collections.length > 0 ? (
                            <div className="px-2 py-1 text-[11px] text-muted-foreground italic">
                              All collections assigned
                            </div>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null
                  }
                  contentClassName="px-[13px] pt-[5px] pb-[13px] flex flex-col gap-[8px]"
                  canEdit={canEdit}
                >
                  <CollectionsSection
                    paper={effectiveItem}
                    scopeId={targetScope}
                    hideHeader
                    canEdit={canEdit}
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
                  contentClassName={hasTags ? 'px-[13px] pt-[5px] pb-[13px]' : 'p-0'}
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

                {/* 7. Related */}
                <InspectorSection
                  id="relations"
                  title="Related"
                  count={relatedItems.length}
                  isExpanded={Boolean(expandedSections.relations && relatedItems.length > 0)}
                  onToggleExpand={() => {
                    if (relatedItems.length === 0) {
                      return;
                    }
                    toggleSection('relations');
                  }}
                  onAdd={() => {
                    setExpandedSections((prev) => ({ ...prev, relations: true }));
                    setIsAddRelatedOpen(true);
                  }}
                  contentClassName={relatedItems.length > 0 ? 'px-[13px] pt-[5px] pb-[13px]' : 'p-0'}
                  canEdit={canEdit}
                >
                  <RelatedSection
                    paper={effectiveItem}
                    scopeId={targetScope}
                    onSelectPaper={onSelectPaper}
                    hideHeader
                    isAddOpen={isAddRelatedOpen}
                    onAddOpenChange={setIsAddRelatedOpen}
                    canEdit={canEdit}
                  />
                </InspectorSection>

                {/* Render modal dialog when collapsed/empty so Add Related modal can open */}
                {(!expandedSections.relations || relatedItems.length === 0) && isAddRelatedOpen && (
                  <RelatedSection
                    paper={effectiveItem}
                    scopeId={targetScope}
                    onSelectPaper={onSelectPaper}
                    hideHeader
                    isAddOpen={isAddRelatedOpen}
                    onAddOpenChange={setIsAddRelatedOpen}
                    canEdit={canEdit}
                  />
                )}

                {/* 8. Citation */}
                <InspectorSection
                  id="cite"
                  title="Citation"
                  isExpanded={expandedSections.cite}
                  onToggleExpand={() => toggleSection('cite')}
                  contentClassName="px-[13px] pt-[5px] pb-[13px]"
                  canEdit={canEdit}
                >
                  <CiteSection
                    paper={effectiveItem}
                    scopeId={targetScope}
                    hideHeader
                  />
                </InspectorSection>
              </div>
            </>
          ) : (
            /* Empty State */
            <>
              <div className="sticky top-0 z-10 h-11 px-3 flex items-center border-b border-border bg-background shrink-0 select-none">
                <span className="text-12 font-medium text-muted-foreground">Inspector</span>
              </div>
              <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-muted-foreground gap-2">
                {isLoading ? (
                  <p className="text-12">Loading item details...</p>
                ) : (
                  <>
                    <p className="text-12 font-medium">No item selected</p>
                    <p className="text-11 text-muted-foreground">
                      Select an item from the list to view its details, attachments, and citation metadata.
                    </p>
                  </>
                )}
              </div>
            </>
          )}
        </aside>

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
  );
}

export default LibraryInspector;
