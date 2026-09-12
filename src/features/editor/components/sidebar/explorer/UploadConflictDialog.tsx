'use client';

import React from 'react';
import {
  AlertTriangle,
  FileCode2,
  Folder,
  Image,
  Paperclip,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
};

interface UploadConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingUploads: PendingUploadItem[];
  onRemoveItem: (index: number) => void;
  onSetResolution: (index: number, resolution: 'suffix' | 'overwrite') => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function UploadConflictDialog({
  open,
  onOpenChange,
  pendingUploads,
  onRemoveItem,
  onSetResolution,
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
            const isTex = TEX_EXTS.has(ext);
            const isImg = item.file.type?.startsWith('image/') ?? false;
            const hasPath = item.name.includes('/');
            const folderPath = hasPath
              ? item.name.substring(0, item.name.lastIndexOf('/'))
              : null;
            const Icon = isTex ? FileCode2 : isImg ? Image : Paperclip;
            const isDuplicate = item.conflict === 'duplicate';
            return (
              <div key={i} className="flex flex-col gap-1 px-1 py-1.5 rounded">
                <div className="flex items-center gap-2">
                  <Icon
                    className={cn(
                      'size-3.5 shrink-0',
                      isDuplicate ? 'text-warning' : 'text-muted-foreground',
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
                    onClick={() => onRemoveItem(i)}
                    className="text-muted-foreground hover:bg-muted transition-colors shrink-0"
                  >
                    <X className="size-3.5 shrink-0" />
                  </button>
                </div>
                {/* Conflict resolution — only shown for duplicates */}
                {isDuplicate && (
                  <div className="ml-5 flex items-center gap-1.5">
                    <span className="text-xs text-warning flex items-center gap-1 mr-1">
                      <AlertTriangle className="size-2.5 shrink-0" />
                      Already exists
                    </span>
                    <button
                      onClick={() => onSetResolution(i, 'overwrite')}
                      className={cn(
                        'h-5 px-2 rounded text-xs border transition-colors',
                        item.resolution === 'overwrite'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-foreground hover:border-primary hover:bg-muted',
                      )}
                    >
                      Overwrite
                    </button>
                    <button
                      onClick={() => onSetResolution(i, 'suffix')}
                      className={cn(
                        'h-5 px-2 rounded text-xs border transition-colors',
                        item.resolution === 'suffix'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-foreground hover:border-primary hover:bg-muted',
                      )}
                    >
                      Add suffix
                    </button>
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
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            className="h-8 rounded-md px-3 text-xs text-foreground transition-colors hover:bg-muted cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={
              pendingUploads.length === 0 ||
              pendingUploads.some(
                (p) => p.conflict === 'duplicate' && !p.resolution,
              )
            }
            className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
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
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
