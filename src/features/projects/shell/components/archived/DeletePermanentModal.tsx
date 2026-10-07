'use client';

import React from 'react';
import { Button } from "@/shared/components/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/shared/components/ui";
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
      <DialogContent className="sm:max-w-md p-6 bg-card border border-border shadow-raised-200">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-16 font-semibold text-foreground">
            Permanently delete project
          </DialogTitle>
          <DialogDescription className="text-13 text-muted-foreground leading-relaxed">
            Are you sure you want to permanently delete{' '}
            <strong className="text-foreground font-semibold">{project.name}</strong>? All
            associated work items, cycles, notes, and storage files will be lost forever.
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
            className="h-8 px-3 text-12 font-medium cursor-pointer relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting}
            className="h-8 px-3 text-12 font-medium cursor-pointer relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {isDeleting ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DeletePermanentModal;
