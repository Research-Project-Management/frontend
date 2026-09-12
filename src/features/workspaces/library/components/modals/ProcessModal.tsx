'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  ChevronDown,
  ChevronUp,
  Minimize2,
  Maximize2,
  X,
  FileText,
} from 'lucide-react';
import type { ProcessModalState } from '../../hooks/use-ingest-progress';
import { cn } from "@/shared/lib/utils";

interface ProcessModalProps {
  state: ProcessModalState;
  onClose: () => void;
  onToggleMinimize: () => void;
  onViewLibrary?: () => void;
}

export default function ProcessModal({
  state,
  onClose,
  onToggleMinimize,
  onViewLibrary,
}: ProcessModalProps) {
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  if (!state.isOpen) return null;

  const data = state.data;
  const total = data?.total || 1;
  const processed = data?.processed || 0;
  const succeeded = data?.succeeded || 0;
  const duplicates = data?.duplicates || 0;
  const failed = data?.failed || 0;
  const percentage = data?.percentage ?? (state.isComplete ? 100 : 0);
  const currentTitle = data?.currentTitle || state.fileName || 'Processing reference metadata...';
  const items = data?.items || [];
  const isRunning = !state.isComplete && !state.error;

  // ── Minimized Floating Pill (Zotero-style Bottom-Right Widget) ───────────────
  if (state.isMinimized) {
    return (
      <div
        onClick={onToggleMinimize}
        role="button"
        tabIndex={0}
        aria-label="Restore import progress window"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onToggleMinimize();
        }}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-md border border-border bg-card p-3 hover:bg-muted transition-all duration-200 cursor-pointer max-w-sm select-none"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
          {isRunning ? (
            <Loader2 className="size-4 animate-spin text-primary shrink-0" />
          ) : (
            <CheckCircle2 className="size-4 text-success shrink-0" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-12 font-medium text-foreground truncate">
              {isRunning ? 'Importing references' : 'Import complete'}
            </span>
            <span className="text-11 font-mono text-muted-foreground">
              {percentage}%
            </span>
          </div>
          <div className="mt-1 h-1 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="size-7 p-0 shrink-0 text-muted-foreground hover:bg-muted"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMinimize();
          }}
          title="Expand"
        >
          <Maximize2 className="size-3.5 shrink-0" />
        </Button>
      </div>
    );
  }

  // ── Main Process Modal (Zotero-style Dialog) ─────────────────────────────────
  return (
    <Dialog open={state.isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-lg border border-border bg-card">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5 bg-background">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              {isRunning ? (
                <Loader2 className="size-4 animate-spin shrink-0" />
              ) : state.error ? (
                <AlertCircle className="size-4 text-destructive shrink-0" />
              ) : (
                <CheckCircle2 className="size-4 text-success shrink-0" />
              )}
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-13 font-semibold text-foreground truncate">
                {isRunning
                  ? 'Importing References'
                  : state.error
                    ? 'Import Failed'
                    : 'Import Complete'}
              </DialogTitle>
              <DialogDescription className="text-11 text-muted-foreground truncate">
                {state.fileName}
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0 text-muted-foreground hover:bg-muted"
              onClick={onToggleMinimize}
              title="Minimize to floating widget"
            >
              <Minimize2 className="size-3.5 shrink-0" />
            </Button>
            {state.isComplete && (
              <Button
                variant="ghost"
                size="sm"
                className="size-7 p-0 text-muted-foreground hover:bg-muted"
                onClick={onClose}
                title="Close"
              >
                <X className="size-3.5 shrink-0" />
              </Button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* Progress Bar & Percentage */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-12">
              <span className="font-medium text-foreground">
                {isRunning
                  ? `Processing ${processed} of ${total} items...`
                  : `Processed ${total} reference${total > 1 ? 's' : ''}`}
              </span>
              <span className="font-mono text-11 text-muted-foreground font-medium">
                {percentage}%
              </span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all duration-300',
                  state.error ? 'bg-destructive' : 'bg-primary',
                )}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          {/* Current Working Title Indicator */}
          {isRunning && (
            <div className="flex items-start gap-2 rounded-md bg-muted/40 p-2.5 text-12">
              <FileText className="size-4 shrink-0 text-muted-foreground mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="text-11 font-medium text-muted-foreground">Current Item</div>
                <div className="text-12 text-foreground truncate font-medium">
                  {currentTitle}
                </div>
              </div>
            </div>
          )}

          {/* Metric Status Badges (Zotero Summary) */}
          <div className="grid grid-cols-3 gap-2 text-center select-none">
            <div className="rounded-md border border-success/20 bg-success/10 p-2">
              <div className="text-16 font-semibold text-success font-mono">
                {succeeded}
              </div>
              <div className="text-11 font-medium text-success/80">
                Succeeded
              </div>
            </div>
            <div className="rounded-md border border-warning/20 bg-warning/10 p-2">
              <div className="text-16 font-semibold text-warning font-mono">
                {duplicates}
              </div>
              <div className="text-11 font-medium text-warning/80">
                Duplicates
              </div>
            </div>
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-2">
              <div className="text-16 font-semibold text-destructive font-mono">
                {failed}
              </div>
              <div className="text-11 font-medium text-destructive/80">
                Failed
              </div>
            </div>
          </div>

          {/* Error Banner if any */}
          {state.error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-12 text-destructive">
              {state.error}
            </div>
          )}

          {/* Collapsible Granular Log Details */}
          {items.length > 0 && (
            <div className="border border-border rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                className="flex w-full items-center justify-between px-3 py-2 text-12 font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <span>Recent items ({items.length})</span>
                {isDetailsExpanded ? (
                  <ChevronUp className="size-3.5 shrink-0" />
                ) : (
                  <ChevronDown className="size-3.5 shrink-0" />
                )}
              </button>

              {isDetailsExpanded && (
                <div className="max-h-40 overflow-y-auto divide-y divide-border/50 border-t border-border bg-muted/10 p-1">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-11"
                    >
                      <span className="truncate text-foreground max-w-[240px]">
                        {item.title}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 font-medium text-11 px-1.5 py-0.5 rounded-sm',
                          item.status === 'SUCCEEDED' &&
                            'bg-success/15 text-success',
                          item.status === 'DUPLICATE' &&
                            'bg-warning/15 text-warning',
                          item.status === 'FAILED' &&
                            'bg-destructive/15 text-destructive',
                        )}
                      >
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3 bg-background">
          {isRunning ? (
            <Button
              variant="outline"
              size="sm"
              className="text-12 h-8"
              onClick={onToggleMinimize}
            >
              Continue in background
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-12 h-8"
                onClick={onClose}
              >
                Close
              </Button>
              {onViewLibrary && succeeded > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  className="text-12 h-8"
                  onClick={() => {
                    onViewLibrary();
                    onClose();
                  }}
                >
                  View in Library
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
