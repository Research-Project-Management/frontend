import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
}

export default function DeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Delete",
  cancelText = "Dismiss",
  loading = false,
}: DeleteModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        {/* Overlay: bg-black/20 + blur 0.5 */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/20 backdrop-blur-[0.5px]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            "data-[state=open]:duration-200 data-[state=closed]:duration-150"
          )}
        />

        {/* Content */}
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-xl",
            "-translate-x-1/2 -translate-y-1/2",
            "rounded-lg border bg-background p-6 shadow-lg",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-2",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-bottom-2",
            "data-[state=open]:duration-200 data-[state=closed]:duration-150",
            "focus:outline-none"
          )}
        >
          {/* Close X */}
          <DialogPrimitive.Close
            className={cn(
              "absolute text-gray-500 right-4 top-4 rounded-sm opacity-70 transition-opacity",
              "focus:outline-none",
              "disabled:pointer-events-none"
            )}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>

          <div className="flex gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
              <AlertCircle className="h-5 w-5 text-blue-600" />
            </div>

            <div className="flex w-full flex-col gap-4">
              <DialogHeader>
                <DialogTitle className="text-xl">{title}</DialogTitle>
                <DialogDescription className="mt-2 text-base">
                  {description}
                </DialogDescription>
              </DialogHeader>

              <DialogFooter className="mt-2 gap-2.5">
                <Button variant="outline" onClick={onClose}>
                  {cancelText}
                </Button>

                <Button
                  variant="destructive"
                  onClick={() => {
                    onConfirm();
                  }}
                  disabled={loading}
                >
                  {loading ? "Deleting..." : confirmText}
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  );
}
