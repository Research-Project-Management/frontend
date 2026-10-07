'use client';

import React, { useState, useCallback } from 'react';
import { useStorageItemActions } from './useFileExplorerActions';
import {
  BookText,
  Braces,
  ChevronRight,
  Copy,
  Download,
  FileCode2,
  FileText,
  Folder,
  FolderOpen,
  Image,
  Loader2,
  MoreVertical,
  Paperclip,
  Pencil,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
import { useEditorStorageFiles, useEditorStorageMutations } from '@/features/editor/hooks/use-storage';
import type { EditorStorageItem as StorageItem } from '@/features/editor/services/storage.service';

export function getStorageIcon(item: StorageItem) {
  const mime = item.mimeType ?? '';
  const ext = item.filename.split('.').pop()?.toLowerCase() ?? '';
  if (
    mime.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'eps'].includes(ext)
  ) {
    return { icon: Image, color: 'text-foreground' };
  }
  if (ext === 'pdf' || mime === 'application/pdf') {
    return { icon: FileText, color: 'text-foreground' };
  }
  if (['bib', 'bst'].includes(ext)) {
    return { icon: BookText, color: 'text-foreground' };
  }
  if (['cls', 'sty', 'ins'].includes(ext)) {
    return { icon: Braces, color: 'text-foreground' };
  }
  if (['tex', 'ltx', 'dtx'].includes(ext)) {
    return { icon: FileCode2, color: 'text-foreground' };
  }
  if (['py', 'r', 'm', 'c', 'cpp', 'java', 'js', 'ts', 'json', 'csv'].includes(ext)) {
    return { icon: FileCode2, color: 'text-foreground' };
  }
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) {
    return { icon: Paperclip, color: 'text-foreground' };
  }
  return { icon: Paperclip, color: 'text-foreground' };
}

export function IndentGuides({ depth }: { depth: number }) {
  if (depth <= 0) return null;
  return (
    <>
      {Array.from({ length: depth }).map((_, i) => (
        <span key={i} className="shrink-0 w-3.5 flex justify-center self-stretch">
          <span className="w-px h-full bg-border/60" />
        </span>
      ))}
    </>
  );
}

export function InlineInput({
  icon: Icon,
  iconColor,
  value,
  onChange,
  placeholder,
  onCommit,
  onCancel,
  isPending,
}: {
  icon: React.ElementType;
  iconColor?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onCommit: () => void;
  onCancel: () => void;
  isPending?: boolean;
}) {
  return (
    <div
      className="flex h-8 items-center gap-1.5 w-full rounded-md pl-2 pr-1 bg-muted/40 transition-colors select-none"
    >
      <span className="size-3.5 shrink-0" aria-hidden="true" />
      <Icon
        className={cn(
          'size-4 shrink-0',
          iconColor ?? 'text-foreground',
        )}
        strokeWidth={1.5}
      />
      <input
        autoFocus
        type="text"
        name="newItemName"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onCommit();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={() => {
          if (value.trim()) onCommit();
          else onCancel();
        }}
        placeholder={placeholder}
        aria-label={placeholder || 'Item name'}
        disabled={isPending}
        className="h-6.5 flex-1 min-w-0 bg-background text-12 font-sans text-foreground border border-border focus:border-foreground/50 rounded-sm px-2 py-0.5 outline-none focus-visible:ring-1 focus-visible:ring-foreground placeholder:text-muted-foreground"
      />
      {isPending && (
        <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none text-foreground shrink-0 ml-1.5" />
      )}
    </div>
  );
}

export function RenameInput({
  value,
  onChange,
  onCommit,
  onCancel,
  isPending,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  isPending?: boolean;
}) {
  return (
    <div className="flex-1 min-w-0 flex items-center">
      <input
        autoFocus
        type="text"
        name="renameItemName"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            onCommit();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={() => {
          if (value.trim()) onCommit();
          else onCancel();
        }}
        aria-label="Rename file"
        disabled={isPending}
        className="h-6.5 w-full bg-background text-12 font-normal text-foreground border border-foreground/40 rounded-sm px-2 py-0.5 outline-none focus-visible:ring-1 focus-visible:ring-foreground"
      />
      {isPending && (
        <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none text-foreground shrink-0 ml-1.5" />
      )}
    </div>
  );
}

export function RowActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Options"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-md text-foreground opacity-0 group-hover/row:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100 hover:bg-muted transition-opacity hover:transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-foreground',
                className,
              )}
            >
              <MoreVertical className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-11">
          Options
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        side="bottom"
        align="end"
        sideOffset={4}
        collisionPadding={12}
        className="w-56 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 space-y-0.5 select-none text-13"
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const StorageFolderNode = React.memo(function StorageFolderNode({
  folder,
  projectId,
  depth,
  onInsertAsset,
  onPreview,
  onUploadToFolder,
}: {
  folder: StorageItem;
  projectId: string;
  depth: number;
  onInsertAsset: (name: string) => void;
  onPreview: (item: StorageItem) => void;
  onUploadToFolder?: (files: File[], folderId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const { files: children, isLoading } = useEditorStorageFiles(
    projectId,
    folder.id,
    undefined,
    { enabled: expanded },
  );

  const { deleteFile, renameFile } = useEditorStorageMutations(projectId);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleClick = () => {
    setExpanded(!expanded);
  };

  const handleUploadClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.onchange = (ev: Event) => {
        const target = ev.target as HTMLInputElement;
        if (target.files && target.files.length > 0 && onUploadToFolder) {
          onUploadToFolder(Array.from(target.files), folder.id);
        }
      };
      input.click();
    },
    [folder.id, onUploadToFolder],
  );

  const paddingLeft = depth * 14;

  const folderRow = (
    <div
      role="button"
      tabIndex={renamingId === folder.id ? -1 : 0}
      aria-expanded={expanded}
      aria-label={`Folder ${folder.filename}`}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (renamingId !== folder.id && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleClick();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.stopPropagation();
        setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        const dropped = Array.from(e.dataTransfer.files);
        if (dropped.length > 0 && onUploadToFolder) {
          onUploadToFolder(dropped, folder.id);
        }
      }}
      className={cn(
        'group/row relative flex h-7.5 w-full items-center gap-1.5 rounded-md pl-2 pr-1 transition-colors cursor-pointer select-none text-12 leading-5 tracking-tight outline-none focus-visible:ring-1 focus-visible:ring-foreground',
        dragOver
          ? 'bg-muted ring-1 ring-foreground/20 ring-inset'
          : 'text-foreground hover:bg-muted/60 font-normal',
      )}
    >
      <IndentGuides depth={depth} />
      <ChevronRight
        className={cn(
          'size-3.5 shrink-0 text-foreground transition-transform duration-150',
          expanded && 'rotate-90',
        )}
        strokeWidth={1.75}
      />
      {expanded ? (
        <FolderOpen className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
      ) : (
        <Folder className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
      )}

      {renamingId === folder.id ? (
        <RenameInput
          value={renameValue}
          onChange={setRenameValue}
          onCommit={() => {
            const n = renameValue.trim();
            if (!n) {
              setRenamingId(null);
              return;
            }
            renameFile.mutate(
              { fileId: folder.id, name: n },
              { onSuccess: () => setRenamingId(null) },
            );
          }}
          onCancel={() => setRenamingId(null)}
          isPending={renameFile.isPending}
        />
      ) : (
        <>
          <span className="flex-1 min-w-0 truncate tracking-tight text-foreground font-mono text-12 font-medium">
            {folder.filename}
          </span>
          <RowActions>
            {onUploadToFolder && (
              <DropdownMenuItem
                onClick={handleUploadClick}
                className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
              >
                <Upload className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                <span>Upload to folder</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setRenamingId(folder.id);
                setRenameValue(folder.filename);
              }}
              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
            >
              <Pencil className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
              <span>Rename</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                deleteFile.mutate(folder.id);
              }}
              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer rounded-md outline-none focus:bg-destructive/10 focus:text-destructive focus-visible:ring-1 focus-visible:ring-destructive transition-colors"
            >
              <Trash2 className="size-4 shrink-0" strokeWidth={1.5} />
              <span>Delete</span>
            </DropdownMenuItem>
          </RowActions>
        </>
      )}
    </div>
  );

  return (
    <>
      {renamingId === folder.id ? (
        folderRow
      ) : (
        <ContextMenu>
          <ContextMenuTrigger asChild>{folderRow}</ContextMenuTrigger>
          <ContextMenuContent className="w-56 p-1.5 rounded-md border border-border bg-popover text-popover-foreground z-50 shadow-raised-200 space-y-0.5 select-none text-13">
            {onUploadToFolder && (
              <ContextMenuItem
                onClick={handleUploadClick}
                className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
              >
                <Upload className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
                <span>Upload to folder</span>
              </ContextMenuItem>
            )}
            <ContextMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setRenamingId(folder.id);
                setRenameValue(folder.filename);
              }}
              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer text-foreground rounded-md hover:bg-muted focus:bg-muted outline-none transition-colors"
            >
              <Pencil className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
              <span>Rename</span>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                deleteFile.mutate(folder.id);
              }}
              className="h-8 gap-2.5 px-2.5 text-13 font-normal whitespace-nowrap cursor-pointer rounded-md outline-none focus:bg-destructive/10 focus:text-destructive focus-visible:ring-1 focus-visible:ring-destructive transition-colors"
            >
              <Trash2 className="size-4 shrink-0" strokeWidth={1.5} />
              <span>Delete</span>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      )}

      {/* Children */}
      {expanded && (
        <div className="flex flex-col gap-0.5 w-full">
          {isLoading && (
            <div
              className="flex h-8 items-center"
              style={{ paddingLeft: `${paddingLeft + 32}px` }}
            >
              <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none text-foreground shrink-0" />
            </div>
          )}
          {children?.map((child: any) =>
            child.isFolder ? (
              <StorageFolderNode
                key={child.id}
                folder={child}
                projectId={projectId}
                depth={depth + 1}
                onInsertAsset={onInsertAsset}
                onPreview={onPreview}
                onUploadToFolder={onUploadToFolder}
              />
            ) : (
              <StorageFileRow
                key={child.id}
                item={child}
                depth={depth + 1}
                onInsertAsset={onInsertAsset}
                onPreview={onPreview}
                projectId={projectId}
              />
            ),
          )}
          {!isLoading && !children?.length && (
            <div
              className="flex h-7 items-center text-11 italic text-muted-foreground/60 select-none"
              style={{ paddingLeft: `${paddingLeft + 32}px` }}
            >
              Empty folder
            </div>
          )}
        </div>
      )}
    </>
  );
});

export const StorageFileRow = React.memo(function StorageFileRow({
  item,
  depth,
  onInsertAsset,
  onPreview,
  projectId,
}: {
  item: StorageItem;
  depth: number;
  onInsertAsset: (name: string) => void;
  onPreview: (item: StorageItem) => void;
  projectId?: string | null;
}) {
  const isImage = item.mimeType?.startsWith('image/');
  const { icon: Icon, color } = getStorageIcon(item);
  const { deleteFile, renameFile } = useEditorStorageMutations(projectId);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const { copyStorageSnippet, downloadStorageItem } = useStorageItemActions();

  const handleCopySnippet = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      copyStorageSnippet(item.filename);
    },
    [item.filename, copyStorageSnippet],
  );

  const handleDownload = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      downloadStorageItem(item.url, item.filename);
    },
    [item.url, item.filename, downloadStorageItem],
  );

  if (renamingId === item.id) {
    return (
      <div
        className="group/row flex h-8 items-center w-full rounded-md pl-2 pr-1 bg-muted/40 transition-colors select-none"
      >
        <IndentGuides depth={depth} />
        <span className="size-3.5 shrink-0" aria-hidden="true" />
        <Icon className={cn('size-4 shrink-0 mr-2', color)} strokeWidth={1.5} />
        <RenameInput
          value={renameValue}
          onChange={setRenameValue}
          onCommit={() => {
            const n = renameValue.trim();
            if (!n) {
              setRenamingId(null);
              return;
            }
            renameFile.mutate(
              { fileId: item.id, name: n },
              { onSuccess: () => setRenamingId(null) },
            );
          }}
          onCancel={() => setRenamingId(null)}
          isPending={renameFile.isPending}
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
      onClick={() => (isImage ? onPreview(item) : onInsertAsset(item.filename))}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (isImage) {
            onPreview(item);
          } else {
            onInsertAsset(item.filename);
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
            onInsertAsset(item.filename);
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
            setRenamingId(item.id);
            setRenameValue(item.filename);
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
            deleteFile.mutate(item.id);
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
            onInsertAsset(item.filename);
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
            setRenamingId(item.id);
            setRenameValue(item.filename);
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
            deleteFile.mutate(item.id);
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
