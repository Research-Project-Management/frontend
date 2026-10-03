'use client';

import React, { useCallback } from 'react';
import {
  FileCode2,
  BookText,
  Braces,
  FileType,
  Star,
  Pencil,
  Trash2,
  Download,
  Copy,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/shared/components/ui/context-menu';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';
import { RenameInput, RowActions } from './FileTreeNodes';

export function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'tex':
    case 'ltx':
    case 'dtx':
      return { icon: FileCode2, color: 'text-primary' };
    case 'bib':
    case 'bst':
      return { icon: BookText, color: 'text-success' };
    case 'cls':
    case 'sty':
    case 'ins':
      return { icon: Braces, color: 'text-muted-foreground' };
    case 'md':
    case 'txt':
      return { icon: FileType, color: 'text-muted-foreground' };
    default:
      return { icon: FileCode2, color: 'text-muted-foreground' };
  }
}

export const displayName = (title: string) =>
  /\.[a-z0-9]+$/i.test(title) ? title : `${title}.tex`;

export const cleanBasename = (title: string) =>
  title.replace(/\.[a-z0-9]+$/i, '');

export interface TexFileRowProps {
  file: { id: string; title: string; updatedAt?: string };
  isActive: boolean;
  isMain: boolean;
  isRenaming: boolean;
  renameValue: string;
  isRenamePending: boolean;
  onFileClick: (id: string, title: string) => void;
  onStartRename: (file: { id: string; title: string }) => void;
  onRenameChange: (val: string) => void;
  onCommitRename: (id: string) => void;
  onCancelRename: () => void;
  onDelete: (id: string) => void;
  onSetMain: (id: string) => void;
  onDownload?: (file: { id: string; title: string }) => void;
  onCopyCommand?: (title: string) => void;
}

export const TexFileRow = React.memo(function TexFileRow({
  file,
  isActive,
  isMain,
  isRenaming,
  renameValue,
  isRenamePending,
  onFileClick,
  onStartRename,
  onRenameChange,
  onCommitRename,
  onCancelRename,
  onDelete,
  onSetMain,
  onDownload,
  onCopyCommand,
}: TexFileRowProps) {
  const { icon: FileIcon, color: fileColor } = getFileIcon(file.title);
  const fullName = displayName(file.title);

  const handleCopyInput = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (onCopyCommand) {
        onCopyCommand(fullName);
      } else {
        const base = cleanBasename(fullName);
        const ext = fullName.split('.').pop()?.toLowerCase();
        const snippet = ext === 'bib' ? `\\bibliography{${base}}` : `\\input{${base}}`;
        navigator.clipboard.writeText(snippet);
        toast.success(`Copied ${snippet} to clipboard`);
      }
    },
    [fullName, onCopyCommand],
  );

  const handleDownload = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (onDownload) {
        onDownload(file);
      }
    },
    [file, onDownload],
  );

  if (isRenaming) {
    return (
      <div className="group/row flex h-8 items-center rounded-md mx-1.5 px-2 my-0.5 bg-muted/40 transition-colors select-none">
        <FileIcon className={cn('size-4 shrink-0 mr-2', fileColor)} strokeWidth={1.5} />
        <RenameInput
          value={renameValue}
          onChange={onRenameChange}
          onCommit={() => onCommitRename(file.id)}
          onCancel={onCancelRename}
          isPending={isRenamePending}
        />
      </div>
    );
  }

  const rowContent = (
    <div
      role="button"
      tabIndex={0}
      aria-label={`File ${fullName}${isMain ? ', main document' : ''}`}
      onClick={() => onFileClick(file.id, file.title)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onFileClick(file.id, file.title);
        }
      }}
      className={cn(
        'group/row relative flex h-8 items-center gap-2 rounded-md mx-1.5 px-2 my-0.5 transition-colors cursor-pointer select-none text-13 leading-5 tracking-tight outline-none focus-visible:ring-1 focus-visible:ring-primary',
        isActive
          ? 'bg-muted text-foreground font-medium'
          : 'text-foreground hover:bg-muted/60 font-normal',
      )}
    >
      <FileIcon className={cn('size-4 shrink-0', fileColor)} strokeWidth={1.5} />

      <span className="flex-1 min-w-0 truncate tracking-tight text-foreground">
        {fullName}
      </span>

      {isMain && (
        <span
          title="Main document"
          className="shrink-0 text-10 font-mono px-1.5 py-0.5 rounded-full font-medium border border-primary/30 bg-primary/10 text-primary"
        >
          main
        </span>
      )}

      {/* Row action dropdown trigger (⋮) - Matching Library CollectionContextMenu */}
      <RowActions className={isActive ? 'text-foreground opacity-100' : undefined}>
        {!isMain && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onSetMain(file.id);
            }}
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          >
            <Star className="size-4 text-warning shrink-0" strokeWidth={1.5} />
            <span>Set as Main Document</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={handleCopyInput}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <Copy className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Copy \input command</span>
        </DropdownMenuItem>
        {onDownload && (
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
            onStartRename(file);
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
            onDelete(file.id);
          }}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer rounded-md outline-none transition-colors"
        >
          <Trash2 className="size-4 shrink-0" strokeWidth={1.5} />
          <span>Delete</span>
        </DropdownMenuItem>
      </RowActions>
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{rowContent}</ContextMenuTrigger>
      <ContextMenuContent className="w-56 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 space-y-0.5 select-none text-13">
        {!isMain && (
          <ContextMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onSetMain(file.id);
            }}
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          >
            <Star className="size-4 text-warning shrink-0" strokeWidth={1.5} />
            <span>Set as Main Document</span>
          </ContextMenuItem>
        )}
        <ContextMenuItem
          onClick={handleCopyInput}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <Copy className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Copy \input command</span>
        </ContextMenuItem>
        {onDownload && (
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
            onStartRename(file);
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
            onDelete(file.id);
          }}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer rounded-md outline-none transition-colors"
        >
          <Trash2 className="size-4 shrink-0" strokeWidth={1.5} />
          <span>Delete</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});
