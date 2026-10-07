'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Library, Folder, FolderKanban, X, Plus, Search } from 'lucide-react';
import {
  useUpdateReaderItem,
  useReaderCollections,
} from '../../data';
import { useReaderModalStore } from '../../store/reader-ui.store';
import { useProjects } from '@/features/projects/shell/hooks/use-project';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { toast } from 'sonner';
import type { Item, Collection } from '../../types/reader.types';

// ── Helper: compute ancestor breadcrumb path for a collection ────────────────
function getCollectionAncestorPath(
  collectionId: string,
  colMap: Map<string, Collection>,
): string {
  const parts: string[] = [];
  let curr = colMap.get(collectionId);
  const visited = new Set<string>();

  while (curr?.parentId && !visited.has(curr.parentId)) {
    visited.add(curr.parentId);
    const parent = colMap.get(curr.parentId);
    if (parent?.name) {
      parts.unshift(parent.name);
    }
    curr = parent;
  }
  return parts.join(' / ');
}

// ── ReaderCollectionPickerPopover Component ──────────────────────────────────
export interface ReaderCollectionPickerPopoverProps {
  paper: Item;
  scopeId?: string;
  canEdit?: boolean;
  align?: 'start' | 'center' | 'end';
  children: React.ReactNode;
}

export function ReaderCollectionPickerPopover({
  paper,
  scopeId,
  canEdit = true,
  align = 'end',
  children,
}: ReaderCollectionPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const effectiveScope = scopeId || (paper as any)?.projectId || 'user';
  const { mutate: updatePaper } = useUpdateReaderItem(effectiveScope);
  const { data: rawCollections = [] } = useReaderCollections(effectiveScope);
  const collections = Array.isArray(rawCollections)
    ? rawCollections
    : (rawCollections as any)?.collections || [];
  const openModal = useReaderModalStore((s) => s.openModal);

  // Map collections for lookup
  const colMap = useMemo(() => {
    const map = new Map<string, Collection>();
    collections.forEach((c: Collection) => map.set(c.id, c));
    ((paper as any).collections || []).forEach((c: any) => {
      if (c?.id && !map.has(c.id)) {
        map.set(c.id, c as Collection);
      }
    });
    return map;
  }, [collections, paper]);

  // Set of all currently assigned collection IDs
  const assignedCollectionIdsSet = useMemo(() => {
    const ids = new Set<string>();
    if (paper.collectionId) ids.add(paper.collectionId);
    if (Array.isArray(paper.collectionIds)) {
      paper.collectionIds.forEach((id) => id && ids.add(id));
    }
    if (Array.isArray((paper as any).collections)) {
      (paper as any).collections.forEach((c: any) => c?.id && ids.add(c.id));
    }
    return ids;
  }, [paper.collectionId, paper.collectionIds, paper]);

  // Filter collections based on search query
  const filteredCollections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return collections;
    return collections.filter((c: Collection) => {
      const name = c.name?.toLowerCase() || '';
      const path = getCollectionAncestorPath(c.id, colMap).toLowerCase();
      return name.includes(q) || path.includes(q);
    });
  }, [collections, searchQuery, colMap]);

  // Toggle assigning or removing a collection
  const handleToggleCollection = useCallback(
    (targetColId: string) => {
      if (!paper.id || !canEdit) return;
      const isAssigned = assignedCollectionIdsSet.has(targetColId);
      const prevIds = Array.from(assignedCollectionIdsSet);
      const remainingIds = isAssigned
        ? prevIds.filter((id) => id !== targetColId)
        : [...prevIds, targetColId];

      updatePaper({
        itemId: paper.id,
        data: {
          collectionIds: remainingIds,
          collectionId: remainingIds[0] || null,
          expectedVersion: paper.version,
        },
      });

      const targetCol = colMap.get(targetColId);
      const colName = targetCol?.name || 'Collection';
      if (isAssigned) {
        const remainingCount = remainingIds.length;
        const description =
          remainingCount === 0
            ? 'Item is now in Unfiled Items (remains safely in your library).'
            : `Item remains in ${remainingCount} other ${remainingCount === 1 ? 'collection' : 'collections'}.`;

        toast.success(`Removed from "${colName}"`, {
          description,
          id: 'reader-col-assign',
          duration: 5000,
          action: {
            label: 'Undo',
            onClick: () => {
              updatePaper({
                itemId: paper.id,
                data: {
                  collectionIds: prevIds,
                  collectionId: prevIds[0] || null,
                  expectedVersion: paper.version,
                },
              });
              toast.success(`Restored to "${colName}"`, { id: 'reader-col-assign' });
            },
          },
        });
      } else {
        toast.success(`Added to "${colName}"`, { id: 'reader-col-assign' });
      }
    },
    [paper.id, paper.version, assignedCollectionIdsSet, canEdit, updatePaper, colMap],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={6}
        className="w-[270px] p-0 rounded-lg border border-border bg-popover text-popover-foreground shadow-raised-300 overflow-hidden z-50 select-none font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border/70 bg-muted/20">
          <Search className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Search or add collection..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-12 text-foreground placeholder:text-muted-foreground/60 outline-none"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="size-3" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Collections List */}
        <div className="max-h-56 overflow-y-auto p-1 flex flex-col gap-0.5">
          {filteredCollections.length === 0 ? (
            <div className="py-4 px-2 text-center text-11 text-muted-foreground">
              {searchQuery ? `No collections matching "${searchQuery}"` : 'No collections available'}
            </div>
          ) : (
            filteredCollections.map((col: Collection) => {
              const isAssigned = assignedCollectionIdsSet.has(col.id);
              const path = getCollectionAncestorPath(col.id, colMap);

              return (
                <div
                  key={col.id}
                  onClick={() => handleToggleCollection(col.id)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/80 cursor-pointer transition-colors text-12 select-none group"
                >
                  <Checkbox
                    checked={isAssigned}
                    onCheckedChange={() => handleToggleCollection(col.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="size-3.5 rounded-xs shrink-0 cursor-pointer"
                  />
                  <Folder className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                  <div className="min-w-0 flex-1 flex flex-col justify-center">
                    {path && (
                      <span className="text-10 text-muted-foreground truncate leading-none mb-0.5">
                        {path}
                      </span>
                    )}
                    <span className="truncate leading-tight text-foreground font-normal">
                      {col.name}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info & create modal trigger */}
        <div className="p-1 border-t border-border/50 flex items-center justify-between px-2.5 py-1 text-11 text-muted-foreground bg-muted/20">
          <span>
            {collections.length} {collections.length === 1 ? 'collection' : 'collections'}
          </span>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              openModal('CREATE_COLLECTION');
            }}
            className="text-primary hover:underline cursor-pointer font-medium"
          >
            New collection...
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Main CollectionsSection Component ─────────────────────────────────────────
interface CollectionsSectionProps {
  paper: Item;
  scopeId?: string;
  projectId?: string;
  onCreateCollection?: () => void;
  hideHeader?: boolean;
  canEdit?: boolean;
}

export default function CollectionsSection({
  paper,
  scopeId,
  projectId,
  onCreateCollection,
  hideHeader = false,
  canEdit = true,
}: CollectionsSectionProps) {
  const effectiveScope = scopeId || projectId || (paper as any)?.projectId || 'user';
  const { mutate: updatePaper } = useUpdateReaderItem(effectiveScope);
  const { data: rawCollections = [] } = useReaderCollections(effectiveScope);
  const collections = Array.isArray(rawCollections)
    ? rawCollections
    : (rawCollections as any)?.collections || [];
  const { projects = [] } = useProjects();

  // Resolve active library root name (My Library vs Project Library)
  const isProject = Boolean(
    (typeof effectiveScope === 'string' && effectiveScope.startsWith('project:')) ||
      (paper as any)?.projectId,
  );

  const matchedProject = useMemo(() => {
    if (!isProject) return null;
    const cleanId = effectiveScope.replace(/^project:/, '');
    return (
      projects.find((p: any) => p.id === cleanId || p.id === (paper as any)?.projectId) || null
    );
  }, [isProject, effectiveScope, paper, projects]);

  const libraryTitle = isProject
    ? matchedProject?.name || 'Project Library'
    : 'My Library';

  const libraryRootHref = isProject && matchedProject?.id
    ? `/projects/${matchedProject.id}/library`
    : '/library';

  // Map all collections by id
  const colMap = useMemo(() => {
    const map = new Map<string, Collection>();
    collections.forEach((c: Collection) => map.set(c.id, c));
    ((paper as any).collections || []).forEach((c: any) => {
      if (c?.id && !map.has(c.id)) {
        map.set(c.id, c as Collection);
      }
    });
    return map;
  }, [collections, paper]);

  // Set of all collection IDs explicitly assigned to this paper
  const assignedCollectionIdsSet = useMemo(() => {
    const ids = new Set<string>();
    if (paper.collectionId) ids.add(paper.collectionId);
    if (Array.isArray(paper.collectionIds)) {
      paper.collectionIds.forEach((id) => id && ids.add(id));
    }
    if (Array.isArray((paper as any).collections)) {
      (paper as any).collections.forEach((c: any) => c?.id && ids.add(c.id));
    }
    return ids;
  }, [paper.collectionId, paper.collectionIds, paper]);

  // List of assigned collection objects with resolved names and paths
  const assignedCollections = useMemo(() => {
    const list: Array<{ id: string; name: string; path: string }> = [];
    assignedCollectionIdsSet.forEach((colId) => {
      const col = colMap.get(colId);
      const name = col?.name || 'Collection';
      const path = getCollectionAncestorPath(colId, colMap);
      list.push({ id: colId, name, path });
    });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [assignedCollectionIdsSet, colMap]);

  // Remove a collection from this paper
  const handleRemoveFromCollection = useCallback(
    (targetColId: string) => {
      if (!paper.id || !canEdit) return;
      const prevIds = Array.from(assignedCollectionIdsSet);
      const remainingIds = prevIds.filter((id) => id !== targetColId);

      updatePaper({
        itemId: paper.id,
        data: {
          collectionIds: remainingIds,
          collectionId: remainingIds[0] || null,
          expectedVersion: paper.version,
        },
      });

      const colName = colMap.get(targetColId)?.name || 'Collection';
      const remainingCount = remainingIds.length;
      const description =
        remainingCount === 0
          ? 'Item is now in Unfiled Items (remains safely in your library).'
          : `Item remains in ${remainingCount} other ${remainingCount === 1 ? 'collection' : 'collections'}.`;

      toast.success(`Removed from "${colName}"`, {
        description,
        id: 'reader-col-assign',
        duration: 5000,
        action: {
          label: 'Undo',
          onClick: () => {
            updatePaper({
              itemId: paper.id,
              data: {
                collectionIds: prevIds,
                collectionId: prevIds[0] || null,
                expectedVersion: paper.version,
              },
            });
            toast.success(`Restored to "${colName}"`, { id: 'reader-col-assign' });
          },
        },
      });
    },
    [paper.id, paper.version, assignedCollectionIdsSet, canEdit, updatePaper, colMap],
  );

  return (
    <div className="flex flex-col gap-0.5 select-none font-sans w-full">
      {/* Optional Standalone Header if not rendered within InspectorSection */}
      {!hideHeader && (
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-12 font-medium text-foreground">
            Libraries and Collections
          </h3>
          {canEdit && (
            <ReaderCollectionPickerPopover paper={paper} scopeId={effectiveScope} canEdit={canEdit}>
              <button
                type="button"
                className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
                title="Add to collection"
                aria-label="Add to collection"
              >
                <Plus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
              </button>
            </ReaderCollectionPickerPopover>
          )}
        </div>
      )}

      {/* Primary Library Root Row */}
      <div className="flex items-center justify-between gap-1.5 h-7 px-1.5 text-12 rounded-md hover:bg-muted/60 transition-colors group">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div className="size-4 shrink-0 flex items-center justify-center">
            {isProject ? (
              <FolderKanban className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            ) : (
              <Library className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            )}
          </div>
          <Link
            href={libraryRootHref}
            className="font-medium text-12 text-foreground tracking-tight truncate hover:underline select-none"
            title={`Navigate to ${libraryTitle}`}
          >
            {libraryTitle}
          </Link>
        </div>

        {assignedCollectionIdsSet.size === 0 ? (
          <span className="text-11 px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-normal shrink-0">
            Unfiled
          </span>
        ) : (
          <span className="text-11 px-1.5 py-0.2 rounded bg-muted font-medium text-foreground shrink-0">
            {assignedCollectionIdsSet.size}
          </span>
        )}
      </div>

      {/* When Unfiled: Clean empty callout with Add button */}
      {assignedCollectionIdsSet.size === 0 && (
        <div className="flex flex-col gap-1.5 px-2.5 py-2 rounded-md bg-muted/40 border border-border/50 text-11 text-muted-foreground mt-0.5">
          <span className="leading-snug">
            This item is in your library root and is not filed in any collection.
          </span>
          {canEdit && (
            <ReaderCollectionPickerPopover
              paper={paper}
              scopeId={effectiveScope}
              canEdit={canEdit}
              align="start"
            >
              <button
                type="button"
                className="inline-flex items-center gap-1 text-11 font-medium text-primary hover:text-primary/80 transition-colors w-fit cursor-pointer"
              >
                <Plus className="size-3" strokeWidth={2} />
                Add to a collection
              </button>
            </ReaderCollectionPickerPopover>
          )}
        </div>
      )}

      {/* When Assigned: Hierarchical Collection Rows */}
      {assignedCollections.map((col) => {
        const href = isProject && matchedProject?.id
          ? `/projects/${matchedProject.id}/library/${col.id}`
          : `/library/${col.id}`;

        return (
          <div
            key={col.id}
            className="flex items-center justify-between gap-1.5 min-h-[28px] py-1 px-1.5 pl-5 text-12 rounded-md hover:bg-muted/60 transition-colors group"
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <div className="size-3.5 shrink-0 flex items-center justify-center">
                <Folder className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                {col.path && (
                  <span className="text-10 text-muted-foreground/75 leading-none truncate mb-0.5">
                    {col.path}
                  </span>
                )}
                <Link
                  href={href}
                  className="text-12 truncate leading-tight text-foreground font-normal hover:underline select-none"
                  title={col.path ? `${col.path} / ${col.name}` : col.name}
                >
                  {col.name}
                </Link>
              </div>
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveFromCollection(col.id);
                }}
                className="invisible group-hover:visible size-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shrink-0 transition-colors"
                title={`Remove from "${col.name}" (item will remain in library)`}
                aria-label={`Remove from collection ${col.name}, item will remain in library`}
              >
                <X className="size-3.5 shrink-0" strokeWidth={1.5} />
              </button>
            )}
          </div>
        );
      })}

      {/* In-body Add action link when already assigned to collections */}
      {assignedCollections.length > 0 && canEdit && (
        <div className="pt-1 px-1.5">
          <ReaderCollectionPickerPopover
            paper={paper}
            scopeId={effectiveScope}
            canEdit={canEdit}
            align="start"
          >
            <button
              type="button"
              className="inline-flex items-center gap-1 text-11 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <Plus className="size-3" strokeWidth={1.5} />
              Add to another collection
            </button>
          </ReaderCollectionPickerPopover>
        </div>
      )}
    </div>
  );
}
