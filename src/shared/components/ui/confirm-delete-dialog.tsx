'use client';

import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

export interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  itemName?: React.ReactNode;
  children?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  confirmLabel?: string;
  loadingLabel?: string;
  cancelLabel?: string;
  icon?: React.ReactNode;
  variant?: 'destructive' | 'primary';
  showCloseButton?: boolean;
}

/**
 * Canonical shared destructive/confirmation dialog for all frontend features.
 * Unmounts cleanly when closed and blocks dismissal while confirming.
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  itemName,
  children,
  onConfirm,
  isLoading = false,
  confirmLabel = 'Delete',
  loadingLabel = 'Deleting...',
  cancelLabel = 'Cancel',
  icon,
  variant = 'destructive',
  showCloseButton = true,
}: ConfirmDeleteDialogProps) {
  if (!open) return null;

  const isDestructive = variant === 'destructive';

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isLoading) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={showCloseButton}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="sm:max-w-[460px] p-6 rounded-lg border border-border bg-background shadow-raised-200"
      >
        <DialogHeader className="flex flex-row items-start gap-3.5 space-y-0 text-left">
          <div
            className={cn(
              'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full',
              isDestructive
                ? 'bg-destructive/10 text-destructive'
                : 'bg-primary/10 text-primary',
            )}
          >
            {icon || <AlertTriangle className="size-4 shrink-0" strokeWidth={1.75} />}
          </div>

          <div className="min-w-0 flex-1">
            <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
              {title}
            </DialogTitle>
            {description ? (
              <DialogDescription className="mt-1.5 text-12 text-muted-foreground leading-relaxed">
                {description}
              </DialogDescription>
            ) : (
              <DialogDescription className="sr-only">
                Confirm action dialog
              </DialogDescription>
            )}

            {children}

            {itemName && !children && (
              <div className="mt-2.5 px-2.5 py-1.5 rounded-md bg-muted border border-border text-12 text-foreground truncate font-normal leading-normal">
                {itemName}
              </div>
            )}
          </div>
        </DialogHeader>

        <DialogFooter className="mt-5 flex w-full flex-row items-center justify-end gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="h-8 px-3 text-12 font-medium cursor-pointer rounded-md hover:bg-muted"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={isDestructive ? 'destructive' : 'default'}
            size="sm"
            onClick={handleConfirm}
            disabled={isLoading}
            className="h-8 px-3.5 text-12 font-medium cursor-pointer rounded-md inline-flex items-center gap-1.5"
          >
            {isLoading && (
              <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none shrink-0" />
            )}
            <span>{isLoading ? loadingLabel : confirmLabel}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConfirmDeleteDialog;
