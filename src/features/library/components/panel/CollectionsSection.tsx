'use client';

import React from 'react';
import { Library, Folder, X } from 'lucide-react';
import { useItems } from '@/features/library/hooks/use-items';
import { useCollections } from '@/features/library/hooks/use-library';
import type { Item, Collection } from '@/features/library/types/library.types';

interface CollectionsSectionProps {
  paper: Item;
  scopeId?: string;
  projectId?: string;
  workspaceId?: string;
  onCreateCollection?: () => void;
  hideHeader?: boolean;
}

export default function CollectionsSection({
  paper,
  scopeId,
  projectId,
  workspaceId,
  hideHeader = false,
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

  const handleRemoveFromCollection = (targetColId: string) => {
    if (!paper.id) return;
    const remainingIds = itemCollectionIds.filter((id) => id !== targetColId);
    updatePaper(paper.id, {
      collectionIds: remainingIds,
      collectionId: remainingIds[0] || null,
    });
  };

  return (
    <div className="space-y-1 select-none font-sans">
      {!hideHeader && (
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-13 font-medium text-foreground">
            Libraries and Collections
          </h3>
        </div>
      )}

      {/* Primary Library Row (Root) */}
      <div className="flex items-center gap-2 py-1 px-2 text-13 rounded-md hover:bg-muted/60 transition-colors">
        <div className="size-4 shrink-0 flex items-center justify-center">
          <Library className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
        </div>
        <span className="font-medium text-13 text-foreground tracking-tight truncate">My Library</span>
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
                  className="flex items-center justify-between gap-1.5 py-1 pr-2 text-13 rounded-md hover:bg-muted/60 transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="size-4 shrink-0 flex items-center justify-center">
                      <Folder className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                    </div>
                    <span
                      className="text-13 truncate text-foreground font-normal"
                      title={col.name}
                    >
                      {col.name}
                    </span>
                  </div>
                  {isLeaf && (
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
