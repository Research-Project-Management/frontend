'use client';

import React, { useState, useId, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Progress } from '@/shared/components/ui/progress';
import { Badge } from '@/shared/components/ui/badge';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { CheckCircle2, AlertCircle, RefreshCw, Loader2, X, Award, ShieldCheck, FileText, Globe, Lock } from 'lucide-react';
import { deriveProcessModalPhase, deriveProcessModalDisplayMode, classifyProcessItemStage, type ProcessModalState } from '@/features/library/core/store/process-modal.store';
import { cn } from '@/shared/lib/utils';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Switch } from '@/shared/components/ui/switch';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { myPublicationFormSchema, type MyPublicationFormValues, type Item } from '@/features/library/domain/types/core.types';

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
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 h-8 px-2.5 rounded-md border border-border bg-background shadow-raised-200 cursor-pointer hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors text-12 font-medium text-foreground select-none overflow-hidden group"
        title="Click to view details"
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
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="size-4 p-0.5 rounded-xs hover:bg-muted text-muted-foreground hover:text-foreground inline-flex items-center justify-center ml-0.5 cursor-pointer outline-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            title="Dismiss"
            aria-label="Dismiss"
          >
            <X className="size-3" />
          </button>
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

                {/* Rows wrapped in ScrollArea with clean subtle dividers */}
                <ScrollArea className="max-h-[300px]">
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

export interface MyPublicationModalProps {
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
  const isPublicSwitchId = useId();
  const includeAttachmentsSwitchId = useId();

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
        openAccessLicense: data.isPublic ? data.openAccessLicense : null,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (isSubmitting) return; onOpenChange(v); }}>
      <DialogContent
        className="sm:max-w-[540px] p-6 rounded-lg border border-border bg-background shadow-raised-200"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <form onSubmit={handleSubmit(onValidSubmit)}>
          <DialogHeader className="flex flex-row items-start gap-3.5 space-y-0 text-left">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 dark:text-amber-400">
              <Award className="size-5 shrink-0" strokeWidth={1.75} />
            </div>

            <div className="min-w-0 flex-1">
              <DialogTitle className="text-15 font-semibold text-foreground tracking-tight">
                Add to My Publications
              </DialogTitle>
              <DialogDescription className="mt-1 text-12 text-muted-foreground leading-normal">
                Confirm authorship to claim this work in your personal academic portfolio.
              </DialogDescription>
            </div>
          </DialogHeader>

          {/* Paper Summary Card */}
          {item && (
            <div className="mt-3 p-3 rounded-md bg-muted/60 border border-border/70 flex flex-col gap-1">
              <span className="text-11 font-medium text-muted-foreground uppercase tracking-wider">
                {item.itemType || 'Publication'}
              </span>
              <p className="text-13 font-medium text-foreground line-clamp-2">
                {item.title || 'Untitled Document'}
              </p>
              <div className="flex items-center gap-2 text-11 text-muted-foreground">
                {item.year && <span>{item.year}</span>}
                {item.publicationTitle && (
                  <>
                    <span>•</span>
                    <span className="truncate max-w-[280px]">{item.publicationTitle}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Disclaimer Note */}
          <div className="mt-2 p-2.5 rounded-md bg-primary/5 border border-primary/20 text-11 text-foreground flex items-start gap-2">
            <ShieldCheck className="size-4 shrink-0 text-primary mt-0.5" />
            <p className="leading-relaxed">
              <strong>Authorship Notice:</strong> Only add work that you authored or co-authored yourself.
              Items in My Publications can be displayed on your public research profile.
            </p>
          </div>

          {/* Author Identity Linkage */}
          {contributors.length > 0 && (
            <div className="mt-4 flex flex-col gap-1.5">
              <Label htmlFor={contributorSelectId} className="text-12 font-medium text-foreground">
                Which author represents you?
              </Label>
              <Controller
                name="contributorId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger id={contributorSelectId} className="h-8 text-12">
                      <SelectValue placeholder="Select your name in author list" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unlinked" className="text-12">
                        (General Author — not linked to a specific position)
                      </SelectItem>
                      {contributors.map((c, index) => {
                        const val = c.id || `contrib-${index}`;
                        return (
                          <SelectItem key={val} value={val} className="text-12">
                            {c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Author'}{' '}
                            {c.creatorType ? `(${c.creatorType})` : ''}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          {/* Visibility and Licensing Controls */}
          <div className="mt-4 space-y-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label
                  htmlFor={isPublicSwitchId}
                  className="text-12 font-medium text-foreground flex items-center gap-1.5 cursor-pointer"
                >
                  <Globe className="size-3.5 text-muted-foreground" />
                  Show on public profile
                </Label>
                <p className="text-11 text-muted-foreground">
                  Make this citation visible on your public portfolio page
                </p>
              </div>
              <Controller
                name="isPublic"
                control={control}
                render={({ field }) => (
                  <Switch
                    id={isPublicSwitchId}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label
                  htmlFor={includeAttachmentsSwitchId}
                  className="text-12 font-medium text-foreground flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="size-3.5 text-muted-foreground" />
                  Include attached full-text files
                </Label>
                <p className="text-11 text-muted-foreground">
                  Allow visitors to download open-access PDF attachments
                </p>
              </div>
              <Controller
                name="includeAttachments"
                control={control}
                render={({ field }) => (
                  <Switch
                    id={includeAttachmentsSwitchId}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={!isPublic}
                  />
                )}
              />
            </div>

            {isPublic && (
              <div className="pt-2 flex flex-col gap-1.5">
                <Label htmlFor={licenseSelectId} className="text-12 font-medium text-foreground flex items-center gap-1.5">
                  <Lock className="size-3.5 text-muted-foreground" />
                  Open Access License
                </Label>
                <Controller
                  name="openAccessLicense"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger id={licenseSelectId} className="h-8 text-12">
                        <SelectValue placeholder="Select license" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CC-BY-4.0" className="text-12">
                          CC-BY 4.0 (Creative Commons Attribution)
                        </SelectItem>
                        <SelectItem value="CC-BY-NC-4.0" className="text-12">
                          CC-BY-NC 4.0 (Non-Commercial)
                        </SelectItem>
                        <SelectItem value="CC0-1.0" className="text-12">
                          CC0 1.0 (Public Domain Dedication)
                        </SelectItem>
                        <SelectItem value="All-Rights-Reserved" className="text-12">
                          All Rights Reserved / Publisher Restricted
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}
          </div>

          <DialogFooter className="mt-5 flex w-full flex-row items-center justify-end gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-8 px-3 text-13 font-medium cursor-pointer rounded-md hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-8 px-3 text-13 font-medium cursor-pointer rounded-md bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
              Confirm Authorship
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
