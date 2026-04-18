import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

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
  description = "Are you sure you want to delete this sticky?",
  confirmText = "Delete",
  cancelText = "Cancel",
  isConfirmLoading = false,
  onConfirm,
  onCancel,
}: DeleteModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>

      <DialogContent className="max-w-[560px] p-0 overflow-hidden">
        <div className="p-6">
          <DialogHeader className="flex flex-row items-start gap-4 space-y-0">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
              <WarningIcon className="h-5 w-5 text-red-600" />
            </div>

            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold">
                {title}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                {description}
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <div className="border-t px-6 py-4">
          <DialogFooter className="flex w-full flex-row items-center justify-end gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isConfirmLoading}
            >
              {cancelText}
            </Button>

            <Button
              type="button"
              onClick={onConfirm}
              disabled={isConfirmLoading}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isConfirmLoading ? "Deleting..." : confirmText}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WarningIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
