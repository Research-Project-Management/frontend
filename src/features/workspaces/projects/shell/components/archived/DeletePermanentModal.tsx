'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@/shared/components/ui';
import type { Project } from '../../types/project.types';

export type DeletePermanentModalProps = {
  project: Project | null;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
};

export function DeletePermanentModal({
  project,
  onClose,
  onConfirm,
  isDeleting = false,
}: DeletePermanentModalProps) {
  if (!project) return null;

  return (
    <Dialog open={Boolean(project)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-6 bg-card border border-border">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-base font-semibold text-foreground">
            Permanently delete project
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Are you sure you want to permanently delete{' '}
            <strong className="text-foreground">{project.name}</strong>? All
            associated tasks, cycles, notes, and storage files will be lost forever.
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex items-center justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
            className="text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting}
            className="text-xs font-semibold cursor-pointer"
          >
            {isDeleting ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DeletePermanentModal;
