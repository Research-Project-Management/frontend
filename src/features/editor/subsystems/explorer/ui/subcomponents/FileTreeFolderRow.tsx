'use client';

/**
 * FileTreeFolderRow.tsx
 *
 * Presentational component for a folder row in the unified file tree:
 * - Expand / collapse toggle with animated Chevron
 * - Drag and drop target for internal file moving
 * - Action menu for creating files or uploading assets directly inside the folder
 */

import React from 'react';
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  FileCode2,
  Upload,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/shared/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/shared/components/ui/context-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { IndentGuides, RenameInput, RowActions } from './FileTreePrimitives';
import type { FileTreeFolderNode } from '@/features/editor/subsystems/explorer/model/document-tree';
import { useFolderDiagnosticsSummary } from '@/features/editor/ui/hooks/useDiagnosticsSummary';

export interface FileTreeFolderRowProps {
  node: FileTreeFolderNode;
  depth?: number;
  isExpanded: boolean;
  isRenaming?: boolean;
  renameValue?: string;
  isRenamePending?: boolean;
  onToggle: (name: string) => void;
  onMoveItem: (itemId: string, targetFolderId: string | null) => void;
  onNewFileInFolder: (folderName: string) => void;
  onNewFolderInFolder?: (folderName: string) => void;
  onUploadToFolder: (folderId: string) => void;
  onStartRename?: (folder: { id: string; title: string; isFolder?: boolean }) => void;
  onRenameChange?: (val: string) => void;
  onCommitRename?: (id: string) => void;
  onCancelRename?: () => void;
  onDelete?: (id: string) => void;
  children?: React.ReactNode;
}

export const FileTreeFolderRow = React.memo(function FileTreeFolderRow({
  node,
  depth = 0,
  isExpanded,
  isRenaming = false,
  renameValue = '',
  isRenamePending = false,
  onToggle,
  onMoveItem,
  onNewFileInFolder,
  onNewFolderInFolder,
  onUploadToFolder,
  onStartRename,
  onRenameChange,
  onCommitRename,
  onCancelRename,
  onDelete,
  children,
}: FileTreeFolderRowProps) {
  const folderKey = node.fullPath || node.name;
  const folderDiag = useFolderDiagnosticsSummary(folderKey);
  const isPersistedFolder = !node.id.startsWith('folder:');

  if (isRenaming && onRenameChange && onCommitRename && onCancelRename) {
    return (
      <div className="flex flex-col">
        <div className="group/row flex h-7.5 items-center w-full rounded-md pl-2 pr-1 bg-muted/40 transition-colors select-none">
          <IndentGuides depth={depth} />
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 text-foreground transition-transform duration-150 mr-1.5',
              isExpanded && 'rotate-90',
            )}
            strokeWidth={1.75}
          />
          {isExpanded ? (
            <FolderOpen className="size-4 shrink-0 text-foreground mr-2" strokeWidth={1.5} />
          ) : (
            <Folder className="size-4 shrink-0 text-foreground mr-2" strokeWidth={1.5} />
          )}
          <RenameInput
            value={renameValue}
            onChange={onRenameChange}
            onCommit={() => onCommitRename(node.id)}
            onCancel={onCancelRename}
            isPending={isRenamePending}
          />
        </div>
        {isExpanded && <div className="flex flex-col">{children}</div>}
      </div>
    );
  }

  const folderRowContent = (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-label={`Folder ${node.name}`}
      draggable={isPersistedFolder}
      onDragStart={(e) => {
        if (!isPersistedFolder) return;
        e.dataTransfer.setData('application/flux-file-id', node.id);
        e.dataTransfer.setData('text/plain', folderKey);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => onToggle(folderKey)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle(folderKey);
        }
      }}
      onDragOver={(e) => {
        if (
          e.dataTransfer.types.includes('application/flux-file-id') ||
          e.dataTransfer.types.includes('application/x-asset-id')
        ) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'move';
        }
      }}
      onDrop={(e) => {
        const internalFileId =
          e.dataTransfer.getData('application/flux-file-id') ||
          e.dataTransfer.getData('application/x-asset-id');
        if (internalFileId && internalFileId !== node.id) {
          e.preventDefault();
          e.stopPropagation();
          onMoveItem(internalFileId, node.id);
        }
      }}
      className={cn(
        'group/row relative flex h-7.5 w-full items-center gap-1.5 rounded-md pl-2 pr-1 transition-colors cursor-pointer select-none text-12 leading-5 tracking-tight outline-none focus-visible:ring-1 focus-visible:ring-foreground',
        'text-foreground hover:bg-muted/60 font-normal',
      )}
    >
      <IndentGuides depth={depth} />
      <ChevronRight
        className={cn(
          'size-3.5 shrink-0 text-foreground transition-transform duration-150',
          isExpanded && 'rotate-90',
        )}
        strokeWidth={1.75}
      />
      {isExpanded ? (
        <FolderOpen className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
      ) : (
        <Folder className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
      )}

      <span className="flex-1 min-w-0 truncate text-12 font-medium tracking-tight text-foreground">
        {node.name}
      </span>

      {/* Aggregated Folder Diagnostics Badge (Overleaf & VS Code Parity) */}
      {!isExpanded && folderDiag.errorCount > 0 ? (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <span
              data-testid="folder-error-badge"
              data-count={folderDiag.errorCount}
              className="shrink-0 flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-10 font-mono font-semibold bg-destructive text-destructive-foreground cursor-default select-none shadow-none"
            >
              {folderDiag.errorCount}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-11">
            {folderDiag.errorCount} error{folderDiag.errorCount > 1 ? 's' : ''} in {node.name}
            {folderDiag.warningCount > 0 ? `, ${folderDiag.warningCount} warning${folderDiag.warningCount > 1 ? 's' : ''}` : ''}
          </TooltipContent>
        </Tooltip>
      ) : !isExpanded && folderDiag.warningCount > 0 ? (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <span
              data-testid="folder-warning-badge"
              data-count={folderDiag.warningCount}
              className="shrink-0 flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-10 font-mono font-semibold bg-warning/20 text-warning border border-warning/30 cursor-default select-none shadow-none"
            >
              {folderDiag.warningCount}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-11">
            {folderDiag.warningCount} warning{folderDiag.warningCount > 1 ? 's' : ''} in {node.name}
          </TooltipContent>
        </Tooltip>
      ) : null}

      <RowActions>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onNewFileInFolder(folderKey);
          }}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <FileCode2 className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>New file in {node.name}</span>
        </DropdownMenuItem>
        {onNewFolderInFolder && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onNewFolderInFolder(folderKey);
            }}
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          >
            <FolderPlus className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
            <span>New subfolder in {node.name}</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onUploadToFolder(node.id);
          }}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <Upload className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Upload to {node.name}</span>
        </DropdownMenuItem>
        {isPersistedFolder && (onStartRename || onDelete) && <DropdownMenuSeparator />}
        {isPersistedFolder && onStartRename && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onStartRename({ id: node.id, title: node.name, isFolder: true });
            }}
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          >
            <Pencil className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
            <span>Rename</span>
          </DropdownMenuItem>
        )}
        {isPersistedFolder && onDelete && (
          <DropdownMenuItem
            variant="destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.id);
            }}
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer rounded-md outline-none focus:bg-destructive/10 focus:text-destructive focus-visible:ring-1 focus-visible:ring-destructive transition-colors"
          >
            <Trash2 className="size-4 shrink-0" strokeWidth={1.5} />
            <span>Delete</span>
          </DropdownMenuItem>
        )}
      </RowActions>
    </div>
  );

  return (
    <div className="flex flex-col">
      <ContextMenu>
        <ContextMenuTrigger asChild>{folderRowContent}</ContextMenuTrigger>
        <ContextMenuContent className="w-56 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 space-y-0.5 select-none text-13">
          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onNewFileInFolder(folderKey);
            }}
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          >
            <FileCode2 className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
            <span>New file in {node.name}</span>
          </ContextMenuItem>
          {onNewFolderInFolder && (
            <ContextMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onNewFolderInFolder(folderKey);
              }}
              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
            >
              <FolderPlus className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
              <span>New subfolder in {node.name}</span>
            </ContextMenuItem>
          )}
          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onUploadToFolder(node.id);
            }}
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          >
            <Upload className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
            <span>Upload to {node.name}</span>
          </ContextMenuItem>
          {isPersistedFolder && (onStartRename || onDelete) && <ContextMenuSeparator />}
          {isPersistedFolder && onStartRename && (
            <ContextMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onStartRename({ id: node.id, title: node.name, isFolder: true });
              }}
              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
            >
              <Pencil className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
              <span>Rename</span>
            </ContextMenuItem>
          )}
          {isPersistedFolder && onDelete && (
            <ContextMenuItem
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node.id);
              }}
              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer rounded-md outline-none focus:bg-destructive/10 focus:text-destructive focus-visible:ring-1 focus-visible:ring-destructive transition-colors"
            >
              <Trash2 className="size-4 shrink-0" strokeWidth={1.5} />
              <span>Delete</span>
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {isExpanded && (
        <div className="flex flex-col">
          {node.children.length === 0 ? (
            <div
              className="flex h-7 items-center text-11 italic text-muted-foreground/60 select-none"
              style={{ paddingLeft: `${8 + (depth + 1) * 14 + 20}px` }}
            >
              Empty folder
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
});
