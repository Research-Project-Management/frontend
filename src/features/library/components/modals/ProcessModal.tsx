'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type { ProcessModalState } from '../../hooks/use-ingest-progress';
import { cn } from "@/shared/lib/utils";

interface ProcessModalProps {
  state: ProcessModalState;
  onClose: () => void;
  onMinimize?: () => void;
  onViewLibrary?: () => void;
}

export default function ProcessModal({
  state,
  onClose,
  onMinimize,
}: ProcessModalProps) {
  if (!state.isOpen) return null;

  const data = state.data;
  const total = data?.total || 1;
  const processed = data?.processed || 0;
  const percentage = data?.percentage ?? (state.isComplete ? 100 : Math.round((processed / total) * 100));
  const items = data?.items || [];
  const isRunning = !state.isComplete && !state.error;

  // Compute active item index: the first item that is not yet completed (SUCCEEDED or FAILED)
  const activeIndex = state.isComplete
    ? -1
    : items.findIndex((item) => item.status !== 'SUCCEEDED' && item.status !== 'FAILED');

  // ── Main Process Modal ──────────────────────────────────────────────────────
  return (
    <Dialog open={state.isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[560px] p-2.5 sm:p-3 rounded-lg border border-border bg-background shadow-raised-200 font-sans gap-0 overflow-hidden [&>[data-slot=dialog-close]]:top-2 sm:[&>[data-slot=dialog-close]]:top-2.5 [&>[data-slot=dialog-close]]:right-2 sm:[&>[data-slot=dialog-close]]:right-2.5">
        {/* Modal Header: line removed and reduced margin */}
        <div className="pb-2.5 bg-background flex items-center justify-between">
          <DialogHeader className="text-left gap-0">
            <DialogTitle className="text-14 font-semibold text-foreground">
              Metadata Retrieval
            </DialogTitle>
            <DialogDescription className="sr-only">
              Metadata retrieval progress and status
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Modal Body */}
        <div className="space-y-3 bg-background">
          {/* Progress Overview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-12 font-medium text-foreground">
              <span>
                {isRunning ? 'Processing files...' : state.error ? 'Processing failed' : 'Processing complete'}
              </span>
              <span className="font-mono tabular-nums text-foreground">
                {percentage}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all duration-300 rounded-full',
                  state.error ? 'bg-destructive' : 'bg-primary',
                )}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          {/* Error Banner if any */}
          {state.error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-12 text-destructive">
              {state.error}
            </div>
          )}

          {/* 2-Column Table: Attachment Name | Item Name */}
          {items.length > 0 && (
            <div className="rounded-md border border-border bg-background overflow-hidden">
              {/* Table Header: Strictly text-foreground font-medium, NO gray text */}
              <div className="grid grid-cols-[48%_52%] px-3 py-2 bg-muted border-b border-border text-12 font-medium text-foreground select-none">
                <span>Attachment Name</span>
                <span>Item Name</span>
              </div>

              {/* Table Rows */}
              <div className="max-h-[240px] overflow-y-auto divide-y divide-border/30">
                {items.map((item, idx) => {
                  const isItemSuccess = item.status === 'SUCCEEDED';
                  const isItemFailed = item.status === 'FAILED';
                  const isItemActive = idx === activeIndex;

                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-[48%_52%] px-3 py-2 items-center gap-2 hover:bg-muted/40 transition-colors"
                    >
                      {/* Column 1: Attachment Name */}
                      <div className="flex items-center gap-2 min-w-0">
                        {isItemSuccess ? (
                          <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : isItemActive ? (
                          <RefreshCw className="size-3.5 text-foreground animate-spin [animation-duration:2s] shrink-0" />
                        ) : isItemFailed ? (
                          <AlertCircle className="size-3.5 text-destructive shrink-0" />
                        ) : (
                          <span className="size-3.5 shrink-0" />
                        )}
                        <span
                          className="truncate font-normal text-foreground text-12"
                          title={item.title}
                        >
                          {item.title}
                        </span>
                      </div>

                      {/* Column 2: Item Name (Strictly text-foreground, NO gray text) */}
                      <div className="min-w-0">
                        {isItemSuccess ? (
                          <span
                            className="truncate block text-foreground font-normal text-12"
                            title={(item as any).itemName || item.title}
                          >
                            {(item as any).itemName || item.title}
                          </span>
                        ) : isItemActive ? (
                          <span className="text-foreground text-12 font-normal">
                            Processing...
                          </span>
                        ) : isItemFailed ? (
                          <span
                            className="truncate block text-destructive text-11"
                            title={item.error || 'Failed'}
                          >
                            {item.error || 'Failed'}
                          </span>
                        ) : (
                          <span className="text-foreground text-12 font-normal">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 bg-background flex items-center justify-end gap-2">
          {onMinimize && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onMinimize}
              className="h-8 px-3.5 text-13 font-medium rounded-md border border-border bg-background shadow-2xs hover:bg-muted text-foreground cursor-pointer"
            >
              Minimize
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 px-3.5 text-13 font-medium rounded-md border border-border bg-background shadow-2xs hover:bg-muted text-foreground cursor-pointer"
          >
            {isRunning ? 'Cancel' : 'Close'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
