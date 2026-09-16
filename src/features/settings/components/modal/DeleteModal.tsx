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
import { AlertTriangle } from 'lucide-react';

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
 * Settings-scoped DeleteModal.
 * Independently maintained within features/settings to prevent tight cross-feature coupling.
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
      <DialogContent className="max-w-md p-5 overflow-hidden border border-border bg-card">
        <DialogHeader className="flex flex-row items-start gap-3.5 space-y-0 text-left">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-4 shrink-0" strokeWidth={1.5} />
          </div>

          <div className="min-w-0 flex-1">
            <DialogTitle className="text-14 font-semibold text-foreground">
              {title}
            </DialogTitle>
            {description && (
              <DialogDescription className="mt-1.5 text-12 text-muted-foreground leading-normal">
                {description}
              </DialogDescription>
            )}
          </div>
        </DialogHeader>

        <DialogFooter className="flex items-center justify-end gap-2 pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={loading}
            className="h-8 text-12 cursor-pointer shadow-2xs"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={loading}
            className="h-8 text-12 cursor-pointer shadow-2xs"
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DeleteModal;
