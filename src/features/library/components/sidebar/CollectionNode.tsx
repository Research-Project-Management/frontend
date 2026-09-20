'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FolderOpen, Folder, ChevronRight } from 'lucide-react';
import { cn } from "@/shared/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui";
import type { TreeNode, CollectionActionHandlers } from './sidebar.types';
import type { Collection } from '../../types/library.types';
import { getValidMoveTargets } from './tree-helpers';
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
}

export function CollectionNode({
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
  const to = `${basePath}/${node.id}`;
  const isActive = activeId === node.id;
  const hasChildren = node.children.length > 0;
  const [isOpen, setIsOpen] = useState(true);
  const [isDragOverTarget, setIsDragOverTarget] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    if (!canManageCollections) return;
    if (e.dataTransfer.types.includes('application/x-flux-items')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
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
          const parsed = JSON.parse(raw) as { ids?: string[] };
          if (parsed.ids && parsed.ids.length > 0) {
            onDropItems?.(parsed.ids, node.id);
          }
        }
      } catch (err) {
        console.error('Failed to parse dropped items', err);
      }
    }
  };

  const validMoveTargets = useMemo(
    () => getValidMoveTargets(allCollections, node.id),
    [allCollections, node.id],
  );
  const effectiveIsOpen = isSearching ? true : isOpen;

  // SaaS indentation: 24px for root collection, +14px per subcollection depth level
  const paddingLeft = depth * 14 + 24;

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="group/node relative flex items-center w-full">
        {isActive && (
          <motion.div
            layoutId={`col-active-${navId}`}
            className="absolute inset-0 rounded-md bg-muted"
            initial={false}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )}

        {renamingId === node.id && canManageCollections ? (
          <div
            className="relative z-10 flex h-9.5 w-full items-center pr-2 min-w-0"
            style={{ paddingLeft: `${paddingLeft}px` }}
          >
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => onRenameValueChange(e.target.value)}
              onBlur={() => onSubmitRename(node.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSubmitRename(node.id);
                if (e.key === 'Escape') onSubmitRename('__cancel__');
              }}
              className="h-8 w-full min-w-0 rounded-md border border-border bg-background px-2 text-sm font-normal focus:outline-none focus:ring-1 focus:ring-ring shadow-none"
            />
          </div>
        ) : (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "group/node relative z-10 flex h-8 w-full items-center gap-2 rounded-md pr-2 transition-colors cursor-pointer select-none text-13 leading-5 tracking-tight",
              isActive
                ? "bg-muted text-foreground font-medium"
                : "text-foreground hover:bg-muted font-normal",
              isDragOverTarget && "bg-primary/15 text-primary font-medium ring-1 ring-primary/40 ring-inset"
            )}
            style={{ paddingLeft: `${paddingLeft}px` }}
          >
            {hasChildren ? (
              <Tooltip delayDuration={700}>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen((v) => !v);
                    }}
                    aria-label={effectiveIsOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
                    className="flex size-5 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-sidebar-accent transition-colors cursor-pointer"
                  >
                    <ChevronRight
                      className={cn('size-3.5 transition-transform duration-150 shrink-0', effectiveIsOpen && 'rotate-90')}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  alignOffset={2}
                  className="text-11 font-normal px-2 py-0.5 rounded-md border border-border bg-popover text-foreground shadow-sm"
                >
                  {effectiveIsOpen ? 'Collapse' : 'Expand'}
                </TooltipContent>
              </Tooltip>
            ) : depth > 0 ? (
              <span className="size-5 shrink-0" />
            ) : null}

            <Link
              href={to}
              onClick={onLinkClick}
              className="flex flex-1 min-w-0 items-center gap-2 py-1 outline-none shrink-0"
            >
              {hasChildren && effectiveIsOpen ? (
                <FolderOpen className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
              ) : (
                <Folder className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
              )}

              <span className="flex-1 min-w-0 truncate tracking-tight text-foreground">
                {node.name}
              </span>
            </Link>

            <CollectionContextMenu
              node={node}
              validMoveTargets={validMoveTargets}
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
          </div>
        )}
      </div>

      {hasChildren && effectiveIsOpen && (
        <div className="flex flex-col gap-1 w-full">
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
}
