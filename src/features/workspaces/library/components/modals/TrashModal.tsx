'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

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
        className="max-w-[520px] p-6 !rounded-md"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex flex-row items-start gap-4 space-y-0 text-left">
          <div
            className={cn(
              'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              isRed
                ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
            )}
          >
            <Trash2 className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Move to trash
            </DialogTitle>
            {description && (
              <DialogDescription className="mt-1 text-sm text-muted-foreground leading-relaxed">
                {description}
              </DialogDescription>
            )}

            {/* Single item title preview */}
            {!isMultiple && !isCollection && target.title && (
              <div className="mt-3 px-3 py-2 rounded-md bg-muted/40 border border-border/50 text-xs text-foreground truncate font-normal leading-relaxed">
                {target.title}
              </div>
            )}
          </div>
        </DialogHeader>

        <DialogFooter className="mt-6 flex w-full flex-row items-center justify-end gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="cursor-pointer !rounded-md"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={cn(
              'cursor-pointer shadow-none !rounded-md',
              isRed
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            )}
          >
            {loading ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="size-3.5 animate-spin" />
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

