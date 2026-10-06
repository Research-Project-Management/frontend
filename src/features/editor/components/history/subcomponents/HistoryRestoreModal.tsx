'use client';

import React, { useState } from 'react';
import { RotateCcw, FileText, FolderSync, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

interface HistoryRestoreModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  activeFileName: string;
  activeVersionNumber: number;
  formattedRevisionDate: string;
  isRestoring: boolean;
  onConfirmRestoreFile: () => Promise<void> | void;
  onConfirmRestoreProject: () => Promise<void> | void;
}

export function HistoryRestoreModal({
  isOpen,
  onOpenChange,
  activeFileName,
  activeVersionNumber,
  formattedRevisionDate,
  isRestoring,
  onConfirmRestoreFile,
  onConfirmRestoreProject,
}: HistoryRestoreModalProps) {
  const [restoreScope, setRestoreScope] = useState<'file' | 'project'>('file');

  const handleConfirm = async () => {
    if (restoreScope === 'file') {
      await onConfirmRestoreFile();
    } else {
      await onConfirmRestoreProject();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] rounded-md font-sans border border-border bg-popover text-popover-foreground shadow-raised-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-13 font-semibold text-foreground">
            <RotateCcw className="size-4 text-primary" />
            <span>Restore version</span>
          </DialogTitle>
          <DialogDescription className="text-12 text-muted-foreground pt-1 leading-relaxed">
            Choose whether to restore only the currently selected file or all files across the entire project from{' '}
            <strong className="text-foreground">{formattedRevisionDate}</strong>.
          </DialogDescription>
        </DialogHeader>

        {/* Scope Choice Cards */}
        <div className="py-2 space-y-2">
          {/* Option A: Restore current file */}
          <button
            type="button"
            onClick={() => setRestoreScope('file')}
            className={cn(
              'w-full flex items-start gap-3 p-3 rounded-md border text-left transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
              restoreScope === 'file'
                ? 'border-primary bg-primary/5 text-foreground'
                : 'border-border bg-card hover:bg-muted/50 text-muted-foreground',
            )}
          >
            <div
              className={cn(
                'size-8 rounded-md flex items-center justify-center shrink-0 mt-0.5',
                restoreScope === 'file'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              <FileText className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-12 font-semibold text-foreground">
                Restore only this file
              </div>
              <div className="text-11 font-mono text-muted-foreground truncate mt-0.5">
                {activeFileName}
              </div>
              <div className="text-11 text-muted-foreground mt-1">
                Replaces current editor content of this file with its version from this revision. Other files remain unchanged.
              </div>
            </div>
          </button>

          {/* Option B: Restore entire project */}
          <button
            type="button"
            onClick={() => setRestoreScope('project')}
            className={cn(
              'w-full flex items-start gap-3 p-3 rounded-md border text-left transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
              restoreScope === 'project'
                ? 'border-primary bg-primary/5 text-foreground'
                : 'border-border bg-card hover:bg-muted/50 text-muted-foreground',
            )}
          >
            <div
              className={cn(
                'size-8 rounded-md flex items-center justify-center shrink-0 mt-0.5',
                restoreScope === 'project'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              <FolderSync className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-12 font-semibold text-foreground">
                Restore entire project
              </div>
              <div className="text-11 font-mono text-muted-foreground mt-0.5">
                Version {activeVersionNumber}
              </div>
              <div className="text-11 text-muted-foreground mt-1">
                Restores all project files to their state at this version. A new checkpoint is saved to preserve recent work.
              </div>
            </div>
          </button>
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isRestoring}
            onClick={() => onOpenChange(false)}
            className="rounded-md text-12 h-8"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={isRestoring}
            onClick={handleConfirm}
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-12 h-8 flex items-center gap-1.5"
          >
            {isRestoring ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Restoring…</span>
              </>
            ) : (
              <>
                <RotateCcw className="size-3.5" />
                <span>{restoreScope === 'file' ? 'Restore File' : 'Restore Project'}</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default HistoryRestoreModal;
