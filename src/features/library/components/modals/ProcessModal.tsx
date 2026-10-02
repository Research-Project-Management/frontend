'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import type { ProcessModalState } from '../../data';
import { cn } from "@/shared/lib/utils";

interface ProcessModalProps {
  state: ProcessModalState;
  onClose: () => void;
  onMinimize?: () => void;
  onRestore?: () => void;
  onViewLibrary?: () => void;
}

function formatSourceLabel(raw?: string): string {
  if (!raw) return '—';
  const str = raw.trim();
  if (str.startsWith('http://') || str.startsWith('https://')) {
    try {
      const url = new URL(str);
      const pathname = url.pathname;
      const lastSeg = pathname.split('/').filter(Boolean).pop();
      if (lastSeg && lastSeg.length > 2) {
        return decodeURIComponent(lastSeg);
      }
      return `${url.hostname}${pathname}`;
    } catch {
      return str;
    }
  }
  return str;
}

export default function ProcessModal({
  state,
  onClose,
  onMinimize,
  onRestore,
}: ProcessModalProps) {
  const data = state.data;
  const total = data?.total || 1;
  const processed = data?.processed || 0;
  const percentage = data?.percentage ?? (state.isComplete ? 100 : Math.round((processed / total) * 100));
  const items = data?.items || [];
  const isRunning = !state.isComplete && !state.error;

  // Terminal statuses: both frontend conventions and backend IngestionStatus
  const isTerminalStatus = (status: string) =>
    ['SUCCEEDED', 'COMPLETED', 'READY', 'FAILED', 'FAILED_FINAL', 'FAILED_RETRYABLE', 'CANCELLED'].includes(status);

  // Compute active item index: the first item that is not yet completed
  const activeIndex = state.isComplete
    ? -1
    : items.findIndex((item) => !isTerminalStatus(item.status));

  // ── Floating Minimized Pill ────────────────────────────────────────────────
  if (state.isMinimized && !state.isOpen) {
    return (
      <div
        onClick={onRestore}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background shadow-raised-200 cursor-pointer hover:bg-muted/80 transition-colors text-12 font-medium text-foreground select-none"
        title="Click to view details"
      >
        {state.isComplete ? (
          <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        ) : (
          <RefreshCw className="size-3.5 text-primary animate-spin shrink-0" />
        )}
        <span>
          {state.isComplete
            ? 'Processing complete'
            : `Processing (${percentage}%)`}
        </span>
        {state.isComplete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="size-4 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground inline-flex items-center justify-center ml-0.5 cursor-pointer"
            title="Dismiss"
          >
            <X className="size-3" />
          </button>
        )}
      </div>
    );
  }

  if (!state.isOpen) return null;

  // ── Main Process Modal ──────────────────────────────────────────────────────
  return (
    <Dialog
      open={state.isOpen}
      onOpenChange={(open) => {
        if (!open) {
          if (isRunning && onMinimize) {
            onMinimize();
          } else {
            onClose();
          }
        }
      }}
    >
      <DialogContent className="sm:max-w-[580px] p-5 sm:p-6 rounded-xl border border-border bg-background shadow-raised-200 font-sans gap-0 overflow-hidden">
        {/* Modal Header */}
        <div className="pb-3.5 flex items-start justify-between">
          <DialogHeader className="text-left gap-1">
            <div className="flex items-center gap-2.5">
              <DialogTitle className="text-16 font-semibold text-foreground tracking-tight">
                Metadata Retrieval
              </DialogTitle>
              {isRunning && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-11 font-medium bg-primary/10 text-primary">
                  <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                  In progress
                </span>
              )}
              {state.isComplete && !state.error && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-11 font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-3" />
                  Completed
                </span>
              )}
            </div>
            <DialogDescription className="text-12 text-muted-foreground pt-0.5">
              {isRunning
                ? `Extracting academic metadata and authors from documents (${processed}/${total})`
                : state.error
                  ? 'Some documents encountered errors during extraction'
                  : `Successfully processed ${data?.succeeded ?? processed} of ${total} document(s)`}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Modal Body */}
        <div className="space-y-3 bg-background">
          {/* Progress Overview */}
          <div className="space-y-2 pb-2">
            <div className="flex items-center justify-between text-12 font-medium">
              <span className="text-foreground">
                {isRunning ? 'Processing files...' : state.error ? 'Processing failed' : 'All files processed'}
              </span>
              <span className="font-mono tabular-nums text-foreground font-semibold">
                {percentage}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-1.5 w-full bg-muted/70 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full w-full origin-left transition-transform duration-300 ease-out rounded-full',
                  state.error ? 'bg-destructive' : 'bg-primary',
                )}
                style={{ transform: `scaleX(${percentage / 100})` }}
              />
            </div>
          </div>

          {/* Error Banner if any */}
          {state.error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-12 text-destructive">
              {state.error}
            </div>
          )}

          {/* 2-Column List: Attachment Name | Item Name (Clean line dividers without board box) */}
          {items.length > 0 && (
            <div className="pt-1">
              {/* Column Headers with subtle line */}
              <div className="grid grid-cols-[45%_55%] px-1 pb-2 border-b border-border text-12 font-medium text-muted-foreground select-none">
                <span>Attachment Name</span>
                <span>Item Name</span>
              </div>

              {/* Rows separated by clean subtle dividers */}
              <div className="max-h-[250px] overflow-y-auto divide-y divide-border/40">
                {items.map((item, idx) => {
                  const status = String(item.status);
                  const isItemFailed = ['FAILED', 'FAILED_FINAL', 'FAILED_RETRYABLE'].includes(status);
                  const isItemSuccess =
                    ['SUCCEEDED', 'COMPLETED', 'READY'].includes(status) ||
                    (state.isComplete && !isItemFailed && !state.error);
                  const isItemProcessing =
                    !isItemSuccess &&
                    !isItemFailed &&
                    (['PROCESSING', 'RUNNING', 'UPLOADING'].includes(status) || idx === activeIndex);

                  return (
                    <div
                      key={item.title || idx}
                      className="grid grid-cols-[45%_55%] px-1 py-3 items-center gap-3 hover:bg-muted/20 transition-colors"
                    >
                      {/* Column 1: Attachment Name */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        {isItemSuccess ? (
                          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        ) : isItemProcessing ? (
                          <RefreshCw className="size-3.5 text-primary animate-spin [animation-duration:2s] shrink-0" />
                        ) : isItemFailed ? (
                          <AlertCircle className="size-4 text-destructive shrink-0" />
                        ) : (
                          <span className="size-4 rounded-full border border-border shrink-0" />
                        )}
                        <span
                          className="truncate text-12 text-foreground font-normal"
                          title={item.title}
                        >
                          {formatSourceLabel(item.title)}
                        </span>
                      </div>

                      {/* Column 2: Item Name */}
                      <div className="min-w-0">
                        {isItemSuccess ? (
                          <span
                            className="truncate block text-foreground font-normal text-12"
                            title={item.itemName || item.title}
                          >
                            {item.itemName || item.title}
                          </span>
                        ) : isItemProcessing ? (
                          <span className="text-muted-foreground text-12 font-normal flex items-center gap-1.5">
                            {(item.status as string) === 'UPLOADING' ? 'Uploading file...' : 'Extracting metadata...'}
                          </span>
                        ) : isItemFailed ? (
                          <span
                            className="truncate block text-destructive text-12 font-normal"
                            title={item.error || 'Failed'}
                          >
                            {item.error || 'Extraction failed'}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60 text-12 font-normal">—</span>
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
        <div className="pt-4 mt-3 border-t border-border flex items-center justify-between">
          <span className="text-11 text-muted-foreground">
            {isRunning ? `${processed} of ${total} files processed` : `${total} file(s) total`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={isRunning ? 'outline' : 'default'}
              size="sm"
              onClick={isRunning ? (onMinimize || onClose) : onClose}
              className="h-8 px-4 text-12 font-medium rounded-md cursor-pointer"
            >
              {isRunning ? 'Minimize' : 'Close'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
