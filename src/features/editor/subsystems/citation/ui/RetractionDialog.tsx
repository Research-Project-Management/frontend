'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import type { BibEntry } from '@/features/editor/domain/latex/bib-parser';
import type { RetractedItemInfo } from '../model/retraction';

interface PendingRetractedCitation {
  entry: BibEntry;
  info: RetractedItemInfo;
}

export interface CitationRetractionAlertDialogProps {
  pendingRetracted: PendingRetractedCitation | null;
  onDismiss: () => void;
  onConfirmCiteAnyway: (entry: BibEntry) => void;
}

export function CitationRetractionAlertDialog({
  pendingRetracted,
  onDismiss,
  onConfirmCiteAnyway,
}: CitationRetractionAlertDialogProps) {
  return (
    <AlertDialog
      open={Boolean(pendingRetracted)}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
    >
      <AlertDialogContent className="w-[94vw] sm:max-w-[480px] p-0 gap-0 overflow-hidden rounded-lg border border-border bg-background">
        <AlertDialogHeader className="px-5 pt-4 pb-3 border-b border-border text-left space-y-0">
          <AlertDialogTitle className="text-sm font-semibold text-foreground tracking-tight">
            Retracted reference
          </AlertDialogTitle>
        </AlertDialogHeader>

        <div className="px-5 py-4 space-y-3">
          <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
            {pendingRetracted?.info.title ? (
              <span className="font-medium text-foreground">
                {pendingRetracted.info.title}
              </span>
            ) : (
              'This reference'
            )}{' '}
            has been flagged as retracted
            {pendingRetracted?.info.reason
              ? `: ${pendingRetracted.info.reason}`
              : '.'}{' '}
            Do you still want to add it?
          </AlertDialogDescription>

          {pendingRetracted?.info.noticeUrl && (
            <a
              href={pendingRetracted.info.noticeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <span>View retraction notice</span>
              <ExternalLink className="size-3 shrink-0" />
            </a>
          )}
        </div>

        <AlertDialogFooter className="px-5 py-3 border-t border-border flex flex-row items-center justify-end gap-2 bg-background">
          <AlertDialogCancel className="h-8 px-3 mt-0 text-xs cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground shadow-none">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (pendingRetracted) onConfirmCiteAnyway(pendingRetracted.entry);
              onDismiss();
            }}
            className="h-8 px-4 text-xs font-medium rounded-md bg-primary hover:bg-primary-hover text-primary-foreground cursor-pointer shadow-none"
          >
            Add anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
