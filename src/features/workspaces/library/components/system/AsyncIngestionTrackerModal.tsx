'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { CheckCircle2, XCircle, Loader2, Sparkles, FileText, ArrowRight } from 'lucide-react';
import { useAsyncJobStatus } from '../../hooks/library/use-library';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

interface AsyncIngestionTrackerModalProps {
  jobId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinished?: () => void;
}

export const AsyncIngestionTrackerModal: React.FC<AsyncIngestionTrackerModalProps> = ({
  jobId,
  open,
  onOpenChange,
  onFinished,
}) => {
  const { data: job, isLoading } = useAsyncJobStatus(jobId);

  const isCompleted = job?.status === 'completed';
  const isProcessing = job?.status === 'processing' || job?.status === 'queued';
  const isFailed = job?.status === 'failed';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-background border-border/80 text-foreground">
        <DialogHeader className="p-4 border-b border-border/70 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                {isProcessing ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : isCompleted ? (
                  <CheckCircle2 className="size-4 text-emerald-500" />
                ) : (
                  <XCircle className="size-4 text-destructive" />
                )}
              </div>
              <div>
                <DialogTitle className="text-sm font-semibold">
                  Batch Ingestion Pipeline
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Job ID: {jobId || 'N/A'}
                </DialogDescription>
              </div>
            </div>
            {job && (
              <Badge
                variant={isCompleted ? 'default' : isProcessing ? 'secondary' : 'destructive'}
                className="capitalize text-xs"
              >
                {job.status}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="p-4 space-y-4 text-xs">
          {isLoading && !job ? (
            <div className="py-8 text-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin mx-auto mb-2 text-primary" />
              Initializing batch pipeline...
            </div>
          ) : job ? (
            <>
              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span>Progress (<span className="tabular-nums font-mono">{job.processed}</span>/<span className="tabular-nums font-mono">{job.total}</span>)</span>
                  <span className="tabular-nums font-mono font-semibold">{job.progressPercentage}%</span>
                </div>
                <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden border border-border/40">
                  <div
                    className={cn(
                      'h-full transition-[width] duration-300 ease-out rounded-full',
                      isCompleted ? 'bg-emerald-500' : isFailed ? 'bg-destructive' : 'bg-primary',
                    )}
                    style={{ width: `${job.progressPercentage}%` }}
                  />
                </div>
              </div>

              {/* Counts metrics */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg border border-border/50 bg-card/60 text-center">
                  <span className="text-xs text-muted-foreground block">Total</span>
                  <span className="text-sm font-bold text-foreground font-mono tabular-nums">{job.total}</span>
                </div>
                <div className="p-2.5 rounded-lg border border-border/50 bg-card/60 text-center">
                  <span className="text-xs text-muted-foreground block">Success</span>
                  <span className="text-sm font-bold text-foreground font-mono tabular-nums">{job.successCount}</span>
                </div>
                <div className="p-2.5 rounded-lg border border-border/50 bg-card/60 text-center">
                  <span className="text-xs text-muted-foreground block">Failed</span>
                  <span className="text-sm font-bold text-foreground font-mono tabular-nums">{job.failedCount}</span>
                </div>
              </div>

              {/* Imported papers list */}
              {job.successful && job.successful.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Imported Papers
                  </p>
                  {job.successful.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border/40 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate max-w-[80%]">
                        <FileText className="size-3.5 text-primary shrink-0" />
                        <span className="truncate font-medium">{item.title}</span>
                      </div>
                      <Badge variant="outline" className="text-xs h-4.5 font-mono">
                        @{item.citationKey}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {/* Failed items list */}
              {job.failed && job.failed.length > 0 && (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  <p className="text-xs font-semibold text-destructive">
                    Failed Items
                  </p>
                  {job.failed.map((fail, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive space-y-0.5"
                    >
                      <p className="font-semibold">{fail.item?.title || fail.item?.doi || `Item #${idx + 1}`}</p>
                      <p className="opacity-80 text-xs">{fail.error}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>

        <div className="p-3 border-t border-border/70 bg-muted/20 flex justify-end gap-2">
          {isCompleted && (
            <Button
              size="sm"
              onClick={() => {
                onOpenChange(false);
                if (onFinished) onFinished();
              }}
              className="h-8 text-xs cursor-pointer"
            >
              Done & View Library
            </Button>
          )}
          {!isCompleted && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs cursor-pointer"
            >
              Run in Background
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
