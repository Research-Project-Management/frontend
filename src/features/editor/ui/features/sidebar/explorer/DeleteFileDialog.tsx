'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/shared/components/ui/dialog';
import { displayName } from './TexFileRow';

export interface DeleteFileDialogProps {
  fileToDelete: { id: string; title: string } | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteFileDialog({
  fileToDelete,
  isPending,
  onClose,
  onConfirm,
}: DeleteFileDialogProps) {
  if (!fileToDelete) return null;

  return (
    <Dialog open={!!fileToDelete} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[400px] rounded-md p-5 gap-4">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-sm font-semibold tracking-tight text-foreground">
            Delete file
          </DialogTitle>
          <DialogDescription className="text-xs text-foreground leading-relaxed pt-1">
            Are you sure you want to delete <span className="font-semibold text-foreground font-mono">{displayName(fileToDelete.title)}</span>? This file will be moved to Trash and can be restored at any time.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isPending}
            className="h-8 text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={isPending}
            className="h-8 text-xs cursor-pointer"
          >
            {isPending ? (
              <>
                <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none mr-1.5" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
