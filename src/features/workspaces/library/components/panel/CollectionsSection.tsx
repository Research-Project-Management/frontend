'use client';

import React from 'react';
import { Library, Folder, X } from 'lucide-react';
import { useCatalogItems } from '@/features/workspaces/library/hooks/library/use-items';
import { useCollections } from '@/features/workspaces/library/hooks/library/use-library';
import type { CatalogItem, Collection } from '@/features/workspaces/library/types/library.types';

interface CollectionsSectionProps {
  paper: CatalogItem;
  workspaceId: string;
  onCreateCollection?: () => void;
  hideHeader?: boolean;
}

export default function CollectionsSection({
  paper,
  workspaceId,
  hideHeader = false,
}: CollectionsSectionProps) {
  const { actions } = useCatalogItems({ workspaceId });
  const { updatePaper } = actions;
  const { state: colState } = useCollections(workspaceId);
  const collections: Collection[] = colState.collections ?? [];

  const activeCollectionId = paper.collectionId;

  // Build the path of collections from root to current item's collection
  const collectionPathNodes = React.useMemo(() => {
    if (!activeCollectionId || collections.length === 0) return [];

    const path: Collection[] = [];
    let currId: string | null = activeCollectionId;
    const visited = new Set<string>();

    while (currId && !visited.has(currId)) {
      visited.add(currId);
      const found = collections.find((c: Collection) => c.id === currId);
      if (found) {
        path.unshift(found);
        currId = found.parentId || null;
      } else {
        break;
      }
    }
    return path;
  }, [activeCollectionId, collections]);

  const handleMoveCollection = (targetId: string | null) => {
    if (paper.id) {
      updatePaper(paper.id, { collectionId: targetId });
    }
  };

  if (!paper.collectionId && collectionPathNodes.length === 0) {
    return (
      <div className="space-y-1 text-xs select-none font-sans">
        {!hideHeader && (
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-xs font-medium text-foreground">
              Libraries and Collections
            </h3>
          </div>
        )}
        <div className="flex items-center gap-2 py-0.5 px-2 text-xs">
          <div className="size-4 shrink-0 flex items-center justify-center">
            <Library className="size-3.5 text-foreground shrink-0" />
          </div>
          <span className="font-medium text-xs text-foreground tracking-tight truncate">My Library</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 text-xs select-none font-sans">
      {!hideHeader && (
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-xs font-medium text-foreground">
            Libraries and Collections
          </h3>
        </div>
      )}

      {/* Primary Library Row (Parent) */}
      <div className="flex items-center gap-2 py-0.5 px-2 text-xs">
        <div className="size-4 shrink-0 flex items-center justify-center">
          <Library className="size-3.5 text-foreground shrink-0" />
        </div>
        <span className="font-medium text-xs text-foreground tracking-tight truncate">My Library</span>
      </div>

      {/* Collection Tree Rows (Children indented cleanly) */}
      {collectionPathNodes.map((col, idx) => {
        const isLeaf = idx === collectionPathNodes.length - 1;
        const indentPx = 8 + (idx + 1) * 12;
        return (
          <div
            key={col.id}
            style={{ paddingLeft: `${indentPx}px` }}
            className="flex items-center justify-between gap-1.5 py-0.5 pr-2 text-xs group"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="size-4 shrink-0 flex items-center justify-center">
                <Folder className="size-3.5 text-foreground shrink-0" />
              </div>
              <span
                className="text-xs truncate text-foreground font-normal"
                title={col.name}
              >
                {col.name}
              </span>
            </div>
            {isLeaf && (
              <button
                type="button"
                onClick={() => handleMoveCollection(null)}
                className="invisible group-hover:visible p-0.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-foreground cursor-pointer shrink-0 mr-1"
                title="Remove from collection (Unfile)"
                aria-label="Remove from collection"
              >
                <X className="size-3.5 text-foreground" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
