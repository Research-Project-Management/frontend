import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import { Trash2, AlertTriangle } from "lucide-react";

interface DeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  isDeleting?: boolean;
}

export const DeleteModal = ({
  open,
  onOpenChange,
  onConfirm,
  title = "this cycle",
  isDeleting = false,
}: DeleteModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="max-w-[440px] p-0 overflow-hidden z-[101] rounded-sm border-0 shadow-2xl bg-popover"
      >
        <div className="p-6">
          <DialogHeader className="flex flex-row items-start gap-4 space-y-0 text-left">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 shrink-0">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold text-foreground">Delete Cycle?</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Are you sure you want to delete <span className="font-semibold text-foreground break-all">{title}</span>? This action cannot be undone.
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 py-4 bg-muted/30 border-t border-border">
          <DialogFooter className="flex w-full flex-row items-center justify-end gap-2 sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 text-xs font-medium text-foreground hover:bg-muted cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirm}
              disabled={isDeleting}
              className="h-9 px-6 text-[13px] font-bold bg-destructive hover:bg-destructive/90 text-destructive-foreground border-none shadow-none rounded-sm transition-all active:scale-95 cursor-pointer gap-1.5"
            >
              {isDeleting ? "Deleting..." : (
                <>
                  <Trash2 className="size-3.5" />
                  <span>Delete</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
