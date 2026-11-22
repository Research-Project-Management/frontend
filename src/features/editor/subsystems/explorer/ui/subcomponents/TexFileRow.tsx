'use client';

import React, { useCallback } from 'react';
import {
  Star,
  Pencil,
  Trash2,
  Download,
  Copy,
  Columns2,
  FilePlus,
  FolderPlus,
  Upload,
} from 'lucide-react';
import { editorCommandBus } from '@/features/editor/core';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/shared/components/ui/context-menu';
import { DropdownMenuItem, DropdownMenuSeparator } from '@/shared/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { copyTexCommandToClipboard } from '@/features/editor/subsystems/explorer/ui/hooks/useFileExplorerActions';
import { IndentGuides, RenameInput, RowActions } from './FileTreePrimitives';
import { getFileIcon } from './file-icon';

import { displayName, cleanBasename } from '@/features/editor/domain/document/document-naming';
export { displayName, cleanBasename };

export interface TexFileRowProps {
  file: { id: string; title: string; updatedAt?: string };
  isActive: boolean;
  isMain: boolean;
  isRenaming: boolean;
  renameValue: string;
  isRenamePending: boolean;
  depth?: number;
  displayLabel?: string;
  onFileClick: (id: string, title: string) => void;
  onFileDoubleClick?: (id: string, title: string) => void;
  onStartRename: (file: { id: string; title: string }) => void;
  onRenameChange: (val: string) => void;
  onCommitRename: (id: string) => void;
  onCancelRename: () => void;
  onDelete: (id: string) => void;
  onSetMain: (id: string) => void;
  onDownload?: (file: { id: string; title: string }) => void;
  onCopyCommand?: (title: string) => void;
  onNewFile?: () => void;
  onNewFolder?: () => void;
  onUpload?: () => void;
}

export const TexFileRow = React.memo(function TexFileRow({
  file,
  isActive,
  isMain,
  isRenaming,
  renameValue,
  isRenamePending,
  depth = 0,
  displayLabel,
  onFileClick,
  onFileDoubleClick,
  onStartRename,
  onRenameChange,
  onCommitRename,
  onCancelRename,
  onDelete,
  onSetMain,
  onDownload,
  onCopyCommand,
  onNewFile,
  onNewFolder,
  onUpload,
}: TexFileRowProps) {
  const { icon: FileIcon, color: fileColor } = getFileIcon(file.title, { monochrome: true });
  const fullName = displayName(file.title);
  const label = displayLabel || fullName;

  const handleCopyPath = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      const targetPath = file.title || fullName;
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(targetPath);
      }
    },
    [file.title, fullName],
  );

  const handleCopyInput = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      const targetPath = file.title || fullName;
      if (onCopyCommand) {
        onCopyCommand(targetPath);
      } else {
        copyTexCommandToClipboard(targetPath);
      }
    },
    [file.title, fullName, onCopyCommand],
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

  const rowRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isActive && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isActive]);

  if (isRenaming) {
    return (
      <div
        className="group/row flex h-7.5 items-center w-full rounded-md px-2 bg-muted/40 transition-colors select-none"
      >
        <IndentGuides depth={depth} />
        {depth > 0 && <span className="w-3.5 shrink-0" aria-hidden="true" />}
        <FileIcon className={cn('size-4 shrink-0 mr-1.5', fileColor)} strokeWidth={1.5} />
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
      ref={rowRef}
      role="button"
      tabIndex={0}
      aria-label={`File ${label}${isMain ? ', main document' : ''}`}
      onClick={() => onFileClick(file.id, file.title)}
      onDoubleClick={() => onFileDoubleClick?.(file.id, file.title)}
      draggable={!isRenaming}
      onDragStart={(e) => {
        e.dataTransfer.setData('application/flux-file-id', file.id);
        e.dataTransfer.setData('text/plain', file.title);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onFileClick(file.id, file.title);
        }
      }}
      className={cn(
        'group/row relative flex h-7.5 w-full items-center rounded-md px-2 transition-colors motion-reduce:transition-none cursor-pointer select-none text-12 leading-5 tracking-tight outline-none focus-visible:ring-1 focus-visible:ring-foreground',
        isActive
          ? 'bg-muted text-foreground font-medium'
          : 'text-foreground hover:bg-muted/60 font-normal',
      )}
    >
      <IndentGuides depth={depth} />
      {depth > 0 && <span className="w-3.5 shrink-0" aria-hidden="true" />}
      <FileIcon className={cn('size-4 shrink-0 mr-1.5', fileColor)} strokeWidth={1.5} />

      <Tooltip delayDuration={400}>
        <TooltipTrigger asChild>
          <span className="flex-1 min-w-0 truncate tracking-tight text-foreground text-12 font-medium">
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-11">
          {label}
        </TooltipContent>
      </Tooltip>

      {/* Row action dropdown trigger (⋮) — only visible on the active open file */}
      {isActive && (
        <RowActions className="opacity-100 sm:opacity-100">
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
            onClick={handleCopyPath}
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
          >
            <Copy className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
            <span>Copy path</span>
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
          {!isMain && /\.(tex|ltx|rtex|rnw)$/i.test(file.title || displayName(file.title)) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onSetMain(file.id);
                }}
                className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
              >
                <Star className="size-4 text-warning shrink-0" strokeWidth={1.5} />
                <span>Set as main document</span>
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={isMain}
            onClick={(e) => {
              e.stopPropagation();
              if (!isMain) onDelete(file.id);
            }}
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer rounded-md outline-none focus:bg-destructive/10 focus:text-destructive focus-visible:ring-1 focus-visible:ring-destructive transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="size-4 shrink-0" strokeWidth={1.5} />
            <span>Delete</span>
          </DropdownMenuItem>
          {(onNewFile || onNewFolder || onUpload) && (
            <>
              <DropdownMenuSeparator />
              {onNewFile && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onNewFile();
                  }}
                  className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                >
                  <FilePlus className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  <span>New file</span>
                </DropdownMenuItem>
              )}
              {onNewFolder && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onNewFolder();
                  }}
                  className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                >
                  <FolderPlus className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  <span>New folder</span>
                </DropdownMenuItem>
              )}
              {onUpload && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpload();
                  }}
                  className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
                >
                  <Upload className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                  <span>Upload</span>
                </DropdownMenuItem>
              )}
            </>
          )}
        </RowActions>
      )}
    </div>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{rowContent}</ContextMenuTrigger>
      <ContextMenuContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-56 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 space-y-0.5 select-none text-13"
      >
        {!isMain && /\.(tex|ltx|rtex|rnw)$/i.test(file.title || displayName(file.title)) ? (
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
        ) : (
          <ContextMenuItem
            disabled
            className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap text-muted-foreground/80 rounded-md cursor-default select-none opacity-80"
          >
            <Star className="size-4 text-warning fill-warning shrink-0" />
            <span>Current Main Document</span>
          </ContextMenuItem>
        )}
        <ContextMenuItem
          onClick={(e) => {
            e.stopPropagation();
            editorCommandBus.dispatch({ type: 'editor:open-to-side', fileId: file.id });
          }}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
        >
          <Columns2 className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Open to the Side</span>
        </ContextMenuItem>
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
          disabled={isMain}
          onClick={(e) => {
            e.stopPropagation();
            if (!isMain) onDelete(file.id);
          }}
          className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer rounded-md outline-none focus:bg-destructive/10 focus:text-destructive focus-visible:ring-1 focus-visible:ring-destructive transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="size-4 shrink-0" strokeWidth={1.5} />
          <span>Delete</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});
