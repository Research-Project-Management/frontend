'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import { Trash2, Loader2 } from 'lucide-react';
import { cn } from "@/shared/lib/utils";

export interface MoveToTrashTarget {
  id?: string;
  ids?: string[];
  title?: string;
  type?: 'paper' | 'papers' | 'collection';
  count?: number;
  items?: Array<{ id: string; title: string }>;
}

export interface TrashModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: MoveToTrashTarget | null;
  onConfirm: () => Promise<void> | void;
  isPending?: boolean;
  buttonVariant?: 'blue' | 'red' | 'primary' | 'destructive';
}

export type MoveToTrashModalProps = TrashModalProps;

export function TrashModal({
  open,
  onOpenChange,
  target,
  onConfirm,
  isPending = false,
  buttonVariant = 'red',
}: TrashModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!target) return null;

  const isMultiple =
    target.type === 'papers' ||
    (target.ids && target.ids.length > 1) ||
    (target.count !== undefined && target.count > 1);
  const isCollection = target.type === 'collection';
  const count = target.count || target.ids?.length || 1;

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const loading = isPending || isSubmitting;
  const isRed = buttonVariant === 'red' || buttonVariant === 'destructive';

  const description = isCollection
    ? target.title
      ? `Are you sure you want to move collection "${target.title}" to the trash? Items can be restored at any time.`
      : 'Are you sure you want to move this collection to the trash? Items can be restored at any time.'
    : isMultiple
    ? `Are you sure you want to move ${count} items to the trash? You can restore them at any time.`
    : 'Are you sure you want to move this item to the trash? You can restore it at any time.';

  return (
    <Dialog open={open} onOpenChange={loading ? undefined : onOpenChange}>
      <DialogContent
        className="max-w-[480px] p-5 rounded-md border border-border bg-background shadow-none"
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
            <Trash2 className="size-4 shrink-0" strokeWidth={1.5} />
          </div>

          <div className="min-w-0 flex-1">
            <DialogTitle className="text-14 font-medium text-foreground">
              Move to trash
            </DialogTitle>
            {description && (
              <DialogDescription className="mt-1 text-12 text-muted-foreground leading-normal">
                {description}
              </DialogDescription>
            )}

            {/* Single item title preview */}
            {!isMultiple && !isCollection && target.title && (
              <div className="mt-2.5 px-2.5 py-1.5 rounded-md bg-muted border border-border text-12 text-foreground truncate font-normal leading-normal">
                {target.title}
              </div>
            )}
          </div>
        </DialogHeader>

        <DialogFooter className="mt-5 flex w-full flex-row items-center justify-end gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="h-8 px-3 text-12 font-medium cursor-pointer rounded-md hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={cn(
              'h-8 px-3 text-12 font-medium cursor-pointer shadow-none rounded-md',
              isRed
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'bg-primary text-primary-foreground hover:bg-primary-hover'
            )}
          >
            {loading ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin shrink-0" />
                <span>Moving...</span>
              </span>
            ) : (
              <span>Move to trash</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TrashModal;
export { TrashModal as MoveToTrashModal };

