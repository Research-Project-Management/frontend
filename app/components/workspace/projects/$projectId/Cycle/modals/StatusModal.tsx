import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { PlayCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "~/lib/utils";

export type StatusModalType = "start" | "complete";

interface StatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  type: StatusModalType;
  title?: string;
  isSubmitting?: boolean;
}

export const StatusModal = ({
  open,
  onOpenChange,
  onConfirm,
  type,
  title = "this cycle",
  isSubmitting = false,
}: StatusModalProps) => {
  const config = {
    start: {
      dialogTitle: "Start Cycle?",
      description: (
        <>
          Are you sure you want to start <span className="font-semibold text-foreground">{title}</span>? This will move the cycle to the active section.
        </>
      ),
      confirmText: "Confirm",
      confirmIcon: PlayCircle,
      confirmClass: "bg-black hover:bg-black/90 text-white",
      icon: PlayCircle,
      iconClass: "bg-zinc-100 text-zinc-900",
    },
    complete: {
      dialogTitle: "End Cycle?",
      description: (
        <>
          Are you sure you want to end <span className="font-semibold text-foreground">{title}</span>? This will mark the cycle as complete.
        </>
      ),
      confirmText: "Confirm",
      confirmIcon: CheckCircle2,
      confirmClass: "bg-black hover:bg-black/90 text-white",
      icon: CheckCircle2,
      iconClass: "bg-zinc-100 text-zinc-900",
    },
  }[type];

  const Icon = config.icon;
  const ConfirmIcon = config.confirmIcon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[440px] p-0 overflow-hidden z-[101] rounded-sm border-0 shadow-2xl bg-white"
      >
        <div className="p-6">
          <DialogHeader className="flex flex-row items-start gap-4 space-y-0 text-left">
            <div className={cn("mt-0.5 flex h-10 w-10 items-center justify-center rounded-full shrink-0", config.iconClass)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold">{config.dialogTitle}</DialogTitle>
              <DialogDescription className="mt-1.5 text-[13.5px] text-zinc-500 leading-relaxed">
                {config.description}
              </DialogDescription>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 py-4 bg-zinc-50/50 border-t border-zinc-100">
          <DialogFooter className="flex w-full flex-row items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 text-xs font-medium text-zinc-500 hover:bg-zinc-100"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={isSubmitting}
              className={cn("h-9 px-5 text-[13px] font-semibold border-none shadow-none rounded-sm transition-all active:scale-95", config.confirmClass)}
            >
              {isSubmitting ? (
                "Processing..."
              ) : (
                config.confirmText
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
