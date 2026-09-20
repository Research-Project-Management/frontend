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
import type { WorkItemViewItem } from '../../types/view.types';

export interface DeleteProjectViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  view: WorkItemViewItem | null;
  loading?: boolean;
}

export const DeleteProjectViewModal: React.FC<DeleteProjectViewModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  view,
  loading = false,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-md p-6 gap-4 rounded-md border border-border bg-background shadow-lg">
        <DialogHeader className="text-left space-y-1.5">
          <DialogTitle className="text-base font-semibold text-foreground">
            Delete view
          </DialogTitle>
          <DialogDescription className="text-13 text-muted-foreground leading-relaxed">
            Are you sure you want to delete view{' '}
            <span className="font-semibold text-foreground break-all">
              &quot;{view?.name}&quot;
            </span>
            ? The work items in the view won&apos;t be deleted. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={loading}
            className="h-8 px-3 text-13 font-medium rounded-md text-foreground hover:bg-muted cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={loading}
            className="h-8 px-3 text-13 font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-none cursor-pointer"
          >
            {loading ? 'Deleting...' : 'Delete view'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteProjectViewModal;
