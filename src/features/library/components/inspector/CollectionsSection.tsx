'use client';

import React from 'react';
import { Library, Folder, X, Plus } from 'lucide-react';
import { useItems, useCollections } from '../../data';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui';
import type { Item, Collection } from '../../types/library.types';

interface CollectionsSectionProps {
  paper: Item;
  scopeId?: string;
  projectId?: string;
  workspaceId?: string;
  onCreateCollection?: () => void;
  hideHeader?: boolean;
  canEdit?: boolean;
}

export default function CollectionsSection({
  paper,
  scopeId,
  projectId,
  workspaceId,
  hideHeader = false,
  canEdit = true,
}: CollectionsSectionProps) {
  const effectiveScope = scopeId || projectId || (paper as any)?.projectId || 'user';
  const { actions } = useItems({ scopeId: effectiveScope });
  const { updatePaper } = actions;
  const { state: colState } = useCollections(effectiveScope);
  const collections = colState.collections;

  // Collect all collection IDs associated with this paper
  const itemCollectionIds = React.useMemo(() => {
    const ids = new Set<string>();
    if (paper.collectionId) ids.add(paper.collectionId);
    if (Array.isArray(paper.collectionIds)) {
      paper.collectionIds.forEach((id) => id && ids.add(id));
    }
    if (Array.isArray(paper.collections)) {
      paper.collections.forEach((c) => c?.id && ids.add(c.id));
    }
    return Array.from(ids);
  }, [paper.collectionId, paper.collectionIds, paper.collections]);

  // Build collection hierarchy paths for all collections the paper belongs to
  const assignedCollections = React.useMemo(() => {
    if (!itemCollectionIds.length || !collections || collections.length === 0) return [];

    return itemCollectionIds.map((colId) => {
      const path: Collection[] = [];
      let currId: string | null = colId;
      const visited = new Set<string>();

      while (currId && !visited.has(currId)) {
        visited.add(currId);
        const found = collections.find((c: Collection) => c.id === currId);
        if (found) {
          path.unshift(found);
          currId = found.parentId || null;
        } else {
          // Fallback if collection not in current active collections array
          const fallbackCol = (paper.collections || []).find((c) => c.id === currId);
          if (fallbackCol) {
            path.unshift(fallbackCol as Collection);
          }
          break;
        }
      }
      return {
        id: colId,
        target: path[path.length - 1] || ({ id: colId, name: 'Collection' } as Collection),
        path,
      };
    });
  }, [itemCollectionIds, collections, paper.collections]);

  const unassignedCollections = React.useMemo(() => {
    if (!collections || collections.length === 0) return [];
    return collections.filter((c: Collection) => !itemCollectionIds.includes(c.id));
  }, [collections, itemCollectionIds]);

  const handleAddToCollection = (targetColId: string) => {
    if (!paper.id) return;
    const newIds = Array.from(new Set([...itemCollectionIds, targetColId]));
    updatePaper(
      paper.id,
      {
        collectionIds: newIds,
        collectionId: newIds[0] || null,
        expectedVersion: paper.version,
      },
      { expectedVersion: paper.version },
    );
  };

  const handleRemoveFromCollection = (targetColId: string) => {
    if (!paper.id) return;
    const remainingIds = itemCollectionIds.filter((id) => id !== targetColId);
    updatePaper(
      paper.id,
      {
        collectionIds: remainingIds,
        collectionId: remainingIds[0] || null,
        expectedVersion: paper.version,
      },
      { expectedVersion: paper.version },
    );
  };

  return (
    <div className="space-y-1 select-none font-sans">
      {!hideHeader && (
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-12 font-medium text-foreground">
            Libraries and Collections
          </h3>
          {canEdit && unassignedCollections.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
                  title="Add to collection"
                  aria-label="Add to collection"
                >
                  <Plus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 space-y-0.5 text-xs font-sans">
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
          )}
        </div>
      )}

      {/* Primary Library Row (Root) */}
      <div className="flex items-center gap-2 py-1 px-2 text-13 rounded-md hover:bg-muted transition-colors">
        <div className="size-4 shrink-0 flex items-center justify-center">
          <Library className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
        </div>
        <span className="font-medium text-13 text-foreground tracking-tight break-words">My Library</span>
      </div>

      {/* Collection Tree Rows */}
      {assignedCollections.map(({ id: colId, path }) => {
        return (
          <div key={colId} className="space-y-0.5">
            {path.map((col, idx) => {
              const isLeaf = idx === path.length - 1;
              const indentPx = 8 + (idx + 1) * 12;
              return (
                <div
                  key={`${colId}-${col.id}-${idx}`}
                  style={{ paddingLeft: `${indentPx}px` }}
                  className="flex items-center justify-between gap-1.5 py-1 pr-2 text-13 rounded-md hover:bg-muted transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="size-4 shrink-0 flex items-center justify-center">
                      <Folder className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                    </div>
                    <span
                      className="text-13 break-words leading-snug text-foreground font-normal"
                      title={col.name}
                    >
                      {col.name}
                    </span>
                  </div>
                  {isLeaf && canEdit && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFromCollection(colId)}
                      className="invisible group-hover:visible size-5 flex items-center justify-center rounded-md hover:bg-muted text-foreground cursor-pointer shrink-0 mr-1"
                      title={`Remove from "${col.name}"`}
                      aria-label={`Remove from collection ${col.name}`}
                    >
                      <X className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
