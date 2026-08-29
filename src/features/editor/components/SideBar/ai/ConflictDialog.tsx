'use client';

/**
 * ConflictDialog.tsx
 *
 * ADR 0001 Conflict Resolution Modal:
 * Displays concurrent edit conflict warning with two clear choices:
 * 1. Force Overwrite: Apply the AI patch over the current document.
 * 2. Discard & Re-prompt: Cancel patch and allow re-prompting on latest context.
 */

import React from 'react';
import { AlertTriangle, Check, X, RefreshCw } from 'lucide-react';
import { type ConflictItem } from '@/features/editor/utils/ai.util';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';

interface ConflictDialogProps {
  open: boolean;
  conflicts: ConflictItem[];
  onForceOverwrite: () => void;
  onDiscard: () => void;
  onReprompt?: () => void;
}

export default function ConflictDialog({
  open,
  conflicts,
  onForceOverwrite,
  onDiscard,
  onReprompt,
}: ConflictDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDiscard()}>
      <DialogContent className="w-full max-w-lg p-5 gap-4" showCloseButton={false}>
        <DialogHeader className="text-left">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-destructive/10 p-2 text-destructive shrink-0">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-sm font-semibold text-foreground">
                Concurrent Edit Conflict Detected
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1 leading-relaxed">
                The main document was modified after this AI suggestion was generated. Applying this patch directly might overwrite recent changes made by another author or background save.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Conflicting line ranges list */}
        {conflicts.length > 0 && (
          <div className="rounded-lg border border-border/60 bg-muted/20 overflow-hidden text-xs max-h-48 overflow-y-auto">
            <div className="bg-muted/40 px-3 py-1.5 font-medium text-[11px] text-muted-foreground border-b border-border/40">
              Conflicting Line Ranges ({conflicts.length})
            </div>
            <div className="p-3 space-y-2 font-mono text-[11px]">
              {conflicts.map((c, i) => (
                <div key={i} className="space-y-1">
                  <div className="text-muted-foreground text-[10px]">
                    Lines {c.startLine}-{c.endLine}:
                  </div>
                  <div className="p-1.5 rounded bg-destructive/10 text-destructive border border-destructive/20 break-all">
                    <span className="font-sans font-semibold text-[10px] uppercase text-destructive/80 block">Current on Main:</span>
                    {c.currentText}
                  </div>
                  <div className="p-1.5 rounded bg-muted/60 text-muted-foreground border border-border/40 break-all">
                    <span className="font-sans font-semibold text-[10px] uppercase text-muted-foreground/80 block">AI Expected:</span>
                    {c.expectedText}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDiscard}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
            <span>Discard</span>
          </Button>

          {onReprompt && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onReprompt}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="size-3.5" />
              <span>Discard & Re-prompt</span>
            </Button>
          )}

          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onForceOverwrite}
            className="gap-1.5 text-xs font-medium"
          >
            <Check className="size-3.5" />
            <span>Force Overwrite</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
