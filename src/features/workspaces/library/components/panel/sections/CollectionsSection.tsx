'use client';

import React from 'react';
import { Library, Folder, FolderPlus, Check, ChevronRight, Inbox, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useCollections } from '@/features/workspaces/library/hooks/library/use-collections';
import { usePapers } from '@/features/workspaces/library/hooks/library/use-papers';
import { cn } from '@/shared/lib/utils';
import type { Paper, Collection } from '@/features/workspaces/library/types/library.types';

interface CollectionsSectionProps {
  paper: Paper;
  workspaceId: string;
  onUpdatePaper?: (data: Partial<Paper>) => void;
  hideHeader?: boolean;
}

export default function CollectionsSection({
  paper,
  workspaceId,
  onUpdatePaper,
  hideHeader = false,
}: CollectionsSectionProps) {
  const targetWsId = workspaceId || paper.workspaceId || '';
  const { state } = useCollections(targetWsId);
  const collections: Collection[] = state.collections || [];
  const paperService = usePapers({ workspaceId: targetWsId });

  const currentCollectionId = paper.collectionId || null;
  const currentCollection = collections.find((c: Collection) => c.id === currentCollectionId);

  // Build collection path if nested
  const getCollectionPath = (col?: Collection): string[] => {
    if (!col) return [];
    const path: string[] = [col.name];
    let parentId = col.parentId || (col as any).parent;
    while (parentId) {
      const parent = collections.find((c: Collection) => c.id === parentId);
      if (parent) {
        path.unshift(parent.name);
        parentId = parent.parentId || (parent as any).parent;
      } else {
        break;
      }
    }
    return path;
  };

  const collectionPath = getCollectionPath(currentCollection);

  const handleMoveCollection = (targetCollectionId: string | null) => {
    if (targetCollectionId === currentCollectionId) return;

    if (onUpdatePaper) {
      onUpdatePaper({ collectionId: targetCollectionId });
    } else if (paper.id) {
      paperService.actions.updatePaper(
        {
          paperId: paper.id,
          collectionId: targetCollectionId,
        },
        {
          onSuccess: () => {
            toast.success(
              targetCollectionId
                ? `Moved to collection "${collections.find((c: Collection) => c.id === targetCollectionId)?.name}"`
                : 'Moved to Library (Unfiled)',
            );
          },
          onError: () => {
            toast.error('Failed to move paper');
          },
        }
      );
    }
  };

  return (
    <div className="space-y-2.5 text-xs min-w-0">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-foreground">
            Libraries & Collections
          </h3>
        </div>
      )}

      {/* Main Library & Current Collection Display */}
      <div className="space-y-1.5">
        {/* Primary Library Container */}
        <div className="p-2.5 bg-muted/20 hover:bg-muted/30 rounded-md border border-border/40 transition-colors flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-6 rounded-md bg-muted border border-border/60 flex items-center justify-center shrink-0">
              <Library className="size-3.5 text-foreground" />
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-foreground truncate block text-xs">
                My Library
              </span>
              <span className="text-micro text-muted-foreground truncate block font-normal">
                Workspace Library
              </span>
            </div>
          </div>
        </div>

        {/* Current Collection Card */}
        {currentCollection ? (
          <div className="p-2.5 bg-muted/20 hover:bg-muted/30 rounded-md border border-border/40 transition-colors flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="size-6 rounded-md bg-muted border border-border/60 flex items-center justify-center shrink-0">
                <Folder className="size-3.5 text-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                {collectionPath.length > 1 ? (
                  <div className="flex items-center gap-1 text-micro text-muted-foreground truncate mb-0.5">
                    {collectionPath.slice(0, -1).map((crumb, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <ChevronRight className="size-2.5 shrink-0" />}
                        <span className="truncate">{crumb}</span>
                      </React.Fragment>
                    ))}
                  </div>
                ) : null}
                <span className="font-semibold text-foreground truncate block text-xs" title={currentCollection.name}>
                  {currentCollection.name}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleMoveCollection(null)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer shrink-0"
              title="Remove from collection (Unfile)"
              aria-label="Remove from collection"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      {/* Collection Picker / Move Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs font-medium gap-1.5 cursor-pointer shadow-none border-border/60 hover:border-border"
          >
            <FolderPlus className="size-3.5 text-foreground" />
            <span>{currentCollection ? 'Change Collection' : 'Add to Collection'}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 p-1 rounded-md border border-border bg-popover text-popover-foreground z-50 text-xs shadow-none">
          <DropdownMenuLabel className="text-micro text-muted-foreground font-medium px-2 py-1">
            Select Collection
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Root / Unfiled Option */}
          <DropdownMenuItem
            onClick={() => handleMoveCollection(null)}
            className={cn(
              'flex items-center justify-between px-2 py-1.5 text-xs rounded-md cursor-pointer hover:bg-muted focus:bg-muted transition-colors',
              !currentCollectionId && 'font-semibold bg-muted/50',
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Inbox className="size-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">Unfiled (Root Library)</span>
            </div>
            {!currentCollectionId && <Check className="size-3.5 text-foreground shrink-0" />}
          </DropdownMenuItem>

          {/* Collections List */}
          {collections.map((col: Collection) => {
            const isSelected = col.id === currentCollectionId;
            return (
              <DropdownMenuItem
                key={col.id}
                onClick={() => handleMoveCollection(col.id)}
                className={cn(
                  'flex items-center justify-between px-2 py-1.5 text-xs rounded-md cursor-pointer hover:bg-muted focus:bg-muted transition-colors',
                  isSelected && 'font-semibold bg-muted/50',
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Folder className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{col.name}</span>
                </div>
                {isSelected && <Check className="size-3.5 text-foreground shrink-0" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
