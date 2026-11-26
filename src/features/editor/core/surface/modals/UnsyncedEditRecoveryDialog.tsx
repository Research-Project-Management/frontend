'use client';

/**
 * UnsyncedEditRecoveryDialog
 *
 * Shown when locally persisted uncommitted edits (IndexedDB / emergency localStorage)
 * differ from the server version on document load. Requires an explicit user decision
 * to restore local edits or keep the server baseline.
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { computeUnsyncedEditDiffSummary } from '@/features/editor/domain/document/unsynced-edit-diff';

export interface UnsyncedEditRecoveryDialogProps {
  open: boolean;
  fileName: string;
  unsyncedContent: string;
  serverContent: string;
  savedAt: number;
  onRestore: () => void;
  onKeepServer: () => void;
}

export function UnsyncedEditRecoveryDialog({
  open,
  fileName,
  unsyncedContent,
  serverContent,
  savedAt,
  onRestore,
  onKeepServer,
}: UnsyncedEditRecoveryDialogProps) {
  const [showDiff, setShowDiff] = React.useState(false);
  const summary = React.useMemo(
    () => (open ? computeUnsyncedEditDiffSummary(unsyncedContent, serverContent) : null),
    [open, unsyncedContent, serverContent],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={() => {
        /* Explicit choice required before closing. */
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="w-[95vw] sm:max-w-2xl max-h-[85vh] flex flex-col text-foreground bg-background border border-border shadow-raised-200 p-6 rounded-md overflow-hidden"
        data-testid="unsynced-edit-recovery-dialog"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
            Unsaved local changes detected
          </DialogTitle>
          <DialogDescription className="text-12 text-muted-foreground mt-0.5">
            File <span className="font-medium text-foreground">{fileName}</span> has local edits (saved at{' '}
            {new Date(savedAt).toLocaleString()}) not yet synced to the server. Choose which version to keep.
          </DialogDescription>
        </DialogHeader>

        {summary && (
          <div className="text-xs space-y-2 flex-1 min-h-0 overflow-y-auto py-1 pr-1" data-testid="unsynced-edit-diff-summary">
            <div className="flex flex-wrap gap-3 text-muted-foreground">
              <span className="text-success">+{summary.addedLines} lines in local edit</span>
              <span className="text-destructive">âˆ’{summary.removedLines} lines vs server</span>
              <span>
                {summary.localLineCount} / {summary.serverLineCount} lines (local / server)
              </span>
              <span>
                {summary.charDelta >= 0 ? '+' : ''}
                {summary.charDelta} chars
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2.5 text-xs relative after:absolute after:-inset-1 after:content-['']"
              onClick={() => setShowDiff((v) => !v)}
            >
              {showDiff ? 'Hide diff' : 'Show diff'}
            </Button>
            {showDiff && (
              <pre
                className="max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-2 font-mono text-11 leading-relaxed"
                data-testid="unsynced-edit-diff-preview"
              >
                {summary.preview.map((line, idx) => (
                  <div
                    key={`${line.type}-${line.lineNumber}-${idx}`}
                    className={line.type === 'added' ? 'text-success' : 'text-destructive'}
                  >
                    {line.type === 'added' ? '+' : 'âˆ’'} {String(line.lineNumber).padStart(4, ' ')} | {line.text}
                  </div>
                ))}
                {summary.addedLines + summary.removedLines > summary.preview.length && (
                  <div className="text-muted-foreground">
                    â€¦ and {summary.addedLines + summary.removedLines - summary.preview.length} more lines
                  </div>
                )}
              </pre>
            )}
          </div>
        )}

        <DialogFooter className="shrink-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-border/50">
          <Button
            variant="outline"
            size="sm"
            onClick={onKeepServer}
            data-testid="unsynced-edit-keep-server"
            className="text-xs cursor-pointer h-8 relative after:absolute after:-inset-1 after:content-['']"
          >
            Keep server version
          </Button>
          <Button
            size="sm"
            onClick={onRestore}
            data-testid="unsynced-edit-restore"
            className="text-xs cursor-pointer h-8 relative after:absolute after:-inset-1 after:content-['']"
          >
            Restore local changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UnsyncedEditRecoveryDialog;
