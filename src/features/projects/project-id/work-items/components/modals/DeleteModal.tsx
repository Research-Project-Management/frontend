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
} from "@/shared/components/ui";
import type { Item } from '../../types/work-item.types';

export interface DeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item | null;
  onConfirm: () => void | Promise<void>;
  isDeleting?: boolean;
}

export function DeleteModal({
  open,
  onOpenChange,
  item,
  onConfirm,
  isDeleting = false,
}: DeleteModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md p-6 gap-4 rounded-lg border border-border bg-background shadow-lg">
        <DialogHeader className="text-left space-y-1.5">
          <DialogTitle className="text-base font-semibold text-foreground">
            Delete work item
          </DialogTitle>
          <DialogDescription className="text-13 text-muted-foreground">
            Are you sure you want to delete &quot;{item?.title || 'this work item'}&quot;? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="h-8 px-3 text-13 font-medium rounded-md cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting}
            className="h-8 px-3 text-13 font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-none cursor-pointer"
          >
            {isDeleting ? 'Deleting...' : 'Delete work item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DeleteModal;
