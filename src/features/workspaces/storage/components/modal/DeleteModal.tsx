import * as React from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui';
import { AlertTriangle } from 'lucide-react';

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
}

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
      <DialogContent className="max-w-[560px] p-0 overflow-hidden">
        <div className="p-6">
          <DialogHeader className="flex flex-row items-start gap-4 space-y-0">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
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

        <div className="px-6 py-4 bg-muted/30 border-t border-border/50">
          <DialogFooter className="flex w-full flex-row items-center justify-end gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              {cancelText}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? 'Deleting...' : confirmText}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DeleteModal;
