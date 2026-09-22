'use client';

import React, { useMemo } from 'react';
import {
  useLibrarySidebarStore,
  useLibraryViewStore,
  type InspectorSectionId,
} from '../../store';
import { useLibraryItemDetailQuery, useUpdateLibraryItemMutation } from '../../data';
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

  if (!isInspectorOpen) {
    return null;
  }

  return (
    <div className="flex h-full shrink-0 select-none">
      {/* Drawer content when open */}
      <aside
        style={{ width: `${width}px` }}
          className={cn(
            'relative h-full border-l border-border/60 bg-background flex flex-col shrink-0 overflow-hidden select-text z-20',
            isDragging && 'select-none transition-none'
          )}
        >
          {/* Draggable left-border resize handle */}
          <div
            onMouseDown={handleMouseDown}
            className={cn(
              'absolute top-0 bottom-0 left-0 w-1.5 cursor-col-resize z-30 transition-colors',
              'hover:bg-primary/40',
              isDragging && 'bg-primary'
            )}
            title="Drag to resize inspector"
          />

          {effectiveItem ? (
            <>
              {/* Header with Title and Quick Actions */}
              <InspectorHeader
                item={effectiveItem}
                scopeId={targetScope}
                canEdit={canEdit}
                onClose={handleClose}
              />

              {/* Scrollable Tab Content View */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 bg-background divide-y divide-border/40">
                {activeInspectorTab === 'info' && (
                  <InfoSection
                    paper={effectiveItem}
                    onUpdatePaper={handleUpdatePaper}
                    canEdit={canEdit}
                  />
                )}

                {activeInspectorTab === 'abstract' && (
                  <AbstractSection
                    paper={effectiveItem}
                    canEdit={canEdit}
                  />
                )}

                {activeInspectorTab === 'files' && (
                  <AttachmentsSection
                    paper={effectiveItem}
                    scopeId={targetScope}
                    canEdit={canEdit}
                  />
                )}

                {activeInspectorTab === 'cite' && (
                  <CiteSection
                    paper={effectiveItem}
                    scopeId={targetScope}
                  />
                )}

                {activeInspectorTab === 'notes' && (
                  <NotesSection
                    paper={effectiveItem}
                    scopeId={targetScope}
                    canEdit={canEdit}
                  />
                )}

                {activeInspectorTab === 'collections' && (
                  <div className="flex flex-col gap-2 p-3">
                    <CollectionsSection
                      paper={effectiveItem}
                      scopeId={targetScope}
                    />
                  </div>
                )}

                {activeInspectorTab === 'tags' && (
                  <div className="p-3">
                    <TagsSection
                      paper={effectiveItem}
                      canEdit={canEdit}
                    />
                  </div>
                )}

                {activeInspectorTab === 'relations' && (
                  <div className="p-3">
                    <RelatedSection
                      paper={effectiveItem}
                      scopeId={targetScope}
                      canEdit={canEdit}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Empty State */
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-muted-foreground gap-2">
              {isLoading ? (
                <p className="text-xs">Loading item details...</p>
              ) : (
                <>
                  <p className="text-xs font-medium">No item selected</p>
                  <p className="text-[11px] text-muted-foreground/80">
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
        onTabChange={setActiveInspectorTab}
        attachmentCount={attachmentCount}
        noteCount={noteCount}
        isInspectorOpen={isInspectorOpen}
        onToggleInspector={toggleInspector}
      />
    </div>
  );
}

export default LibraryInspector;
