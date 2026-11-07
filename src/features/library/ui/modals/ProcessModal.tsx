'use client';

import React, { useState, useId, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { Progress } from '@/shared/components/ui/progress';
import { Badge } from '@/shared/components/ui/badge';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { CheckCircle2, AlertCircle, RefreshCw, Loader2, X } from 'lucide-react';
import { deriveProcessModalPhase, deriveProcessModalDisplayMode, classifyProcessItemStage, type ProcessModalState } from '@/features/library/core/store/process-modal.store';
import { cn } from '@/shared/lib/utils';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { ALL_ITEM_TYPES_FLAT, myPublicationFormSchema, type MyPublicationFormValues, type Item } from '@/features/library/types/core.types';

interface ProcessModalProps {
  state: ProcessModalState;
  onClose: () => void;
  onMinimize?: () => void;
  onRestore?: () => void;
}

function formatSourceLabel(raw?: string): string {
  if (!raw) return "-";
  const str = raw.trim();
  if (str.startsWith("http://") || str.startsWith("https://")) {
    try {
      const url = new URL(str);
      const pathname = url.pathname;
      const lastSeg = pathname.split("/").filter(Boolean).pop();
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

function formatIngestionError(rawError?: string): string {
  if (!rawError) return "Extraction failed";
  // Strip internal saga rollback stage prefix for clean UI presentation
  const sagaMatch = rawError.match(/Saga rolled back after stage \w+:\s*(.*)/i);
  const clean = sagaMatch ? sagaMatch[1] : rawError;
  return clean || "Extraction failed";
}

export default function ProcessModal({
  state,
  onClose,
  onMinimize,
  onRestore,
}: ProcessModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const data = state.data;
  const total = data?.total || 1;
  const processed = data?.processed || 0;
  const percentage =
    data?.percentage ??
    (state.isComplete ? 100 : Math.round((processed / total) * 100));
  const items = data?.items || [];

  const batchPhase = deriveProcessModalPhase(state);
  const displayMode = deriveProcessModalDisplayMode(state);
  const isRunning = batchPhase === "RUNNING";
  const isErroredPhase = batchPhase === "FAILED" || batchPhase === "ABORTED";
  const isCompletedPhase =
    batchPhase === "COMPLETED" || batchPhase === "PARTIAL_FAILURE";

  // Auto-dismiss minimized pill when processing completes without errors
  useEffect(() => {
    if (displayMode === "MINIMIZED_PILL" && batchPhase === "COMPLETED") {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [displayMode, batchPhase, onClose]);

  // Compute active item index: the first item that is not yet in a terminal stage
  const activeIndex = !isRunning
    ? -1
    : items.findIndex((item) => {
        const stage = classifyProcessItemStage(item, batchPhase, false);
        return stage !== "SUCCEEDED" && stage !== "FAILED";
      });

  // ── Floating Minimized Widget ──────────────────────────────────────────────
  if (displayMode === "MINIMIZED_PILL") {
    if (!mounted || typeof document === "undefined") return null;

    return createPortal(
      <div
        onClick={onRestore}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onRestore?.();
          }
        }}
        role="button"
        tabIndex={0}
        aria-live="polite"
        aria-label="Click to view details"
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 h-8 px-2.5 rounded-md border border-border bg-background shadow-raised-200 cursor-pointer hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors text-12 font-medium text-foreground select-none overflow-hidden group"
      >
        {/* Subtle Progress Bar Underline */}
        {isRunning && (
          <div
            className="absolute bottom-0 left-0 h-[2px] bg-primary transition-all duration-300 ease-out"
            style={{ width: `${percentage}%` }}
          />
        )}

        {/* Status Icon */}
        {isErroredPhase ? (
          <AlertCircle className="size-3.5 text-destructive shrink-0" />
        ) : isCompletedPhase ? (
          <CheckCircle2 className="size-3.5 text-success shrink-0" />
        ) : (
          <Loader2 className="size-3.5 animate-spin text-foreground shrink-0 motion-reduce:animate-none" />
        )}

        {/* Status Label & Metrics */}
        <div className="flex items-center gap-1.5 leading-none">
          <span>
            {isErroredPhase
              ? "Processing failed"
              : isCompletedPhase
                ? "Processing complete"
                : total > 1
                  ? `Processing ${processed}/${total}`
                  : "Processing"}
          </span>
          {isRunning && (
            <span className="font-mono text-11 tabular-nums text-foreground font-normal">
              ({percentage}%)
            </span>
          )}
        </div>

        {/* Dismiss Button when Complete or Errored */}
        {(isCompletedPhase || isErroredPhase) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="size-4 p-0.5 rounded-xs hover:bg-muted text-muted-foreground hover:text-foreground inline-flex items-center justify-center ml-0.5 cursor-pointer outline-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Dismiss"
              >
                <X className="size-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6} className="text-11">
              Dismiss
            </TooltipContent>
          </Tooltip>
        )}
      </div>,
      document.body,
    );
  }

  if (displayMode === "HIDDEN") return null;

  // ── Main Process Modal ──────────────────────────────────────────────────────
  return (
    <Dialog
      open={displayMode === "EXPANDED"}
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
      <DialogContent className="w-[95vw] sm:max-w-[720px] p-5 sm:p-6 rounded-xl border border-border bg-background shadow-raised-200 font-sans gap-0 overflow-hidden">
        {/* Modal Header */}
        <div className="pb-3 flex items-start justify-between">
          <DialogHeader className="text-left">
            <div className="flex items-center gap-2.5">
              <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
                Metadata Retrieval
              </DialogTitle>
              {isCompletedPhase && !state.error && (
                <Badge variant="completed" className="text-11 gap-1 py-0.5">
                  <CheckCircle2 className="size-3" />
                  Completed
                </Badge>
              )}
            </div>
            <DialogDescription className="sr-only">
              Metadata Retrieval Process
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Modal Body */}
        <div className="space-y-3 bg-background">
          {/* Progress Overview */}
          <div className="space-y-2 pb-2">
            <div className="flex items-center justify-between text-12 font-medium">
              <span className="text-foreground">
                {isRunning
                  ? "Processing files..."
                  : isErroredPhase
                    ? "Processing failed"
                    : "All files processed"}
              </span>
              <span className="font-mono tabular-nums text-foreground font-semibold">
                {percentage}%
              </span>
            </div>

            {/* Global Progress Component */}
            <Progress
              value={percentage}
              className={cn(
                "h-1.5 w-full bg-muted",
                isErroredPhase && "[&>[data-slot=progress-indicator]]:bg-destructive",
              )}
            />
          </div>

          {/* Error Banner if any */}
          {state.error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-12 text-destructive">
              {state.error}
            </div>
          )}

          {/* 2-Column Table: Attachment Name | Item Name */}
          {items.length > 0 && (
            <div className="pt-1">
              <div className="rounded-lg border border-border overflow-hidden bg-background">
                {/* Column Headers with gray fill */}
                <div className="grid grid-cols-[40%_60%] px-3.5 py-2 bg-muted border-b border-border text-11 font-medium text-foreground select-none">
                  <span>Attachment Name</span>
                  <span>Item Name</span>
                </div>

                {/* Rows wrapped in scrollable container with clean subtle dividers */}
                <ScrollArea type="always" className="max-h-[300px]">
                  <div className="divide-y divide-border-subtle">
                    {items.map((item, idx) => {
                      const itemStage = classifyProcessItemStage(
                        item,
                        batchPhase,
                        idx === activeIndex,
                      );
                      const isItemSuccess = itemStage === "SUCCEEDED";
                      const isItemFailed = itemStage === "FAILED";
                      const isItemProcessing = itemStage === "ACTIVE";

                    return (
                      <div
                        key={item.id || item.title || idx}
                        className="grid grid-cols-[40%_60%] px-3.5 py-2.5 items-center gap-3 hover:bg-muted transition-colors"
                      >
                        {/* Column 1: Attachment Name */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          {isItemSuccess ? (
                            <CheckCircle2 className="size-4 text-success shrink-0" />
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
                            <span className="text-foreground text-12 font-normal flex items-center gap-1.5">
                              {(item.status as string) === "UPLOADING"
                                ? "Uploading file..."
                                : "Extracting metadata..."}
                            </span>
                          ) : isItemFailed ? (
                            <span
                              className="truncate block text-destructive text-12 font-normal"
                              title={item.error || "Failed"}
                            >
                              {formatIngestionError(item.error)}
                            </span>
                          ) : (
                            <span className="text-foreground text-12 font-normal">
                              -
                            </span>
                          )}
                        </div>
                      </div>
                    );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-2 flex items-center justify-end gap-2">
          {isRunning && onMinimize ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onMinimize}
              className="h-8 px-4 text-13 font-medium rounded-md cursor-pointer"
            >
              Minimize
            </Button>
          ) : null}
          <Button
            type="button"
            variant={isRunning ? "outline" : "default"}
            size="sm"
            onClick={isRunning && onMinimize ? onMinimize : onClose}
            className="h-8 px-4 text-13 font-medium rounded-md cursor-pointer"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface MyPublicationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item | null;
  onConfirm: (options: {
    contributorId?: string | null;
    isPublic?: boolean;
    openAccessLicense?: string | null;
    includeAttachments?: boolean;
  }) => Promise<void> | void;
}

export function MyPublicationModal({
  open,
  onOpenChange,
  item,
  onConfirm,
}: MyPublicationModalProps) {
  const contributorSelectId = useId();
  const licenseSelectId = useId();
  const isPublicCheckboxId = useId();
  const includeAttachmentsCheckboxId = useId();

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const form = useForm<MyPublicationFormValues>({
    resolver: zodResolver(myPublicationFormSchema),
    defaultValues: {
      contributorId: 'unlinked',
      isPublic: true,
      includeAttachments: true,
      openAccessLicense: 'CC-BY-4.0',
    },
  });

  const { control, handleSubmit, reset, watch } = form;
  const isPublic = watch('isPublic');
  const includeAttachments = watch('includeAttachments');

  useEffect(() => {
    if (open) {
      reset({
        contributorId: 'unlinked',
        isPublic: true,
        includeAttachments: true,
        openAccessLicense: 'CC-BY-4.0',
      });
      setIsSubmitting(false);
    }
  }, [open, item?.id, reset]);

  const contributors = Array.isArray(item?.contributors)
    ? item.contributors
    : [];

  const itemTypeLabel = item?.itemType
    ? ALL_ITEM_TYPES_FLAT.find((t) => t.value === item.itemType)?.label ||
      item.itemType
    : 'Publication';

  const onValidSubmit = async (data: MyPublicationFormValues) => {
    setIsSubmitting(true);
    try {
      await onConfirm({
        contributorId:
          data.contributorId &&
          data.contributorId !== 'unlinked' &&
          !data.contributorId.startsWith('contrib-')
            ? data.contributorId
            : null,
        isPublic: data.isPublic,
        includeAttachments: data.isPublic ? data.includeAttachments : false,
        openAccessLicense:
          data.isPublic && data.includeAttachments
            ? data.openAccessLicense
            : null,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (isSubmitting) return;
        onOpenChange(v);
      }}
    >
      <DialogContent
        className="sm:max-w-[460px] p-6 rounded-lg border border-border bg-background shadow-raised-200 gap-0"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <form onSubmit={handleSubmit(onValidSubmit)} className="space-y-4">
          <DialogHeader className="text-left pb-0">
            <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
              Add to My Publications
            </DialogTitle>
            <DialogDescription className="text-12 text-muted-foreground">
              Only add work that you authored or co-authored yourself.
            </DialogDescription>
          </DialogHeader>

          {item && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5 space-y-0.5">
              <p className="text-13 font-medium text-foreground line-clamp-2 leading-snug">
                {item.title || 'Untitled Document'}
              </p>
              <div className="flex items-center gap-1.5 text-11 text-muted-foreground truncate">
                <span>{itemTypeLabel}</span>
                {item.year && (
                  <>
                    <span>•</span>
                    <span>{item.year}</span>
                  </>
                )}
                {item.publicationTitle && (
                  <>
                    <span>•</span>
                    <span className="truncate">{item.publicationTitle}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {contributors.length > 0 && (
            <div className="space-y-1.5">
              <Label
                htmlFor={contributorSelectId}
                className="text-11 font-medium text-foreground"
              >
                Author Position
              </Label>
              <Controller
                name="contributorId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id={contributorSelectId}
                      className="w-full h-8 text-12 text-foreground justify-between rounded-md border-border bg-background hover:border-border-hover focus-visible:border-primary cursor-pointer"
                    >
                      <SelectValue placeholder="Select your name in author list" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md">
                      <SelectItem value="unlinked" className="text-12 py-1.5 px-2">
                        General Author (not linked to a specific position)
                      </SelectItem>
                      {contributors.map((c, index) => {
                        const val = c.id || `contrib-${index}`;
                        const nameLabel =
                          c.fullName ||
                          `${c.firstName || ''} ${c.lastName || ''}`.trim() ||
                          'Author';
                        return (
                          <SelectItem key={val} value={val} className="text-12 py-1.5 px-2">
                            {nameLabel}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          <div className="flex flex-col gap-2.5 pt-0.5">
            <Controller
              name="isPublic"
              control={control}
              render={({ field }) => (
                <label
                  htmlFor={isPublicCheckboxId}
                  className="flex items-center gap-2 text-12 text-foreground cursor-pointer select-none"
                >
                  <Checkbox
                    id={isPublicCheckboxId}
                    checked={field.value}
                    onCheckedChange={(checked) =>
                      field.onChange(Boolean(checked))
                    }
                  />
                  <span>Show citation on my public research profile</span>
                </label>
              )}
            />

            {isPublic && (
              <Controller
                name="includeAttachments"
                control={control}
                render={({ field }) => (
                  <label
                    htmlFor={includeAttachmentsCheckboxId}
                    className="flex items-center gap-2 text-12 text-foreground cursor-pointer select-none"
                  >
                    <Checkbox
                      id={includeAttachmentsCheckboxId}
                      checked={field.value}
                      onCheckedChange={(checked) =>
                        field.onChange(Boolean(checked))
                      }
                    />
                    <span>Include attached full-text PDF files</span>
                  </label>
                )}
              />
            )}
          </div>

          {isPublic && includeAttachments && (
            <div className="space-y-1.5">
              <Label
                htmlFor={licenseSelectId}
                className="text-11 font-medium text-foreground"
              >
                Distribution License
              </Label>
              <Controller
                name="openAccessLicense"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id={licenseSelectId}
                      className="w-full h-8 text-12 text-foreground justify-between rounded-md border-border bg-background hover:border-border-hover focus-visible:border-primary cursor-pointer"
                    >
                      <SelectValue placeholder="Select license" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md">
                      <SelectItem value="CC-BY-4.0" className="text-12 py-1.5 px-2">
                        CC-BY 4.0 (Creative Commons Attribution)
                      </SelectItem>
                      <SelectItem value="CC-BY-NC-4.0" className="text-12 py-1.5 px-2">
                        CC-BY-NC 4.0 (Non-Commercial)
                      </SelectItem>
                      <SelectItem value="CC0-1.0" className="text-12 py-1.5 px-2">
                        CC0 1.0 (Public Domain Dedication)
                      </SelectItem>
                      <SelectItem value="All-Rights-Reserved" className="text-12 py-1.5 px-2">
                        All Rights Reserved / Publisher Copy
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          <DialogFooter className="flex items-center justify-end gap-2 pt-2 sm:space-x-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-8 px-3 text-13 font-medium cursor-pointer text-foreground rounded-md hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-8 px-3.5 text-13 font-medium cursor-pointer rounded-md shadow-none inline-flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
              Add to Publications
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
