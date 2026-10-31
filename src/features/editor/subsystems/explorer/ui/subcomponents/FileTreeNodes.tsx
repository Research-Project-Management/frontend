'use client';

import React, { useState, useCallback } from 'react';
import { useStorageItemActions } from '@/features/editor/subsystems/explorer/ui/hooks/useFileExplorerActions';
import {
  BookText,
  Braces,
  Copy,
  Download,
  FileCode2,
  FileText,
  Image,
  Paperclip,
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
import { useEditorStorageMutations } from '@/features/editor/ui/hooks/useStorage';
import type { EditorStorageItem as StorageItem } from '@/features/editor/domain/types/storage-item.types';
import {
  RASTER_AND_VECTOR_IMAGE_EXTENSIONS,
  CODE_EXTENSIONS,
} from '@/features/editor/core';

const ICON_IMAGE = { icon: Image, color: 'text-foreground' };
const ICON_PDF = { icon: FileText, color: 'text-foreground' };
const ICON_BIB = { icon: BookText, color: 'text-foreground' };
const ICON_CLS = { icon: Braces, color: 'text-foreground' };
const ICON_CODE = { icon: FileCode2, color: 'text-foreground' };
const ICON_ATTACHMENT = { icon: Paperclip, color: 'text-foreground' };

const IMAGE_EXT_SET = RASTER_AND_VECTOR_IMAGE_EXTENSIONS;
const CODE_EXT_SET = CODE_EXTENSIONS;

export function getStorageIcon(item: StorageItem) {
  const mime = item.mimeType ?? '';
  const ext = item.filename.split('.').pop()?.toLowerCase() ?? '';
  if (mime.startsWith('image/') || IMAGE_EXT_SET.has(ext)) {
    return ICON_IMAGE;
  }
  if (ext === 'pdf' || mime === 'application/pdf') {
    return ICON_PDF;
  }
  if (ext === 'bib' || ext === 'bst') {
    return ICON_BIB;
  }
  if (ext === 'cls' || ext === 'sty' || ext === 'ins') {
    return ICON_CLS;
  }
  if (CODE_EXT_SET.has(ext)) {
    return ICON_CODE;
  }
  return ICON_ATTACHMENT;
}

export {
  IndentGuides,
  InlineInput,
  RenameInput,
  RowActions,
} from './FileTreePrimitives';
import {
  IndentGuides,
  RenameInput,
  RowActions,
} from './FileTreePrimitives';

export const StorageFileRow = React.memo(function StorageFileRow({
  item,
  depth,
  onInsertAsset,
  onPreview,
  onRequestDelete,
  onStartRename,
  isRenaming = false,
  renameValue = '',
  isRenamePending = false,
  onRenameChange,
  onCommitRename,
  onCancelRename,
  projectId,
}: {
  item: StorageItem;
  depth: number;
  onInsertAsset: (name: string) => void;
  onPreview: (item: StorageItem) => void;
  onRequestDelete?: (id: string) => void;
  onStartRename?: (file: { id: string; title: string; isFolder?: boolean }) => void;
  isRenaming?: boolean;
  renameValue?: string;
  isRenamePending?: boolean;
  onRenameChange?: (val: string) => void;
  onCommitRename?: (id: string) => void;
  onCancelRename?: () => void;
  projectId?: string | null;
}) {
  const isImage = item.mimeType?.startsWith('image/');
  const { icon: Icon, color } = getStorageIcon(item);
  const { copyStorageSnippet, downloadStorageItem } = useStorageItemActions();

  const fullAssetPath = item.path || item.filename;

  const handleCopySnippet = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      copyStorageSnippet(fullAssetPath);
    },
    [fullAssetPath, copyStorageSnippet],
  );

  const handleDownload = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      downloadStorageItem(item.url, item.filename);
    },
    [item.url, item.filename, downloadStorageItem],
  );

  if (isRenaming && onRenameChange && onCommitRename && onCancelRename) {
    return (
      <div
        className="group/row flex h-8 items-center w-full rounded-md pl-2 pr-1 bg-muted/40 transition-colors select-none"
      >
        <IndentGuides depth={depth} />
        <span className="size-3.5 shrink-0" aria-hidden="true" />
        <Icon className={cn('size-4 shrink-0 mr-2', color)} strokeWidth={1.5} />
        <RenameInput
          value={renameValue}
          onChange={onRenameChange}
          onCommit={() => onCommitRename(item.id)}
          onCancel={onCancelRename}
          isPending={isRenamePending}
        />
      </div>
    );
  }

  const fileRowContent = (
    <div
      role="button"
      tabIndex={0}
      aria-label={
        isImage
          ? `Preview image ${item.filename}`
          : `Insert command for ${item.filename}`
      }
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-asset-id', item.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => (isImage ? onPreview(item) : onInsertAsset(fullAssetPath))}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (isImage) {
            onPreview(item);
          } else {
            onInsertAsset(fullAssetPath);
          }
        }
      }}
      className="group/row relative flex h-7.5 w-full items-center gap-1.5 rounded-md pl-2 pr-1 transition-colors cursor-pointer select-none text-12 leading-5 tracking-tight outline-none focus-visible:ring-1 focus-visible:ring-foreground text-foreground hover:bg-muted/60 font-normal"
    >
      <IndentGuides depth={depth} />
      <span className="size-3.5 shrink-0" aria-hidden="true" />
      <Icon className={cn('size-4 shrink-0', color)} strokeWidth={1.5} />

      <Tooltip delayDuration={400}>
        <TooltipTrigger asChild>
          <span className="flex-1 min-w-0 truncate tracking-tight text-foreground font-mono text-12">
            {item.filename}
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-11">
          {isImage ? 'Preview image' : 'Insert snippet'}
        </TooltipContent>
      </Tooltip>

      <RowActions>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onInsertAsset(fullAssetPath);
          }}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <FileCode2 className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Insert into document</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleCopySnippet}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <Copy className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Copy LaTeX snippet</span>
        </DropdownMenuItem>
        {item.url && (
          <DropdownMenuItem
            onClick={handleDownload}
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          >
            <Download className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
            <span>Download</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onStartRename?.({ id: item.id, title: fullAssetPath });
          }}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <Pencil className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Rename</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={(e) => {
            e.stopPropagation();
            onRequestDelete?.(item.id);
          }}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer rounded-md outline-none focus:bg-destructive/10 focus:text-destructive focus-visible:ring-1 focus-visible:ring-destructive transition-colors"
        >
          <Trash2 className="size-4 shrink-0" strokeWidth={1.5} />
          <span>Delete</span>
        </DropdownMenuItem>
      </RowActions>
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{fileRowContent}</ContextMenuTrigger>
      <ContextMenuContent className="w-56 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 space-y-0.5 select-none text-13">
        <ContextMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onInsertAsset(fullAssetPath);
          }}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <FileCode2 className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Insert into document</span>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={handleCopySnippet}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <Copy className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Copy LaTeX snippet</span>
        </ContextMenuItem>
        {item.url && (
          <ContextMenuItem
            onClick={handleDownload}
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          >
            <Download className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
            <span>Download</span>
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onStartRename?.({ id: item.id, title: fullAssetPath });
          }}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <Pencil className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Rename</span>
        </ContextMenuItem>
        <ContextMenuItem
          variant="destructive"
          onClick={(e) => {
            e.stopPropagation();
            onRequestDelete?.(item.id);
          }}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer rounded-md outline-none focus:bg-destructive/10 focus:text-destructive focus-visible:ring-1 focus-visible:ring-destructive transition-colors"
        >
          <Trash2 className="size-4 shrink-0" strokeWidth={1.5} />
          <span>Delete</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});
