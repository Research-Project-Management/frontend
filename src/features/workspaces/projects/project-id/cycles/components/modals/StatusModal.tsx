'use client'
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import { PlayCircle, CheckCircle2, ArrowRight, CornerDownLeft, CircleSlash } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export type StatusModalType = "start" | "complete";

export interface StatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload?: { action: 'transfer' | 'backlog' | 'leave'; targetCycleId?: string }) => void;
  type: StatusModalType;
  title?: string;
  isSubmitting?: boolean;
  availableCycles?: Array<{ _id?: string; id?: string; name: string }>;
}

export const StatusModal = ({
  open,
  onOpenChange,
  onConfirm,
  type,
  title = "this cycle",
  isSubmitting = false,
  availableCycles = [],
}: StatusModalProps) => {
  const [incompleteAction, setIncompleteAction] = useState<'transfer' | 'backlog' | 'leave'>('backlog');
  const [targetCycleId, setTargetCycleId] = useState<string>(
    availableCycles[0]?._id || availableCycles[0]?.id || ''
  );

  const handleConfirm = () => {
    if (type === 'complete') {
      onConfirm({
        action: incompleteAction,
        targetCycleId: incompleteAction === 'transfer' ? targetCycleId : undefined,
      });
    } else {
      onConfirm();
    }
  };

  const isComplete = type === 'complete';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="max-w-[460px] p-0 overflow-hidden z-[101] rounded-sm border-0 shadow-2xl bg-popover"
      >
        <div className="p-6">
          <DialogHeader className="space-y-1 text-left">
            <div className="min-w-0">
              <DialogTitle className="text-base font-semibold text-foreground">
                {isComplete ? "Complete Cycle?" : "Start Cycle?"}
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-[13.5px] text-muted-foreground leading-relaxed">
                {isComplete ? (
                  <>
                    Are you sure you want to end <span className="font-semibold text-foreground">{title}</span>? Choose how to handle any incomplete tasks.
                  </>
                ) : (
                  <>
                    Are you sure you want to start <span className="font-semibold text-foreground">{title}</span>? This will move the cycle to the active section.
                  </>
                )}
              </DialogDescription>
            </div>
          </DialogHeader>

          {isComplete && (
            <div className="mt-5 space-y-3">
              <label className="text-xs font-semibold text-foreground block">
                Incomplete Tasks Action
              </label>

              <div className="space-y-2">
                <label className={cn(
                  "flex items-start gap-3 p-2.5 rounded-sm border cursor-pointer transition-all",
                  incompleteAction === 'backlog' ? "border-primary bg-primary/5" : "border-border/80 hover:bg-muted/50"
                )}>
                  <input
                    type="radio"
                    name="incompleteAction"
                    value="backlog"
                    checked={incompleteAction === 'backlog'}
                    onChange={() => setIncompleteAction('backlog')}
                    className="mt-0.5"
                  />
                  <div className="text-left">
                    <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <CornerDownLeft className="size-3.5" /> Move to Project Backlog
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Tasks will be unassigned from this cycle and returned to the general backlog.
                    </p>
                  </div>
                </label>

                {availableCycles.length > 0 && (
                  <label className={cn(
                    "flex items-start gap-3 p-2.5 rounded-sm border cursor-pointer transition-all",
                    incompleteAction === 'transfer' ? "border-primary bg-primary/5" : "border-border/80 hover:bg-muted/50"
                  )}>
                    <input
                      type="radio"
                      name="incompleteAction"
                      value="transfer"
                      checked={incompleteAction === 'transfer'}
                      onChange={() => setIncompleteAction('transfer')}
                      className="mt-0.5"
                    />
                    <div className="text-left flex-1">
                      <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <ArrowRight className="size-3.5" /> Transfer to Next Cycle
                      </span>
                      <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">
                        Move all unfinished tasks into another planned or upcoming cycle.
                      </p>
                      {incompleteAction === 'transfer' && (
                        <select
                          value={targetCycleId}
                          onChange={(e) => setTargetCycleId(e.target.value)}
                          className="w-full h-8 px-2 text-xs border border-border bg-background rounded-sm text-foreground focus:outline-none"
                        >
                          {availableCycles.map((c) => {
                            const cId = c._id || c.id || '';
                            return (
                              <option key={cId} value={cId}>
                                {c.name}
                              </option>
                            );
                          })}
                        </select>
                      )}
                    </div>
                  </label>
                )}

                <label className={cn(
                  "flex items-start gap-3 p-2.5 rounded-sm border cursor-pointer transition-all",
                  incompleteAction === 'leave' ? "border-primary bg-primary/5" : "border-border/80 hover:bg-muted/50"
                )}>
                  <input
                    type="radio"
                    name="incompleteAction"
                    value="leave"
                    checked={incompleteAction === 'leave'}
                    onChange={() => setIncompleteAction('leave')}
                    className="mt-0.5"
                  />
                  <div className="text-left">
                    <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <CircleSlash className="size-3.5" /> Keep in this Cycle
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Preserve incomplete tasks inside this completed cycle as historical record.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-muted/30 border-t border-border">
          <DialogFooter className="flex w-full flex-row items-center justify-end gap-2">
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
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="h-9 px-5 text-[13px] font-semibold border-none shadow-none rounded-sm transition-all active:scale-95 cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isSubmitting ? "Processing..." : (isComplete ? "Complete Cycle" : "Start Cycle")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
