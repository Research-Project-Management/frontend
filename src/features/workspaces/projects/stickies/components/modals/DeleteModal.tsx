'use client';

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { AlertTriangle } from "lucide-react";

export interface DeleteModalProps {
  open: boolean;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  isConfirmLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteModal({
  open,
  title = "Delete sticky",
  description = "Are you sure you want to delete this sticky? This action cannot be undone.",
  confirmText = "Delete",
  cancelText = "Cancel",
  isConfirmLoading = false,
  onConfirm,
  onCancel,
}: DeleteModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="max-w-[480px] p-6 bg-popover border border-border shadow-2xl rounded-lg"
      >
        <DialogHeader className="flex flex-row items-start gap-4 space-y-0">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>

          <div className="min-w-0 flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              {title}
            </DialogTitle>
            <DialogDescription className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
              {description}
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogFooter className="mt-6 flex w-full flex-row items-center justify-end gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isConfirmLoading}
            className="cursor-pointer text-foreground hover:bg-muted h-9 px-4 text-xs font-medium"
          >
            {cancelText}
          </Button>

          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isConfirmLoading}
            className="cursor-pointer h-9 px-4 text-xs font-medium"
          >
            {isConfirmLoading ? "Deleting..." : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
