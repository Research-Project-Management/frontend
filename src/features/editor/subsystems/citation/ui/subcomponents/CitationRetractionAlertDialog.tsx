'use client';

/**
 * CitationRetractionAlertDialog.tsx
 *
 * Retraction-Aware Citation Confirmation Dialog (Zotero / Overleaf Parity).
 * Warns researchers before citing a paper flagged in retraction databases.
 */

import React from 'react';
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
import type { RetractedItemInfo } from '@/features/editor/subsystems/citation/model/retracted-citations';

export interface PendingRetractedCitation {
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
      <AlertDialogContent className="w-[95vw] sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>This work has been retracted</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingRetracted?.info.title
              ? `"${pendingRetracted.info.title}" `
              : 'This reference '}
            is listed as retracted
            {pendingRetracted?.info.reason ? `: ${pendingRetracted.info.reason}` : '.'} Do you still
            want to cite it?
            {pendingRetracted?.info.noticeUrl && (
              <>
                {' '}
                <a
                  href={pendingRetracted.info.noticeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 text-primary"
                >
                  View retraction notice
                </a>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (pendingRetracted) onConfirmCiteAnyway(pendingRetracted.entry);
              onDismiss();
            }}
          >
            Cite anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
