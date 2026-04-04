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
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  isLoading?: boolean;
}

export default function DeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Delete section",
  message = "Are you sure you want to delete this section? This action cannot be undone.",
  confirmLabel = "Delete",
  isLoading = false,
}: DeleteModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogOverlay
        className="absolute inset-0 z-50
          bg-black/15 backdrop-blur-[0.5px]
          data-[state=open]:animate-in data-[state=open]:fade-in-0
          data-[state=closed]:animate-out data-[state=closed]:fade-out-0
          data-[state=open]:duration-200 data-[state=closed]:duration-150
        "
      />
      <DialogContent
        className="
          max-w-[560px] p-0 overflow-hidden z-[51]
          data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95
          data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
          data-[state=open]:duration-200 data-[state=closed]:duration-200
        "
      >
        <div className="p-6">
          <DialogHeader className="flex flex-row items-start gap-4 space-y-0">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 shrink-0">
              <WarningIcon className="h-5 w-5 text-red-600" />
            </div>

            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold">
                {title}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground leading-relaxed">
                {message}
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 py-4 bg-gray-50/30">
          <DialogFooter className="flex w-full flex-row items-center justify-end gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="h-9 px-4 text-xs font-medium"
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={onConfirm}
              disabled={isLoading}
              className="h-9 px-4 text-xs font-medium bg-red-600 hover:bg-red-700 text-white border-none shadow-sm"
            >
              {isLoading ? "Deleting..." : confirmLabel}
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
