import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";

interface DeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  isDeleting?: boolean;
}

export function DeleteModal({
  open,
  onOpenChange,
  onConfirm,
  title = "this quicklink",
  description = "Are you sure you want to remove this quicklink? This action cannot be undone.",
  isDeleting = false,
}: DeleteModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="max-w-[440px] p-0 overflow-hidden rounded-md shadow-raised-200 border border-border bg-popover"
      >
        <div className="p-6">
          <DialogHeader className="flex flex-row items-start gap-4 space-y-0">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 shrink-0">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-16 font-semibold text-foreground">Remove Quicklink?</DialogTitle>
              <DialogDescription className="mt-1 text-13 text-muted-foreground leading-relaxed">
                {description}
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted">
          <DialogFooter className="flex w-full flex-row items-center justify-end gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="relative h-8 px-4 text-13 font-medium shadow-none cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring touch-manipulation sm:after:hidden after:absolute after:-inset-1.5 after:content-['']"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
              disabled={isDeleting}
              className="relative h-8 px-4 text-13 font-medium shadow-none transition-colors cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring touch-manipulation sm:after:hidden after:absolute after:-inset-1.5 after:content-['']"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-3.5 mr-1.5 animate-spin motion-reduce:animate-none shrink-0" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5 mr-1.5 shrink-0" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
