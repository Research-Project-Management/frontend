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
import { ChevronRight, Folder, FolderOpen, FileCode2, Upload } from 'lucide-react';
import { DropdownMenuItem } from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import { IndentGuides, RowActions } from './FileTreeNodes';
import type { FileTreeFolderNode } from './tree-builder.util';

export interface FileTreeFolderRowProps {
  node: FileTreeFolderNode;
  depth?: number;
  isExpanded: boolean;
  onToggle: (name: string) => void;
  onMoveItem: (itemId: string, targetFolderId: string | null) => void;
  onNewFileInFolder: (folderName: string) => void;
  onUploadToFolder: (folderId: string) => void;
  children?: React.ReactNode;
}

export const FileTreeFolderRow = React.memo(function FileTreeFolderRow({
  node,
  depth = 0,
  isExpanded,
  onToggle,
  onMoveItem,
  onNewFileInFolder,
  onUploadToFolder,
  children,
}: FileTreeFolderRowProps) {
  return (
    <div className="flex flex-col">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`Folder ${node.name}`}
        onClick={() => onToggle(node.name)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle(node.name);
          }
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('application/flux-file-id')) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
          }
        }}
        onDrop={(e) => {
          const internalFileId = e.dataTransfer.getData('application/flux-file-id');
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

        <span className="flex-1 min-w-0 truncate font-mono text-12 font-medium tracking-tight text-foreground">
          {node.name}
        </span>

        <RowActions>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onNewFileInFolder(node.name);
            }}
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          >
            <FileCode2 className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
            <span>New file in {node.name}</span>
          </DropdownMenuItem>
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
        </RowActions>
      </div>

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
