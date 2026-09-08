'use client';

import React, { useState } from 'react';
import {
  BookText,
  Check,
  ChevronRight,
  Ellipsis,
  FileCode2,
  FileText,
  Folder,
  FolderOpen,
  Image,
  Loader2,
  Paperclip,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import { useEditorStorage } from '@/features/editor/hooks/use-storage';
import type { EditorStorageItem as StorageItem } from '@/features/editor/services/storage.service';

export function getStorageIcon(item: StorageItem) {
  const mime = item.mimeType ?? '';
  const ext = item.filename.split('.').pop()?.toLowerCase() ?? '';
  if (
    mime.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'eps'].includes(ext)
  )
    return { icon: Image, color: 'text-warning' };
  if (ext === 'pdf' || mime === 'application/pdf')
    return { icon: FileText, color: 'text-destructive' };
  if (['bib', 'bst'].includes(ext))
    return { icon: BookText, color: 'text-success' };
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext))
    return { icon: Paperclip, color: 'text-muted-foreground' };
  return { icon: Paperclip, color: 'text-primary' };
}

export function IndentGuides({ depth }: { depth: number }) {
  if (depth <= 0) return null;
  return (
    <>
      {Array.from({ length: depth }).map((_, i) => (
        <span key={i} className="shrink-0 w-4 flex justify-center self-stretch">
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
    <div className="mx-2 flex h-8 items-center rounded-md border border-primary/30 bg-primary/5 pl-3 pr-2">
      <Icon
        className={cn(
          'size-3.5 shrink-0 mr-1.5',
          iconColor ?? 'text-muted-foreground',
        )}
      />
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder={placeholder}
        className="flex-1 min-w-0 text-xs bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/40"
      />
      <button
        onClick={onCommit}
        disabled={isPending}
        className="p-0.5 text-primary hover:opacity-70 transition-opacity disabled:opacity-40 shrink-0"
      >
        {isPending ? (
          <Loader2 className="size-3 animate-spin shrink-0" />
        ) : (
          <Check className="size-3 shrink-0" />
        )}
      </button>
      <button
        onClick={onCancel}
        className="p-0.5 text-foreground hover:bg-muted rounded transition-colors shrink-0"
      >
        <X className="size-3 shrink-0" />
      </button>
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
    <>
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') onCommit();
          if (e.key === 'Escape') onCancel();
        }}
        className="min-w-0 flex-1 rounded-md border border-primary/40 bg-primary/5 px-1 text-xs text-foreground outline-none"
      />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCommit();
        }}
        disabled={isPending}
        className="p-0.5 text-primary hover:opacity-70 transition-opacity disabled:opacity-40 shrink-0"
      >
        {isPending ? (
          <Loader2 className="size-3 animate-spin shrink-0" />
        ) : (
          <Check className="size-3 shrink-0" />
        )}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCancel();
        }}
        className="p-0.5 text-foreground hover:bg-muted rounded transition-colors shrink-0"
      >
        <X className="size-3 shrink-0" />
      </button>
    </>
  );
}

export function RowActions({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="File options"
          onClick={(e) => e.stopPropagation()}
          className="rounded-md p-1 text-foreground opacity-0 transition-opacity hover:bg-muted focus:opacity-100 group-hover/row:opacity-100"
        >
          <Ellipsis className="size-3.5 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 text-xs z-[9999]">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function StorageFolderNode({
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

  const { files: children, isLoading } = useEditorStorage(
    projectId,
    expanded ? folder.id : undefined,
  );

  const { deleteFile, renameFile } = useEditorStorage(projectId, undefined);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleClick = () => {
    setExpanded(!expanded);
  };

  return (
    <>
      <div
        onClick={handleClick}
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
          if (dropped.length > 0 && onUploadToFolder)
            onUploadToFolder(dropped, folder.id);
        }}
        className={cn(
          'group/row flex h-8 cursor-pointer items-center border-l-2 border-l-transparent pr-2 transition-colors',
          dragOver
            ? 'bg-primary/10 outline outline-1 outline-primary/30'
            : 'hover:bg-muted',
        )}
      >
        <IndentGuides depth={depth} />
        <ChevronRight
          className={cn(
            'size-3 shrink-0 text-muted-foreground transition-transform duration-150 mx-0.5',
            expanded && 'rotate-90',
          )}
        />
        {expanded ? (
          <FolderOpen className="size-3.5 shrink-0 text-warning mr-1.5" />
        ) : (
          <Folder className="size-3.5 shrink-0 text-warning mr-1.5" />
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
            <span className="flex-1 min-w-0 truncate text-sm text-foreground/90">
              {folder.filename}
            </span>
            <RowActions>
              <DropdownMenuItem
                className="text-xs!"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenamingId(folder.id);
                  setRenameValue(folder.filename);
                }}
              >
                <Pencil className="size-3.5 mr-2 shrink-0" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs!"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteFile.mutate(folder.id);
                }}
              >
                <Trash2 className="size-3.5 mr-2 shrink-0" />
                Delete
              </DropdownMenuItem>
            </RowActions>
          </>
        )}
      </div>

      {/* Children */}
      {expanded && (
        <>
          {isLoading && (
            <div
              className="flex h-8 items-center"
              style={{ paddingLeft: `${(depth + 1) * 16 + 20}px` }}
            >
              <Loader2 className="size-3 animate-spin text-muted-foreground shrink-0" />
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
              />
            ),
          )}
          {!isLoading && !children?.length && (
            <div
              className="flex h-8 items-center text-xs italic text-muted-foreground/50"
              style={{ paddingLeft: `${(depth + 1) * 16 + 20}px` }}
            >
              Empty folder
            </div>
          )}
        </>
      )}
    </>
  );
}

export function StorageFileRow({
  item,
  depth,
  onInsertAsset,
  onPreview,
}: {
  item: StorageItem;
  depth: number;
  onInsertAsset: (name: string) => void;
  onPreview: (item: StorageItem) => void;
}) {
  const isImage = item.mimeType?.startsWith('image/');
  const { icon: Icon, color } = getStorageIcon(item);
  const { deleteFile, renameFile } = useEditorStorage(null, undefined);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-asset-id', item.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={() => (isImage ? onPreview(item) : onInsertAsset(item.filename))}
      title={
        isImage
          ? `Click to preview ${item.filename}`
          : `Click to insert \\includegraphics{${item.filename}}`
      }
      className="group/row flex h-8 cursor-pointer items-center border-l-2 border-l-transparent pr-2 transition-colors hover:bg-muted"
    >
      <IndentGuides depth={depth} />
      <span className="w-4 shrink-0" />
      <Icon className={cn('size-3.5 shrink-0 mr-1.5', color)} />

      {renamingId === item.id ? (
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
      ) : (
        <>
          <span className="flex-1 min-w-0 truncate text-sm text-foreground/90">
            {item.filename}
          </span>
          <RowActions>
            <DropdownMenuItem
              className="text-xs!"
              onClick={(e) => {
                e.stopPropagation();
                onInsertAsset(item.filename);
              }}
            >
              <FileCode2 className="size-3.5 mr-2 shrink-0" />
              Insert Command
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-xs!"
              onClick={(e) => {
                e.stopPropagation();
                setRenamingId(item.id);
                setRenameValue(item.filename);
              }}
            >
              <Pencil className="size-3.5 mr-2 shrink-0" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-xs!"
              onClick={(e) => {
                e.stopPropagation();
                deleteFile.mutate(item.id);
              }}
            >
              <Trash2 className="size-3.5 mr-2 shrink-0" />
              Delete
            </DropdownMenuItem>
          </RowActions>
        </>
      )}
    </div>
  );
}
