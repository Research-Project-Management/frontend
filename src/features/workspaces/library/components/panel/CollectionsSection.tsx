'use client';

import React from 'react';
import { Library, Folder, X, FolderTree } from 'lucide-react';
import { useCollections } from '@/features/workspaces/library/hooks/library/use-collections';
import { useCatalogItems } from '@/features/workspaces/library/hooks/library/use-items';
import type { CatalogItem, Collection } from '@/features/workspaces/library/types/library.types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';

interface CollectionsSectionProps {
  onCreateCollection?: () => void;
  paper: CatalogItem;
  workspaceId: string;
  onUpdatePaper?: (data: Partial<CatalogItem>) => void;
  hideHeader?: boolean;
}

export default function CollectionsSection({
  onCreateCollection,
  paper,
  workspaceId,
  onUpdatePaper,
  hideHeader = false,
}: CollectionsSectionProps) {
  const targetWsId = workspaceId || paper.workspaceId || '';
  const { state } = useCollections(targetWsId);
  const collections = React.useMemo(() => state.collections || [], [state.collections]);

  const paperCollectionId = paper.collectionId;
  const currentCollection = React.useMemo(() => {
    if (!collections.length) return undefined;
    return collections.find((c) => c.id === paperCollectionId);
  }, [collections, paperCollectionId]);

  // Compute hierarchical path nodes (e.g. [Parent, Child])
  const collectionPathNodes = React.useMemo(() => {
    if (!currentCollection || !collections.length) return [];
    const path: Collection[] = [currentCollection];
    let parentId = currentCollection.parentId || (currentCollection as any).parent;
    while (parentId) {
      const parent = collections.find((c) => c.id === parentId);
      if (parent) {
        path.unshift(parent);
        parentId = parent.parentId || (parent as any).parent;
      } else {
        break;
      }
    }
    return path;
  }, [currentCollection, collections]);

  const { actions } = useCatalogItems({ workspaceId: targetWsId });

  const handleMoveCollection = async (targetCollectionId: string | null) => {
    if (onUpdatePaper) {
      onUpdatePaper({ collectionId: targetCollectionId || undefined });
    } else if (paper.id) {
      try {
        await actions.updatePaper(paper.id, {
          collectionId: targetCollectionId,
        });
      } catch {
        // Handled by updatePaper hook
      }
    }
  };

  return (
    <div className="py-1 px-3 space-y-1 text-xs min-w-0 font-sans select-none">
      {!hideHeader && (
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-xs font-medium text-foreground">
            Libraries and Collections
          </h3>
        </div>
      )}

      {/* Primary Library Row (Parent) */}
      <div className="flex items-center gap-2 py-0.5 pl-1 text-xs">
        <div className="size-4 shrink-0 flex items-center justify-center">
          <Library className="size-3.5 text-foreground shrink-0" />
        </div>
        <span className="font-semibold text-xs text-foreground tracking-tight truncate">My Library</span>
      </div>

      {/* Collection Tree Rows (Children indented) */}
      {collectionPathNodes.map((col, idx) => {
        const isLeaf = idx === collectionPathNodes.length - 1;
        const indentPx = 18 + idx * 16;
        return (
          <div
            key={col.id}
            style={{ paddingLeft: `${indentPx}px` }}
            className="flex items-center justify-between gap-1.5 py-0.5 text-xs group"
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







