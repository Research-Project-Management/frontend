'use client';

import React from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";

export interface DeleteModalConfig {
  open: boolean;
  title?: React.ReactNode;
  description?: React.ReactNode;
  itemName?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  isDeleting?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: React.ReactNode;
  buttonVariant?: 'blue' | 'red' | 'primary' | 'destructive';
}

export interface DeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  itemName?: React.ReactNode;
  children?: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  isDeleting?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: React.ReactNode;
  buttonVariant?: 'blue' | 'red' | 'primary' | 'destructive';
}

export default function DeleteModal({
  open,
  onOpenChange,
  title = 'Move to trash',
  description = 'Are you sure you want to move this item to the trash? Items can be restored from the Trash at any time.',
  itemName,
  children,
  onConfirm,
  isDeleting = false,
  confirmLabel = 'Move to trash',
  cancelLabel = 'Cancel',
  icon,
  buttonVariant = 'red',
}: DeleteModalProps) {
  const handleConfirm = async () => {
    await onConfirm();
  };

  const isRed = buttonVariant === 'red' || buttonVariant === 'destructive';

  return (
    <Dialog open={open} onOpenChange={isDeleting ? undefined : onOpenChange}>
      <DialogContent
        className="sm:max-w-[520px] p-6 rounded-lg border border-border bg-background shadow-raised-200"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex flex-row items-start gap-3.5 space-y-0 text-left">
          <div
            className={cn(
              'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full',
              isRed
                ? 'bg-destructive/10 text-destructive'
                : 'bg-primary/10 text-primary'
            )}
          >
            {icon || <Trash2 className="size-4 shrink-0" strokeWidth={1.5} />}
          </div>

          <div className="min-w-0 flex-1">
            <DialogTitle className="text-14 font-medium text-foreground">
              {title}
            </DialogTitle>
            {description && (
              <DialogDescription className="mt-1 text-12 text-muted-foreground leading-normal">
                {description}
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
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="h-8 px-3 text-12 font-medium cursor-pointer rounded-md hover:bg-muted shadow-2xs"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className={cn(
              'h-8 px-3 text-12 font-medium cursor-pointer shadow-none rounded-md',
              isRed
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'bg-primary text-primary-foreground hover:bg-primary-hover'
            )}
          >
            {isDeleting ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin shrink-0" />
                <span>Moving...</span>
              </span>
            ) : (
              <span>{confirmLabel}</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
