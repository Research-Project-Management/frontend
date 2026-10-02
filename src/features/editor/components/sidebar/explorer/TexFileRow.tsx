'use client';

import React from 'react';
import {
  FileCode2,
  BookText,
  Braces,
  FileType,
  Star,
  Pencil,
  Trash2,
} from 'lucide-react';
import { DropdownMenuItem } from '@/shared/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
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
      return { icon: Braces, color: 'text-primary' };
    case 'md':
    case 'txt':
      return { icon: FileType, color: 'text-muted-foreground' };
    default:
      return { icon: FileCode2, color: 'text-muted-foreground' };
  }
}

export const displayName = (title: string) =>
  /\.[a-z]+$/i.test(title) ? title : `${title}.tex`;

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
}: TexFileRowProps) {
  const { icon: FileIcon, color: fileColor } = getFileIcon(file.title);

  return (
    <div
      onClick={() => onFileClick(file.id, file.title)}
      className={cn(
        'group/row flex h-7.5 cursor-pointer items-center rounded-md mx-1 px-2 my-0.5 transition-colors select-none',
        isActive
          ? 'bg-muted text-foreground font-medium'
          : 'hover:bg-muted/60 text-foreground/90',
      )}
    >
      <FileIcon
        className={cn(
          'size-3.5 shrink-0 mr-1.5',
          fileColor,
        )}
      />

      {isRenaming ? (
        <RenameInput
          value={renameValue}
          onChange={onRenameChange}
          onCommit={() => onCommitRename(file.id)}
          onCancel={onCancelRename}
          isPending={isRenamePending}
        />
      ) : (
        <>
          <span
            className={cn(
              'flex-1 min-w-0 truncate text-xs font-mono',
              isActive ? 'text-foreground font-medium' : 'text-foreground/90',
            )}
          >
            {displayName(file.title)}
          </span>
          {isMain && !isRenaming && (
            <span
              className="shrink-0 text-11 font-mono px-1.5 py-px rounded-full font-medium mr-1 border border-primary/30 bg-primary/10 text-primary"
            >
              main
            </span>
          )}
          {!isRenaming && (
            <RowActions
              className={
                isActive
                  ? 'text-foreground opacity-100'
                  : undefined
              }
            >
              {!isMain && (
                <DropdownMenuItem
                  className="text-xs!"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetMain(file.id);
                  }}
                >
                  <Star className="size-3.5 mr-2 shrink-0" />
                  Set as Main File
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-xs!"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartRename(file);
                }}
              >
                <Pencil className="size-3.5 mr-2 shrink-0" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs!"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(file.id);
                }}
              >
                <Trash2 className="size-3.5 mr-2 shrink-0" />
                Delete
              </DropdownMenuItem>
            </RowActions>
          )}
        </>
      )}
    </div>
  );
});
