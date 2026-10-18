'use client';

/**
 * DraftRecoveryDialog
 *
 * Shown when a locally persisted (IndexedDB / localStorage) draft differs from the server
 * version on document load. The user must explicitly restore the draft or keep the server
 * version — nothing is overwritten silently.
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
import { computeDraftDiffSummary } from '@/features/editor/domain/document/draft-diff';

export interface DraftRecoveryDialogProps {
  open: boolean;
  fileName: string;
  draftContent: string;
  serverContent: string;
  savedAt: number;
  onRestore: () => void;
  onKeepServer: () => void;
}

export function DraftRecoveryDialog({
  open,
  fileName,
  draftContent,
  serverContent,
  savedAt,
  onRestore,
  onKeepServer,
}: DraftRecoveryDialogProps) {
  const [showDiff, setShowDiff] = React.useState(false);
  const summary = React.useMemo(
    () => (open ? computeDraftDiffSummary(draftContent, serverContent) : null),
    [open, draftContent, serverContent]
  );

  return (
    <Dialog
      open={open}
      onOpenChange={() => {
        /* A decision is required; closing without choosing is not allowed. */
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="w-[95vw] sm:max-w-2xl max-h-[85vh] flex flex-col text-foreground bg-background border border-border shadow-raised-200 p-6 rounded-md overflow-hidden"
        data-testid="draft-recovery-dialog"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">Unsaved local draft detected</DialogTitle>
          <DialogDescription className="text-12 text-muted-foreground mt-0.5">
            File <span className="font-medium text-foreground">{fileName}</span> has a local draft (saved at{' '}
            {new Date(savedAt).toLocaleString()}) that differs from the server version. Choose which version to keep.
          </DialogDescription>
        </DialogHeader>

        {summary && (
          <div className="text-xs space-y-2 flex-1 min-h-0 overflow-y-auto py-1 pr-1" data-testid="draft-diff-summary">
            <div className="flex flex-wrap gap-3 text-muted-foreground">
              <span className="text-success">+{summary.addedLines} lines in draft</span>
              <span className="text-destructive">−{summary.removedLines} lines vs server</span>
              <span>
                {summary.draftLineCount} / {summary.serverLineCount} lines (draft / server)
              </span>
              <span>
                {summary.charDelta >= 0 ? '+' : ''}
                {summary.charDelta} chars
              </span>
            </div>
            <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs relative after:absolute after:-inset-1 after:content-['']" onClick={() => setShowDiff((v) => !v)}>
              {showDiff ? 'Hide diff' : 'Show diff'}
            </Button>
            {showDiff && (
              <pre
                className="max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-2 font-mono text-[11px] leading-relaxed"
                data-testid="draft-diff-preview"
              >
                {summary.preview.map((line, idx) => (
                  <div
                    key={`${line.type}-${line.lineNumber}-${idx}`}
                    className={line.type === 'added' ? 'text-success' : 'text-destructive'}
                  >
                    {line.type === 'added' ? '+' : '−'} {String(line.lineNumber).padStart(4, ' ')} | {line.text}
                  </div>
                ))}
                {summary.addedLines + summary.removedLines > summary.preview.length && (
                  <div className="text-muted-foreground">
                    … and {summary.addedLines + summary.removedLines - summary.preview.length} more lines
                  </div>
                )}
              </pre>
            )}
          </div>
        )}

        <DialogFooter className="shrink-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-border/50">
          <Button variant="outline" size="sm" onClick={onKeepServer} data-testid="draft-keep-server" className="text-xs cursor-pointer h-8 relative after:absolute after:-inset-1 after:content-['']">
            Keep server version
          </Button>
          <Button size="sm" onClick={onRestore} data-testid="draft-restore" className="text-xs cursor-pointer h-8 relative after:absolute after:-inset-1 after:content-['']">
            Restore local draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DraftRecoveryDialog;
