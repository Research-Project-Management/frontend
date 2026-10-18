'use client';

/**
 * DocumentConflictDialog.tsx
 *
 * Modal for resolving concurrent document conflicts between local uncommitted edits
 * and incoming remote server updates.
 *
 * Provides:
 * - Summary metrics (added/removed lines, character delta via computeDraftDiffSummary)
 * - Visual Diff inspection comparing local and remote versions
 * - Interactive Merge Editor allowing custom 3-way resolution before committing
 * - 3 Resolution actions: Keep Local, Take Remote, Apply Merge
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Badge } from '@/shared/components/ui/badge';
import { AlertTriangle, GitMerge, FileText, CheckCircle2 } from 'lucide-react';
import { computeDraftDiffSummary, type DraftDiffSummary } from '@/features/editor/domain/document/draft-diff';
import type { DocumentConflict } from '@/features/editor/core/coordinator/session.coordinator';

export interface DocumentConflictDialogProps {
  open: boolean;
  conflict: DocumentConflict | null;
  fileName?: string;
  onResolve: (resolution: 'keep-local' | 'take-remote' | 'custom-merge', mergedContent?: string) => void;
  onClose?: () => void;
}

export function DocumentConflictDialog({
  open,
  conflict,
  fileName = 'document',
  onResolve,
  onClose,
}: DocumentConflictDialogProps) {
  const [activeTab, setActiveTab] = useState<'diff' | 'merge'>('diff');
  const [mergedText, setMergedText] = useState<string>('');

  useEffect(() => {
    if (conflict) {
      setMergedText(conflict.localContent);
    }
  }, [conflict]);

  const diffSummary: DraftDiffSummary | null = useMemo(() => {
    if (!conflict) return null;
    return computeDraftDiffSummary(conflict.localContent, conflict.remoteContent, 30);
  }, [conflict]);

  if (!conflict) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose?.()}>
      <DialogContent
        className="w-[95vw] sm:max-w-3xl max-h-[85vh] flex flex-col text-foreground bg-background border border-border shadow-raised-200 p-6 rounded-md overflow-hidden"
        data-testid="document-conflict-dialog"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 space-y-1 pr-6">
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle className="size-5 shrink-0" />
            <DialogTitle className="text-15 font-semibold text-foreground tracking-tight">
              Document conflict detected
            </DialogTitle>
          </div>
          <DialogDescription className="text-12 text-muted-foreground">
            File <span className="font-semibold text-foreground">{fileName}</span> was updated on the server while you have unsaved local changes. Compare both versions and choose how to resolve.
          </DialogDescription>
        </DialogHeader>

        {diffSummary && (
          <div className="flex flex-wrap items-center gap-2 py-1 text-xs shrink-0" data-testid="conflict-diff-metrics">
            <Badge variant="outline" className="bg-success/10 text-success border-success/30 font-mono">
              +{diffSummary.addedLines} lines in your local version
            </Badge>
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 font-mono">
              −{diffSummary.removedLines} lines from server
            </Badge>
            <span className="text-muted-foreground text-11">
              Delta: {diffSummary.charDelta >= 0 ? `+${diffSummary.charDelta}` : diffSummary.charDelta} chars
            </span>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="grid w-full grid-cols-2 shrink-0 bg-muted p-1 rounded-md mt-2">
          <button
            type="button"
            data-testid="tab-diff"
            onClick={() => setActiveTab('diff')}
            className={`flex items-center justify-center gap-1.5 text-xs py-1.5 px-3 rounded font-medium transition-colors cursor-pointer ${
              activeTab === 'diff'
                ? 'bg-background text-foreground border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="size-3.5" />
            Diff Preview
          </button>
          <button
            type="button"
            data-testid="tab-merge"
            onClick={() => setActiveTab('merge')}
            className={`flex items-center justify-center gap-1.5 text-xs py-1.5 px-3 rounded font-medium transition-colors cursor-pointer ${
              activeTab === 'merge'
                ? 'bg-background text-foreground border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <GitMerge className="size-3.5" />
            Merge Editor
          </button>
        </div>

        {activeTab === 'diff' ? (
          <div className="flex-1 min-h-0 overflow-y-auto mt-2 border rounded-md p-3 bg-muted/20 font-mono text-xs space-y-1">
            {diffSummary?.identical ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground gap-2">
                <CheckCircle2 className="size-4 text-success" />
                Both versions have identical content.
              </div>
            ) : (
              <div className="space-y-1">
                {diffSummary?.preview.map((line, idx) => {
                  const isAdded = line.type === 'added';
                  return (
                    <div
                      key={idx}
                      className={`flex items-start px-2 py-0.5 rounded leading-relaxed text-11 ${
                        isAdded
                          ? 'bg-success/15 text-success'
                          : 'bg-destructive/15 text-destructive'
                      }`}
                    >
                      <span className="w-12 select-none shrink-0 opacity-60">
                        {isAdded ? `+${line.lineNumber}` : `−${line.lineNumber}`}
                      </span>
                      <span className="w-4 select-none shrink-0 font-semibold">
                        {isAdded ? '+' : '−'}
                      </span>
                      <pre className="font-mono whitespace-pre-wrap break-all flex-1 m-0">
                        {line.text}
                      </pre>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col gap-2 mt-2">
            <div className="flex items-center justify-between gap-2 shrink-0">
              <span className="text-11 text-muted-foreground">
                Edit merged content before saving:
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground relative after:absolute after:-inset-1 after:content-['']"
                  onClick={() => setMergedText(conflict.localContent)}
                >
                  Reset to local
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground relative after:absolute after:-inset-1 after:content-['']"
                  onClick={() => setMergedText(conflict.remoteContent)}
                >
                  Reset to server
                </Button>
              </div>
            </div>
            <textarea
              className="flex-1 w-full p-2.5 font-mono text-xs bg-canvas text-foreground border border-input rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              value={mergedText}
              onChange={(e) => setMergedText(e.target.value)}
              spellCheck={false}
              data-testid="conflict-merge-textarea"
            />
          </div>
        )}

        <DialogFooter className="mt-4 shrink-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-between gap-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-8 cursor-pointer relative after:absolute after:-inset-1 after:content-['']"
              onClick={() => onResolve('keep-local')}
              data-testid="btn-keep-local"
            >
              Keep my changes
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs text-destructive hover:bg-destructive/10 h-8 cursor-pointer relative after:absolute after:-inset-1 after:content-['']"
              onClick={() => onResolve('take-remote')}
              data-testid="btn-take-remote"
            >
              Take server version
            </Button>
          </div>
          <Button
            type="button"
            size="sm"
            className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 h-8 cursor-pointer relative after:absolute after:-inset-1 after:content-['']"
            onClick={() => onResolve('custom-merge', mergedText)}
            data-testid="btn-apply-merge"
          >
            <GitMerge className="size-3.5 mr-1" />
            Apply merged version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DocumentConflictDialog;
