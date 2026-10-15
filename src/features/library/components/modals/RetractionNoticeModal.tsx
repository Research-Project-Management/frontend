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
import type { Item } from '@/features/library/types/library.types';
import { getRetractionInfo } from '@/features/library/domain/retraction';

export interface RetractionNoticeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item;
  canEdit?: boolean;
  onDismiss?: () => void | Promise<void>;
  isDismissing?: boolean;
}

export function RetractionNoticeModal({
  open,
  onOpenChange,
  item,
}: RetractionNoticeModalProps) {
  const retractionInfo = getRetractionInfo(item);
  const noticeUrl = retractionInfo.noticeUrl || (item.doi ? `https://doi.org/${item.doi}` : undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-6 gap-4">
        {/* ── Header: Clean & focused, modal title & X icon only, no border line ── */}
        <DialogHeader className="p-0 pb-0.5 text-left">
          <DialogTitle className="text-16 font-semibold text-foreground tracking-tight">
            Retraction Notice
          </DialogTitle>
          <DialogDescription className="sr-only">
            Retraction notice and citation warning details for this publication
          </DialogDescription>
        </DialogHeader>

        {/* ── Modal Body: Organized, balanced information hierarchy ── */}
        <div className="space-y-3 text-12">
          {/* 1. Status Alert Callout */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg border border-destructive/25 bg-destructive/10 text-destructive">
            <ShieldAlert className="size-4 shrink-0 mt-0.5 text-destructive" strokeWidth={1.75} />
            <div className="space-y-0.5 min-w-0 flex-1">
              <p className="text-12 font-semibold text-destructive leading-snug">
                This publication has been retracted
              </p>
              <p className="text-11 text-muted-foreground leading-normal">
                Flagged by Retraction Watch and Crossref academic integrity databases.
              </p>
            </div>
          </div>

          {/* 2. Publication Title Box */}
          <div className="rounded-lg bg-muted/30 border border-border/60 p-3 space-y-1">
            <span className="text-10 uppercase tracking-wider font-semibold text-muted-foreground block">
              Publication
            </span>
            <p className="text-12 font-medium text-foreground leading-snug break-words">
              {item.title || 'Untitled Document'}
            </p>
          </div>

          {/* 3. Status & Date Grid */}
          <div className="grid grid-cols-2 gap-2 text-11">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
              <span className="text-muted-foreground block text-10 font-medium">Status / Nature</span>
              <span className="font-medium text-destructive capitalize mt-0.5 block">
                {retractionInfo.nature
                  ? retractionInfo.nature.replace(/_/g, ' ')
                  : 'Retraction'}
              </span>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
              <span className="text-muted-foreground block text-10 font-medium">Retraction Date</span>
              <span className="font-mono text-foreground font-medium mt-0.5 block">
                {retractionInfo.date || 'Unspecified'}
              </span>
            </div>
          </div>

          {/* 4. Official Reason Alert Card */}
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-2">
            <div className="text-11 font-semibold text-destructive tracking-wide flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 shrink-0" strokeWidth={1.75} />
              <span>Official Reason</span>
            </div>
            <p className="text-12 text-foreground/90 leading-relaxed break-words font-sans">
              {retractionInfo.formattedReason}
            </p>

            {noticeUrl && (
              <div className="pt-2 border-t border-destructive/15">
                <a
                  href={noticeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-11 font-medium text-destructive hover:underline transition-colors"
                >
                  <span>
                    {retractionInfo.noticeUrl
                      ? 'View publisher retraction notice'
                      : 'View publication DOI link'}
                  </span>
                  <ExternalLink className="size-3 shrink-0" strokeWidth={1.75} />
                </a>
              </div>
            )}
          </div>

          {/* 5. Academic Rigor / Citation Warning */}
          <div className="text-11 text-muted-foreground bg-muted/30 rounded-lg p-2.5 border border-border/50 leading-relaxed">
            <span className="font-semibold text-foreground">Citation Warning:</span> Including retracted papers in your bibliography may compromise the validity of your research results.
          </div>
        </div>

        {/* ── Footer: Clean & simple, no divider line, right-aligned Close button only ── */}
        <DialogFooter className="p-0 pt-2 flex items-center justify-end sm:justify-end border-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-12 font-medium h-8 px-4 cursor-pointer"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RetractionNoticeModal;
