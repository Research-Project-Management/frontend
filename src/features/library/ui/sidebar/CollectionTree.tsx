'use client';

import { useState, useEffect, useMemo, memo } from 'react';
import Link from 'next/link';
import { Folder, ChevronRight, FolderPlus, FolderOutput, FolderMinus, MoreVertical, Pencil, Trash2, Library, Copy, FileCode, FileJson, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { logger } from '@/shared/lib/logger';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { useLibraryCacheSynchronizer } from '@/features/library/core/coordinator/item-action.coordinator';
import { type TreeNode, getValidMoveTargets } from '@/features/library/domain/collection-tree.domain';
import type { Collection, CollectionActionHandlers } from '@/features/library/types/core.types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/shared/components/ui/dropdown-menu';
import { ContextMenu, ContextMenuTrigger } from '@/shared/components/ui/context-menu';
import { executeExportCollectionFormat } from '@/features/library/core/coordinator/citation-export.coordinator';

export type { TreeNode, CollectionActionHandlers };

interface SidebarNavItemProps {
  href: string;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  customIcon?: React.ReactNode;
  label: string;
  isActive: boolean;
  navId?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  contextMenu?: React.ReactNode;
  onClick?: () => void;
  onDropItems?: (itemIds: string[]) => void;
}

export function SidebarNavItem({
  href, icon: Icon, customIcon, label, isActive, badge, action, contextMenu, onClick, onDropItems,
}: SidebarNavItemProps) {
  const [isDragOverTarget, setIsDragOverTarget] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    if (!onDropItems || !e.dataTransfer.types.includes('application/x-flux-items')) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOverTarget) setIsDragOverTarget(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!onDropItems) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverTarget(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!onDropItems || !e.dataTransfer.types.includes('application/x-flux-items')) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverTarget(false);
    try {
      const raw = e.dataTransfer.getData('application/x-flux-items');
      if (raw) {
        const parsed = JSON.parse(raw) as string[] | { ids?: string[] };
        const ids = Array.isArray(parsed) ? parsed : (parsed?.ids || []);
        if (ids.length > 0) onDropItems(ids);
      }
    } catch (err) {
      logger.error('Failed to parse dropped items', err);
    }
  };

  const linkContent = (
    <Link
      href={href}
      onClick={onClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'relative flex h-8 w-full items-center gap-2.5 rounded-md pr-2.5 text-13 leading-5 outline-none select-none pl-6',
        action && 'pr-8',
        isActive
          ? 'bg-muted text-foreground font-medium'
          : 'text-foreground hover:bg-muted group-hover/item:bg-muted has-[[data-state=open]]:bg-muted font-normal',
        isDragOverTarget && 'bg-primary/10 text-primary font-medium ring-1 ring-primary ring-inset',
      )}
    >
      {customIcon ? (
        <span className="relative z-10 flex size-4 shrink-0 items-center justify-center text-13 leading-none select-none">{customIcon}</span>
      ) : Icon ? (
        <Icon className="relative z-10 size-4 shrink-0 text-foreground" strokeWidth={1.5} />
      ) : null}
      <span className={cn('relative z-10 min-w-0 truncate flex-1 tracking-tight text-foreground', isActive ? 'font-medium' : 'font-normal')}>
        {label}
      </span>
      {badge}
    </Link>
  );

  return (
    <div className="group/item relative flex items-center w-full">
      {contextMenu ? (
        <ContextMenu>
          <ContextMenuTrigger asChild>{linkContent}</ContextMenuTrigger>
          {contextMenu}
        </ContextMenu>
      ) : (
        linkContent
      )}
      {action && <div className="absolute right-1.5 z-20 flex items-center">{action}</div>}
    </div>
  );
}

interface CollectionNodeProps extends CollectionActionHandlers {
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
              'group/node relative z-10 flex h-8 w-full items-center gap-2 rounded-md pr-1.5 cursor-pointer select-none text-13 leading-5 tracking-tight',
              isActive
                ? 'bg-muted text-foreground font-medium'
                : 'text-foreground hover:bg-muted group-hover/node:bg-muted has-[[data-state=open]]:bg-muted font-normal',
              isHighlightedContainer &&
                'bg-warning/15 ring-1 ring-warning/60 ring-inset font-medium',
              isDragOverTarget && 'bg-primary/10 text-primary font-medium ring-1 ring-primary ring-inset',
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
                  'flex-1 min-w-0 truncate tracking-tight text-foreground',
                  isActive ? 'font-medium' : 'font-normal',
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
                          effectiveIsOpen && 'rotate-90',
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

interface CollectionContextMenuProps {
  node: TreeNode;
  allCollections?: Collection[];
  validMoveTargets?: Collection[];
  canManageCollections?: boolean;
  onCreateSub: (parentId: string, parentName: string) => void;
  onStartRename: (id: string, name: string) => void;
  onMove: (collectionId: string, newParentId: string | null) => void;
  onCopy: (collectionId: string, targetParentId: string | null) => void;
  onExportBibtex?: (id: string, name: string) => void;
  onExportBundle?: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDeleteWithItems: (id: string) => void;
}

function CollectionContextMenu({
  node,
  allCollections = [],
  validMoveTargets: propValidMoveTargets,
  canManageCollections = true,
  onCreateSub,
  onStartRename,
  onMove,
  onCopy,
  onExportBibtex,
  onExportBundle,
  onDelete,
  onDeleteWithItems,
}: CollectionContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const activeScope = useLibraryUIStore((s) => s.activeScope);
  const isProjectScope = activeScope.type === 'project';
  const isNodeProjectScope =
    Boolean(node.projectId) || (node.projectId === undefined && isProjectScope);
  const nodeScopeId: string =
    node.projectId || (isNodeProjectScope && activeScope.id ? activeScope.id : 'user');
  const rootLibraryName = isNodeProjectScope ? 'Project Library' : 'My Library';

  const validMoveTargets = useMemo(() => {
    if (propValidMoveTargets) return propValidMoveTargets;
    if (!isOpen || allCollections.length === 0) return [];
    return getValidMoveTargets(allCollections, node.id);
  }, [isOpen, propValidMoveTargets, allCollections, node.id]);
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground opacity-0 max-md:opacity-100 group-hover/node:opacity-100 data-[state=open]:opacity-100 data-[state=open]:bg-background data-[state=open]:border-border data-[state=open]:text-foreground focus-visible:opacity-100 border border-transparent hover:border-border/50 hover:bg-background transition-colors duration-150 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary relative before:absolute before:-inset-2 md:before:hidden"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Options for ${node.name}`}
        >
          <MoreVertical className="size-3.5 shrink-0" strokeWidth={1.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="end"
        sideOffset={4}
        collisionPadding={12}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-64 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 space-y-0.5 select-none"
      >
        {canManageCollections && (
          <>
            <DropdownMenuItem
              onClick={() => onCreateSub(node.id, node.name)}
              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
            >
              <FolderPlus className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
              <span>New Subcollection</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => onStartRename(node.id, node.name)}
              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
            >
              <Pencil className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
              <span>Rename Collection</span>
            </DropdownMenuItem>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors">
                <FolderOutput className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                <span>Move to</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-60 p-1.5 rounded-md border border-border bg-popover text-popover-foreground text-13 shadow-raised-200 space-y-0.5 select-none">
                <DropdownMenuItem
                  onClick={() => onMove(node.id, null)}
                  className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                >
                  {isNodeProjectScope ? (
                    <Folder className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  ) : (
                    <Library className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  )}
                  <span>{rootLibraryName}</span>
                </DropdownMenuItem>
                {validMoveTargets.map((target) => (
                  <DropdownMenuItem
                    key={target.id}
                    onClick={() => onMove(node.id, target.id)}
                    className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                  >
                    <Folder className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                    <span className="truncate">{target.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors">
                <Copy className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                <span>Copy to</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-60 p-1.5 rounded-md border border-border bg-popover text-popover-foreground text-13 shadow-raised-200 space-y-0.5 select-none">
                <DropdownMenuItem
                  onClick={() => onCopy(node.id, null)}
                  className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                >
                  {isNodeProjectScope ? (
                    <Folder className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  ) : (
                    <Library className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  )}
                  <span>{rootLibraryName}</span>
                </DropdownMenuItem>
                {validMoveTargets.map((target) => (
                  <DropdownMenuItem
                    key={target.id}
                    onClick={() => onCopy(node.id, target.id)}
                    className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                  >
                    <Folder className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                    <span className="truncate">{target.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}

        <DropdownMenuItem
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          onClick={() => onExportBibtex?.(node.id, node.name)}
        >
          <FileCode className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Export BibTeX (.bib)</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          onClick={() => onExportBundle?.(node.id, node.name)}
        >
          <FileJson className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Export Bundle (.json)</span>
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors">
            <FileCode className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
            <span>More Export Formats</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56 p-1.5 rounded-md border border-border bg-popover text-popover-foreground text-13 shadow-raised-200 space-y-0.5 select-none">
            <DropdownMenuItem
              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted"
              onClick={() =>
                void executeExportCollectionFormat(
                  node.id,
                  node.name,
                  nodeScopeId,
                  'ris',
                )
              }
            >
              <span>Export RIS (.ris)</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted"
              onClick={() =>
                void executeExportCollectionFormat(
                  node.id,
                  node.name,
                  nodeScopeId,
                  'csl_json',
                )
              }
            >
              <span>Export CSL-JSON (.json)</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted"
              onClick={() =>
                void executeExportCollectionFormat(
                  node.id,
                  node.name,
                  nodeScopeId,
                  'csv',
                )
              }
            >
              <span>Export CSV (.csv)</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted"
              onClick={() =>
                void executeExportCollectionFormat(
                  node.id,
                  node.name,
                  nodeScopeId,
                  'markdown',
                )
              }
            >
              <span>Export Markdown (.md)</span>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {canManageCollections && (
          <>
            <DropdownMenuItem
              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-destructive focus:text-destructive hover:bg-destructive/10 focus:bg-destructive/10 rounded-md outline-none transition-colors"
              onClick={() => onDelete(node.id)}
            >
              <FolderMinus className="size-4 text-destructive shrink-0" strokeWidth={1.5} />
              <span>Delete Collection</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-destructive focus:text-destructive hover:bg-destructive/10 focus:bg-destructive/10 rounded-md outline-none transition-colors"
              onClick={() => onDeleteWithItems(node.id)}
            >
              <Trash2 className="size-4 text-destructive shrink-0" strokeWidth={1.5} />
              <span>Delete Collection and Items</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
