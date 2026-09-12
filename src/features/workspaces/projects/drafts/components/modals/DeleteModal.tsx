'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import type { WorkItemDraft } from '../../types/draft.types';

export interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  draft: WorkItemDraft | null;
  onConfirm: (draftId: string) => Promise<void>;
  isDeleting: boolean;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({
  isOpen,
  onClose,
  draft,
  onConfirm,
  isDeleting,
}) => {
  const handleDelete = async () => {
    if (!draft) return;
    await onConfirm(draft.id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm p-5 bg-background border border-border rounded-lg shadow-raised-200">
        <DialogHeader className="text-left space-y-1.5">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="size-8 rounded-md bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <AlertTriangle className="size-4 shrink-0" />
            </div>
            <DialogTitle className="text-14 font-semibold tracking-tight text-foreground">
              Delete draft
            </DialogTitle>
          </div>
          <DialogDescription className="text-12 text-muted-foreground leading-relaxed">
            Are you sure you want to delete this draft? This action cannot be undone and your draft work
            item will be permanently removed.
          </DialogDescription>
        </DialogHeader>

        {draft && (
          <div className="py-2">
            <div className="p-2.5 rounded-md bg-muted border border-border">
              <span className="text-11 text-muted-foreground font-medium block">Draft title:</span>
              <p className="text-13 font-medium text-foreground mt-0.5 truncate">
                {draft.title || 'Untitled Draft'}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
            className="h-8 px-3 rounded-md text-12 font-medium border-border bg-background hover:bg-muted text-foreground cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="h-8 px-3.5 rounded-md text-12 font-medium shadow-none transition-colors cursor-pointer"
          >
            {isDeleting ? 'Deleting...' : 'Delete draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteModal;
