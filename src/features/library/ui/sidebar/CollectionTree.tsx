'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { useLibraryCacheSynchronizer } from '@/features/library/sdk/queries/catalog.queries';
import type { TreeNode, CollectionActionHandlers } from './sidebar.types';
import type { Collection } from '@/features/library/domain/types/library.types';
import { CollectionNode } from './CollectionNode';

interface CollectionTreeProps extends CollectionActionHandlers {
  tree: TreeNode[];
  allCollections: Collection[];
  basePath: string;
  activeId: string | string[] | null;
  navId: string;
  renamingId: string | null;
  renameValue: string;
  isSearching: boolean;
  searchQuery: string;
  canManageCollections?: boolean;
}

export function CollectionTree({
  tree,
  allCollections,
  basePath,
  activeId,
  navId,
  renamingId,
  renameValue,
  isSearching,
  searchQuery,
  canManageCollections = true,
  onStartRename,
  onSubmitRename,
  onRenameValueChange,
  onDelete,
  onDeleteWithItems,
  onMove,
  onCopy,
  onCreateSub,
  onExportBibtex,
  onExportBundle,
  onLinkClick,
  onDropItems,
}: CollectionTreeProps) {
  const selectedIds = useLibraryUIStore((s) => s.selectedIds);
  const activeItemId = useLibraryUIStore((s) => s.activeItemId);
  const activeScope = useLibraryUIStore((s) => s.activeScope);
  const scopeKey = activeScope.type === 'project' ? activeScope.id : 'user';
  const { resolveCachedItem } = useLibraryCacheSynchronizer(scopeKey);
  const [isHoldingHighlightKey, setIsHoldingHighlightKey] = useState(false);

  // Zotero 7 parity: Hold Alt/Option or Control with an item selected to highlight containing collections
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt' || e.key === 'Control') {
        setIsHoldingHighlightKey(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt' || e.key === 'Control') {
        setIsHoldingHighlightKey(false);
      }
    };
    const handleBlur = () => setIsHoldingHighlightKey(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const highlightedCollectionIds = useMemo(() => {
    if (!isHoldingHighlightKey) return undefined;
    const idsToInspect =
      selectedIds.size > 0
        ? Array.from(selectedIds)
        : activeItemId
          ? [activeItemId]
          : [];
    if (idsToInspect.length === 0) return undefined;

    const containingSet = new Set<string>();
    for (const itemId of idsToInspect) {
      const cached = resolveCachedItem(itemId, scopeKey);
      if (cached?.collectionIds) {
        for (const colId of cached.collectionIds) {
          containingSet.add(colId);
        }
      }
      if (Array.isArray(cached?.collections)) {
        for (const col of cached.collections) {
          if (col && typeof col === 'object' && 'id' in col && typeof col.id === 'string') {
            containingSet.add(col.id);
          }
        }
      }
    }
    return containingSet.size > 0 ? containingSet : undefined;
  }, [isHoldingHighlightKey, selectedIds, activeItemId, scopeKey, resolveCachedItem]);

  if (isSearching && tree.length === 0) {
    return (
      <div className="py-6 px-3 text-center text-xs text-foreground select-none">
        No collections matching &ldquo;{searchQuery}&rdquo;
      </div>
    );
  }

  if (tree.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-0.5 w-full">
      {tree.map((node) => (
        <CollectionNode
          key={node.id}
          node={node}
          depth={0}
          basePath={basePath}
          activeId={activeId}
          navId={navId}
          renamingId={renamingId}
          renameValue={renameValue}
          allCollections={allCollections}
          isSearching={isSearching}
          canManageCollections={canManageCollections}
          highlightedCollectionIds={highlightedCollectionIds}
          onStartRename={onStartRename}
          onSubmitRename={onSubmitRename}
          onRenameValueChange={onRenameValueChange}
          onDelete={onDelete}
          onDeleteWithItems={onDeleteWithItems}
          onMove={onMove}
          onCopy={onCopy}
          onCreateSub={onCreateSub}
          onExportBibtex={onExportBibtex}
          onExportBundle={onExportBundle}
          onLinkClick={onLinkClick}
          onDropItems={onDropItems}
        />
      ))}
    </div>
  );
}
