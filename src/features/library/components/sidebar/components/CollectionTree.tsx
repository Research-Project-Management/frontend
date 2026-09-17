'use client';

import type { TreeNode, CollectionActionHandlers } from '../types';
import type { Collection } from '@/features/library/types/library.types';
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
  if (isSearching && tree.length === 0) {
    return (
      <div className="py-6 px-3 text-center text-xs text-muted-foreground select-none">
        No collections matching &ldquo;{searchQuery}&rdquo;
      </div>
    );
  }

  if (tree.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1 w-full">
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
