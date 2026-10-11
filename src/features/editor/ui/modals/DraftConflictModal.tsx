/**
 * DraftConflictModal.tsx
 *
 * Conflict Resolution Modal for Offline Draft vs Server Version (Block 7: Modals).
 * Location: `features/editor/ui/modals/DraftConflictModal.tsx`
 *
 * Informs the user when an offline draft exists that differs from the remote server document,
 * preventing accidental overwrite and ensuring zero data loss (Overleaf Parity).
 */

'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { AlertCircle, FileText, CloudDownload, Laptop, Check } from 'lucide-react';
import { sessionCoordinator } from '@/features/editor/coordinators/session.coordinator';
import { toast } from 'sonner';

export interface DraftConflictModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: string;
  fileName: string;
  serverContent: string;
  draftContent: string;
  draftTimestamp?: number;
  onResolved: (restoredDraft: boolean) => void;
}

export function DraftConflictModal({
  open,
  onOpenChange,
  fileId,
  fileName,
  serverContent,
  draftContent,
  draftTimestamp,
  onResolved,
}: DraftConflictModalProps) {
  const [selectedVersion, setSelectedVersion] = useState<'draft' | 'server'>('draft');

  const draftDateStr = draftTimestamp
    ? new Date(draftTimestamp).toLocaleString()
    : 'Recently saved offline';

  const handleApply = async () => {
    if (selectedVersion === 'draft') {
      sessionCoordinator.restoreDraft(fileId, draftContent);
      toast.success(`Restored offline draft for ${fileName}`, { id: `draft-resolve-${fileId}` });
      onResolved(true);
    } else {
      await sessionCoordinator.discardDraft(fileId);
      toast.info(`Kept remote server version for ${fileName}`, { id: `draft-resolve-${fileId}` });
      onResolved(false);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl text-xs sm:text-sm">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 font-semibold">
            <AlertCircle className="size-5" />
            <DialogTitle>Offline Changes Detected</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            An offline draft exists in your browser for <strong>{fileName}</strong> that differs from the server version.
            Please choose which version to keep.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-3">
          {/* Option 1: Offline Draft */}
          <div
            onClick={() => setSelectedVersion('draft')}
            className={`border rounded-lg p-3 cursor-pointer transition-all flex flex-col justify-between ${
              selectedVersion === 'draft'
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-border hover:bg-muted/50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between font-medium text-foreground mb-1">
                <span className="flex items-center gap-1.5">
                  <Laptop className="size-4 text-primary" /> Local Offline Draft
                </span>
                {selectedVersion === 'draft' && <Check className="size-4 text-primary" />}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Saved: {draftDateStr}
              </p>
              <div className="mt-2 text-[11px] font-mono bg-muted/60 p-2 rounded max-h-28 overflow-y-auto whitespace-pre-wrap">
                {draftContent.slice(0, 300)}...
              </div>
            </div>
            <div className="text-[11px] text-primary font-medium mt-2">
              (Recommended if you edited offline)
            </div>
          </div>

          {/* Option 2: Server Version */}
          <div
            onClick={() => setSelectedVersion('server')}
            className={`border rounded-lg p-3 cursor-pointer transition-all flex flex-col justify-between ${
              selectedVersion === 'server'
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-border hover:bg-muted/50'
            }`}
          >
            <div>
              <div className="flex items-center justify-between font-medium text-foreground mb-1">
                <span className="flex items-center gap-1.5">
                  <CloudDownload className="size-4 text-muted-foreground" /> Server Version
                </span>
                {selectedVersion === 'server' && <Check className="size-4 text-primary" />}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Last synced from cloud
              </p>
              <div className="mt-2 text-[11px] font-mono bg-muted/60 p-2 rounded max-h-28 overflow-y-auto whitespace-pre-wrap">
                {serverContent.slice(0, 300)}...
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground mt-2">
              Discards local browser draft
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleApply}
          >
            {selectedVersion === 'draft' ? 'Restore Offline Draft' : 'Keep Server Version'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DraftConflictModal;
