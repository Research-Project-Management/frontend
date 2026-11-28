'use client';

import React from 'react';
import { Folder, Library, RefreshCw } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { CollectionNode } from '../hooks/useCitationModal';

export interface CitationSidebarProps {
  selectedNav: string;
  onSelectNav: (navId: string) => void;
  libraryCount: number;
  byCollectionCounts?: Record<string, number>;
  collections: CollectionNode[];
  canSyncCollection: boolean;
  isSyncingCollection: boolean;
  onSyncCollection: (collectionId: string) => void;
}

export function CitationSidebar({
  selectedNav,
  onSelectNav,
  libraryCount,
  byCollectionCounts,
  collections,
  canSyncCollection,
  isSyncingCollection,
  onSyncCollection,
}: CitationSidebarProps) {
  const selectedCollectionId =
    selectedNav && selectedNav !== 'library' ? selectedNav : null;

  const renderNode = (node: CollectionNode, depth = 0) => {
    const isActive = selectedNav === node.id;
    const count = byCollectionCounts?.[node.id];

    return (
      <div key={node.id}>
        <button
          type="button"
          onClick={() => onSelectNav(node.id)}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          className={cn(
            'w-full pr-2 py-1.5 flex items-center justify-between gap-1.5 rounded-md text-11 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border text-left',
            isActive
              ? 'bg-muted text-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
          )}
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <Folder className="size-3.5 shrink-0 opacity-75" strokeWidth={1.6} />
            <span className="truncate">{node.name}</span>
          </span>
          {typeof count === 'number' && (
            <span className="text-10 tabular-nums opacity-70 shrink-0">
              {count}
            </span>
          )}
        </button>
        {node.children && node.children.length > 0 && (
          <div className="mt-0.5 space-y-0.5">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const isLibraryActive = selectedNav === 'library';

  return (
    <aside className="hidden sm:flex w-[200px] shrink-0 flex-col border-r border-border bg-muted/20 select-none">
      <div className="flex-1 overflow-y-auto px-2 py-2.5 space-y-4">
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => onSelectNav('library')}
            className={cn(
              'w-full px-2 py-1.5 flex items-center justify-between gap-1.5 rounded-md text-11 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border',
              isLibraryActive
                ? 'bg-muted text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <Library className="size-3.5 shrink-0 opacity-75" strokeWidth={1.6} />
              <span className="truncate">All Library</span>
            </span>
            <span className="text-10 tabular-nums opacity-70 shrink-0">
              {libraryCount}
            </span>
          </button>
        </div>

        {collections.length > 0 && (
          <div className="space-y-0.5">
            {collections.map((node) => renderNode(node, 0))}
          </div>
        )}
      </div>

      {selectedCollectionId && canSyncCollection && (
        <div className="p-2 border-t border-border">
          <button
            type="button"
            disabled={isSyncingCollection}
            onClick={() => onSyncCollection(selectedCollectionId)}
            className="w-full h-7 px-2 flex items-center justify-center gap-1.5 rounded-md border border-border bg-background text-11 font-medium text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={cn('size-3 shrink-0', isSyncingCollection && 'animate-spin')}
            />
            <span>{isSyncingCollection ? 'Syncing...' : 'Sync collection'}</span>
          </button>
        </div>
      )}
    </aside>
  );
}
