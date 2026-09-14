import * as React from 'react';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Trash2 } from 'lucide-react';

export interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
}

/**
 * Storage-scoped DeleteModal.
 * Independently maintained within features/workspaces/storage for file/folder operations
 * to prevent tight cross-feature coupling.
 */
export function DeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  loading = false,
}: DeleteModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[520px] p-0 overflow-hidden border border-border shadow-raised-200">
        <div className="p-6">
          <DialogHeader className="flex flex-row items-start gap-4 space-y-0">
            <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Trash2 className="size-5 shrink-0" />
            </div>

            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                {title}
              </DialogTitle>
              {description && (
                <DialogDescription className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  {description}
                </DialogDescription>
              )}
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 py-4 bg-muted/50 border-t border-border">
          <DialogFooter className="flex w-full flex-row items-center justify-end gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="cursor-pointer shadow-2xs"
            >
              {cancelText}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirm}
              disabled={loading}
              className="cursor-pointer shadow-2xs"
            >
              {confirmText}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DeleteModal;
