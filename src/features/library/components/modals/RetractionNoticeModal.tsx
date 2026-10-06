'use client';

import React from 'react';
import { ShieldAlert, ExternalLink, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import type { Item } from '@/features/library/types/library.types';
import { getRetractionInfo } from '@/features/library/utils/retraction';

export interface RetractionNoticeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item;
  canEdit?: boolean;
  onDismiss?: () => any;
  isDismissing?: boolean;
}

export function RetractionNoticeModal({
  open,
  onOpenChange,
  item,
  canEdit = true,
  onDismiss,
  isDismissing = false,
}: RetractionNoticeModalProps) {
  const retractionInfo = getRetractionInfo(item);
  const noticeUrl = retractionInfo.noticeUrl || (item.doi ? `https://doi.org/${item.doi}` : undefined);

  const handleDismiss = async () => {
    if (onDismiss) {
      await onDismiss();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-6 gap-5">
        <DialogHeader className="gap-2 sm:text-left">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0 mt-0.5">
              <ShieldAlert className="size-5" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-15 font-semibold text-destructive">
                {retractionInfo.title || 'Retracted Publication'}
              </DialogTitle>
              <DialogDescription className="text-12 text-muted-foreground mt-0.5">
                Flagged by Retraction Watch and Crossref academic integrity databases.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3.5 text-12">
          {/* Paper Title Box */}
          <div className="rounded-md bg-muted/40 border border-border p-2.5">
            <span className="text-11 text-muted-foreground block mb-0.5 font-normal">
              Publication Title
            </span>
            <div className="font-medium text-foreground leading-snug break-words">
              {item.title || 'Untitled Document'}
            </div>
          </div>

          {/* Metadata badges row */}
          <div className="grid grid-cols-2 gap-2 text-11">
            <div className="rounded border border-border bg-background p-2">
              <span className="text-muted-foreground block text-10">Status / Nature</span>
              <span className="font-medium text-destructive capitalize">
                {retractionInfo.nature
                  ? retractionInfo.nature.replace(/_/g, ' ')
                  : 'Retraction'}
              </span>
            </div>
            <div className="rounded border border-border bg-background p-2">
              <span className="text-muted-foreground block text-10">Retraction Date</span>
              <span className="font-mono text-foreground font-medium">
                {retractionInfo.date || 'Unspecified'}
              </span>
            </div>
          </div>

          {/* Official Reason Alert Card */}
          <div className="rounded-md border border-destructive/25 bg-destructive/10 p-3 space-y-2">
            <div className="text-11 font-semibold text-destructive uppercase tracking-wide flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0" strokeWidth={1.5} />
              <span>Official Reason</span>
            </div>
            <p className="text-12 text-destructive/90 leading-relaxed break-words font-sans">
              {retractionInfo.formattedReason}
            </p>

            {noticeUrl && (
              <div className="pt-1 border-t border-destructive/15">
                <a
                  href={noticeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-11 font-medium text-destructive underline hover:text-destructive/80 transition-colors"
                >
                  <span>
                    {retractionInfo.noticeUrl
                      ? 'View publisher retraction notice'
                      : 'View publication DOI link'}
                  </span>
                  <ExternalLink className="size-3.5 shrink-0" strokeWidth={1.5} />
                </a>
              </div>
            )}
          </div>

          {/* Academic Rigor Notice */}
          <div className="text-11 text-muted-foreground bg-muted/30 rounded p-2.5 border border-border/60 leading-normal">
            <strong>Citation Warning:</strong> Including retracted papers in your bibliography may compromise the validity of your research results.
          </div>
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between gap-2 pt-2 border-t border-border">
          {canEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              disabled={isDismissing}
              className="text-11 h-7.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-2"
            >
              Dismiss warning
            </Button>
          ) : (
            <div />
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-11 h-7.5 px-3 min-w-[65px]"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RetractionNoticeModal;
