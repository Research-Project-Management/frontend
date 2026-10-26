'use client';

import { useState, memo } from 'react';
import Link from 'next/link';
import { Folder, ChevronRight } from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import { logger } from "@/shared/lib/logger";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { useLibraryCacheSynchronizer } from '@/features/library/sdk/queries/catalog.queries';
import type { TreeNode, CollectionActionHandlers } from './sidebar.types';
import type { Collection } from '@/features/library/domain/types/library.types';
import { CollectionContextMenu } from './CollectionContextMenu';

export interface CollectionNodeProps extends CollectionActionHandlers {
  node: TreeNode;
  depth: number;
  basePath: string;
  activeId: string | string[] | null;
  navId: string;
  renamingId: string | null;
  renameValue: string;
  allCollections: Collection[];
  isSearching: boolean;
  canManageCollections?: boolean;
  highlightedCollectionIds?: Set<string>;
}

export const CollectionNode = memo(function CollectionNode({
  node,
  depth,
  basePath,
  activeId,
  navId,
  renamingId,
  renameValue,
  allCollections,
  isSearching,
  canManageCollections = true,
  highlightedCollectionIds,
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
}: CollectionNodeProps) {
  const { prefetchCollection } = useLibraryCacheSynchronizer(node.projectId || undefined);
  const to = `${basePath}/${node.id}`;
  const isActive = activeId === node.id;
  const isHighlightedContainer = Boolean(highlightedCollectionIds?.has(node.id));
  const hasChildren = node.children.length > 0;
  const [isOpen, setIsOpen] = useState(true);
  const [isDragOverTarget, setIsDragOverTarget] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    if (!canManageCollections) return;
    if (e.dataTransfer.types.includes('application/x-flux-items')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = e.altKey || e.ctrlKey ? 'copy' : 'move';
      if (!isDragOverTarget) setIsDragOverTarget(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverTarget(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!canManageCollections) return;
    if (e.dataTransfer.types.includes('application/x-flux-items')) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOverTarget(false);
      try {
        const raw = e.dataTransfer.getData('application/x-flux-items');
        if (raw) {
          const parsed = JSON.parse(raw) as string[] | { ids?: string[] };
          const ids = Array.isArray(parsed) ? parsed : (parsed?.ids || []);
          if (ids.length > 0) {
            onDropItems?.(ids, node.id, {
              copy: e.altKey || e.ctrlKey,
              move: e.shiftKey || e.metaKey,
            });
          }
        }
      } catch (err) {
        logger.error('Failed to parse dropped items', err);
      }
    }
  };

  const effectiveIsOpen = isSearching ? true : isOpen;

  // Hierarchy indentation: 24px (align with SidebarNavItem pl-6) + depth * 16px
  const paddingLeft = 24 + depth * 16;

  const handlePrefetch = () => {
    prefetchCollection(node.id, node.projectId);
  };

  return (
    <div className="flex flex-col gap-0.5 w-full">
      <div className="group/node relative flex items-center w-full">
        {renamingId === node.id && canManageCollections ? (
          <div
            className="relative z-10 flex h-8 w-full items-center pr-2 min-w-0 gap-2.5"
            style={{ paddingLeft: `${paddingLeft}px` }}
          >
            <Folder className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => onRenameValueChange(e.target.value)}
              onBlur={() => onSubmitRename(node.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSubmitRename(node.id);
                if (e.key === 'Escape') onSubmitRename('__cancel__');
              }}
              className="h-7 w-full min-w-0 rounded-md border border-border bg-background px-2 text-13 font-normal focus:outline-none focus:ring-1 focus:ring-ring shadow-none text-foreground"
            />
          </div>
        ) : (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onMouseEnter={handlePrefetch}
            className={cn(
              "group/node relative z-10 flex h-8 w-full items-center gap-2 rounded-md pr-1.5 cursor-pointer select-none text-13 leading-5 tracking-tight",
              isActive
                ? "bg-muted text-foreground font-medium"
                : "text-foreground hover:bg-muted group-hover/node:bg-muted has-[[data-state=open]]:bg-muted font-normal",
              isHighlightedContainer &&
                "bg-amber-500/15 ring-1 ring-amber-500/60 ring-inset font-medium",
              isDragOverTarget && "bg-primary/10 text-primary font-medium ring-1 ring-primary ring-inset"
            )}
            style={{ paddingLeft: `${paddingLeft}px` }}
          >
            <Link
              href={to}
              onClick={onLinkClick}
              onFocus={handlePrefetch}
              className="flex flex-1 min-w-0 items-center gap-2.5 py-1 outline-none shrink-0"
            >
              <Folder className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
              <span
                className={cn(
                  "flex-1 min-w-0 truncate tracking-tight text-foreground",
                  isActive ? "font-medium" : "font-normal"
                )}
              >
                {node.name}
              </span>
            </Link>

            <div className="flex items-center gap-0.5 shrink-0 ml-auto">
              <CollectionContextMenu
                node={node}
                allCollections={allCollections}
                canManageCollections={canManageCollections}
                onCreateSub={onCreateSub}
                onStartRename={onStartRename}
                onMove={onMove}
                onCopy={onCopy}
                onExportBibtex={onExportBibtex}
                onExportBundle={onExportBundle}
                onDelete={onDelete}
                onDeleteWithItems={onDeleteWithItems}
              />

              {hasChildren && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setIsOpen((v) => !v);
                      }}
                      aria-label={effectiveIsOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
                      className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50 hover:bg-background cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary relative before:absolute before:-inset-2 md:before:hidden"
                    >
                      <ChevronRight
                        className={cn(
                          'size-3.5 transition-transform duration-150 shrink-0',
                          effectiveIsOpen && 'rotate-90'
                        )}
                        strokeWidth={1.5}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="start"
                    sideOffset={6}
                    alignOffset={2}
                  >
                    {effectiveIsOpen ? 'Collapse' : 'Expand'}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        )}
      </div>

      {hasChildren && effectiveIsOpen && (
        <div className="flex flex-col gap-0.5 w-full">
          {node.children.map((child) => (
            <CollectionNode
              key={child.id}
              node={child}
              depth={depth + 1}
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
      )}
    </div>
  );
});
