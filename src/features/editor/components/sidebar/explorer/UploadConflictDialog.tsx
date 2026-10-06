'use client';

import React from 'react';
import {
  AlertTriangle,
  FileCode2,
  Folder,
  FolderArchive,
  Image,
  Paperclip,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
} from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";

export const TEX_EXTS = new Set([
  '.tex',
  '.bib',
  '.cls',
  '.sty',
  '.bst',
  '.txt',
  '.md',
  '.ltx',
  '.dtx',
  '.ins',
]);

export type PendingUploadItem = {
  file: File;
  name: string;
  conflict: 'none' | 'duplicate';
  resolution?: 'suffix' | 'overwrite';
  unpackZip?: boolean;
};

interface UploadConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingUploads: PendingUploadItem[];
  onRemoveItem: (index: number) => void;
  onSetResolution: (index: number, resolution: 'suffix' | 'overwrite') => void;
  onToggleUnpackZip?: (index: number, unpack: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function UploadConflictDialog({
  open,
  onOpenChange,
  pendingUploads,
  onRemoveItem,
  onSetResolution,
  onToggleUnpackZip,
  onCancel,
  onConfirm,
}: UploadConflictDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Upload Files</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1 max-h-72 overflow-y-auto overflow-x-hidden py-1">
          {pendingUploads.map((item, i) => {
            const ext = '.' + (item.file.name.split('.').pop() ?? '').toLowerCase();
            const isZip = ext === '.zip';
            const isTex = TEX_EXTS.has(ext);
            const isImg = item.file.type?.startsWith('image/') ?? false;
            const hasPath = item.name.includes('/');
            const folderPath = hasPath
              ? item.name.substring(0, item.name.lastIndexOf('/'))
              : null;
            const Icon = isZip ? FolderArchive : isTex ? FileCode2 : isImg ? Image : Paperclip;
            const isDuplicate = item.conflict === 'duplicate';
            return (
              <div key={i} className="flex flex-col gap-1 px-1 py-1.5 rounded-sm">
                <div className="flex items-center gap-2">
                  <Icon
                    className={cn(
                      'size-3.5 shrink-0',
                      isDuplicate ? 'text-warning' : isZip ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    {folderPath && (
                      <div className="flex items-center gap-1 min-w-0">
                        <Folder className="size-3 text-warning shrink-0" />
                        <span className="text-xs text-muted-foreground truncate">
                          {folderPath}
                        </span>
                      </div>
                    )}
                    <span className="text-xs text-foreground truncate block">
                      {item.file.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(i)}
                    aria-label="Remove file"
                    className="text-muted-foreground hover:bg-muted rounded-sm p-0.5 transition-colors shrink-0 cursor-pointer"
                  >
                    <X className="size-3.5 shrink-0" />
                  </button>
                </div>
                {/* ZIP archive options */}
                {isZip && (
                  <div className="ml-5 mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-11 text-muted-foreground">Archive:</span>
                    <button
                      type="button"
                      onClick={() => onToggleUnpackZip?.(i, true)}
                      className={cn(
                        'h-5 px-2 rounded-sm text-11 font-medium border transition-colors cursor-pointer',
                        item.unpackZip !== false
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-foreground hover:bg-muted',
                      )}
                    >
                      Unpack into project
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleUnpackZip?.(i, false)}
                      className={cn(
                        'h-5 px-2 rounded-sm text-11 font-medium border transition-colors cursor-pointer',
                        item.unpackZip === false
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-foreground hover:bg-muted',
                      )}
                    >
                      Keep as .zip
                    </button>
                  </div>
                )}
                {/* Conflict resolution — only shown for duplicates */}
                {isDuplicate && (
                  <div className="ml-5 flex items-center gap-1.5">
                    <span className="text-xs text-warning flex items-center gap-1 mr-1">
                      <AlertTriangle className="size-2.5 shrink-0" />
                      Already exists
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant={item.resolution === 'overwrite' ? 'default' : 'outline'}
                      onClick={() => onSetResolution(i, 'overwrite')}
                      className="h-5 px-2 text-xs rounded-sm cursor-pointer"
                    >
                      Overwrite
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={item.resolution === 'suffix' ? 'default' : 'outline'}
                      onClick={() => onSetResolution(i, 'suffix')}
                      className="h-5 px-2 text-xs rounded-sm cursor-pointer"
                    >
                      Add suffix
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
          {pendingUploads.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No files selected.
            </p>
          )}
        </div>
        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="h-8 text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={
              pendingUploads.length === 0 ||
              pendingUploads.some(
                (p) => p.conflict === 'duplicate' && !p.resolution,
              )
            }
            className="h-8 text-xs font-medium cursor-pointer"
          >
            {pendingUploads.some(
              (p) => p.conflict === 'duplicate' && !p.resolution,
            )
              ? 'Resolve conflicts first'
              : `Upload ${
                  pendingUploads.length > 0
                    ? `${pendingUploads.length} file${
                        pendingUploads.length > 1 ? 's' : ''
                      }`
                    : ''
                }`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
