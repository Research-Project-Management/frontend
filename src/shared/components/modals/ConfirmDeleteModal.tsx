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

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
}

export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  loading = false,
}: ConfirmDeleteModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[560px] p-0 overflow-hidden">
        <div className="p-6">
          <DialogHeader className="flex flex-row items-start gap-4 space-y-0">
            <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="size-5 text-destructive shrink-0" />
            </div>

            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold text-foreground">
                {title}
              </DialogTitle>
              {description && (
                <DialogDescription className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {description}
                </DialogDescription>
              )}
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 py-4 bg-muted border-t border-border">
          <DialogFooter className="flex w-full flex-row items-center justify-end gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="cursor-pointer"
            >
              {cancelText}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirm}
              disabled={loading}
              className="cursor-pointer"
            >
              {confirmText}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ConfirmDeleteModal;
