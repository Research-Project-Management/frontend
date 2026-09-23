'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Plus, Folder } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui';
import {
  useLibrarySidebarStore,
  useLibraryViewStore,
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
  contentClassName = 'px-3 py-2',
  canEdit = true,
}: InspectorSectionProps) {
  return (
    <div id={`inspector-section-${id}`} className="group/section border-b border-border/40 last:border-b-0 w-full">
      {/* Section Header Bar */}
      <div
        onClick={!isExpanded ? onToggleExpand : undefined}
        className={cn(
          "flex items-center justify-between px-3 py-1.5 min-h-[32px] select-none transition-colors w-full",
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
            <span className="text-11 font-mono font-medium text-foreground px-1 py-0.5 rounded bg-muted">
              {count}
            </span>
          )}
        </button>

        {/* Right Corner Action Cluster: [ + ] [ > / v ] */}
        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
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

  const effectiveItem = incomingItem || queriedItem || null;
  const handleClose = propOnClose || toggleInspector;

  // Calculate file & note counts for tab badges
  const attachmentCount = useMemo(() => {
    return effectiveItem?.attachments?.length || 0;
  }, [effectiveItem?.attachments]);

  const noteCount = useMemo(() => {
    return effectiveItem?.notes?.length || 0;
  }, [effectiveItem?.notes]);

  const updateMutation = useUpdateLibraryItemMutation(targetScope);

  const handleUpdatePaper = (payload: Partial<Item>) => {
    if (!effectiveItem) return;
    updateMutation.mutate({
      id: effectiveItem.id,
      payload: payload as any,
    });
  };

  // Collapsible section state (all 8 sections default expanded for effortless discovery)
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
      effectiveItem.collectionIds.forEach((id) => id && ids.add(id));
    }
    if (Array.isArray(effectiveItem.collections)) {
      effectiveItem.collections.forEach((c) => c?.id && ids.add(c.id));
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
      } as any,
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
    setExpandedSections((prev) => ({ ...prev, [tabId]: true }));
  };

  // Smoothly scroll the activated section into view and ensure expanded when changed
  useEffect(() => {
    if (!activeInspectorTab) return;
    setExpandedSections((prev) => ({ ...prev, [activeInspectorTab]: true }));
    const timer = setTimeout(() => {
      const el = document.getElementById(`inspector-section-${activeInspectorTab}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [activeInspectorTab]);

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
                className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 bg-background inspector-scrollbar"
              >
                {/* 1. Details */}
                <InspectorSection
                  id="info"
                  title="Details"
                  isExpanded={expandedSections.info}
                  onToggleExpand={() => toggleSection('info')}
                  contentClassName="px-3 py-2"
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
                  contentClassName="px-3 py-2"
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
                  contentClassName={hasFiles ? 'px-3 py-2' : 'p-0'}
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
                  contentClassName={hasNotes ? 'px-3 py-2' : 'p-0'}
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
                    canEdit && unassignedCollections.length > 0 ? (
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
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null
                  }
                  contentClassName="px-3 py-2 flex flex-col gap-1.5"
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
                  contentClassName={hasTags ? 'px-3 py-2' : 'p-0'}
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
                  isExpanded={expandedSections.relations}
                  onToggleExpand={() => toggleSection('relations')}
                  onAdd={() => {
                    setExpandedSections((prev) => ({ ...prev, relations: true }));
                    setIsAddRelatedOpen(true);
                  }}
                  contentClassName={hasRelations ? 'px-3 py-2' : 'p-0'}
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

                {/* 8. Citation */}
                <InspectorSection
                  id="cite"
                  title="Citation"
                  isExpanded={expandedSections.cite}
                  onToggleExpand={() => toggleSection('cite')}
                  contentClassName="px-3 py-2"
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
