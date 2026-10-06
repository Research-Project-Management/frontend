'use client';

import React from 'react';
import { FileCheck, Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

export interface SuggestModalState {
  originalText: string;
  suggestedText: string;
  fromLine: number;
  toLine: number;
  type: 'replace' | 'insert' | 'delete';
  description: string;
}

export interface SuggestEditModalProps {
  suggestModal: SuggestModalState | null;
  isPending: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  onChangeState: (updater: (prev: SuggestModalState | null) => SuggestModalState | null) => void;
}

export const SuggestEditModal = React.memo(function SuggestEditModal({
  suggestModal,
  isPending,
  onClose,
  onSubmit,
  onChangeState,
}: SuggestEditModalProps) {
  if (!suggestModal) return null;

  return (
    <Dialog
      open={Boolean(suggestModal)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg p-5 gap-4">
        <DialogHeader className="gap-1">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <FileCheck className="size-4" />
            </div>
            <DialogTitle className="text-16 font-semibold tracking-tight text-foreground">
              Suggest Edit (Track Changes)
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Propose an edit on lines {suggestModal.fromLine} - {suggestModal.toLine}
          </DialogDescription>
        </DialogHeader>

        {/* Action Type Toggle */}
        <div className="flex items-center gap-2 pt-1">
          <Label className="text-xs font-medium text-muted-foreground">Action:</Label>
          <div className="inline-flex rounded-md p-0.5 bg-muted text-xs border border-border">
            {(['replace', 'insert', 'delete'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() =>
                  onChangeState((prev) => (prev ? { ...prev, type: t } : null))
                }
                className={cn(
                  'px-2.5 py-1 rounded-sm capitalize font-medium transition-colors cursor-pointer text-xs outline-none focus-visible:ring-1 focus-visible:ring-primary',
                  suggestModal.type === t
                    ? 'bg-background text-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Original text preview */}
        {suggestModal.originalText && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Original Code / Text:
            </Label>
            <div className="max-h-24 overflow-y-auto rounded-md border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs font-mono text-rose-700 dark:text-rose-400 select-text leading-relaxed">
              {suggestModal.originalText}
            </div>
          </div>
        )}

        {/* Suggested text input */}
        {suggestModal.type !== 'delete' && (
          <div className="space-y-1.5">
            <Label
              htmlFor="suggested-text"
              className="text-xs font-medium text-muted-foreground"
            >
              Suggested Code / Text:
            </Label>
            <textarea
              id="suggested-text"
              value={suggestModal.suggestedText}
              onChange={(e) =>
                onChangeState((prev) =>
                  prev ? { ...prev, suggestedText: e.target.value } : null,
                )
              }
              rows={3}
              placeholder="Type proposed LaTeX or text change..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/60 resize-y"
              spellCheck={false}
            />
          </div>
        )}

        {/* Optional reason / description */}
        <div className="space-y-1.5">
          <Label
            htmlFor="suggest-note"
            className="text-xs font-medium text-muted-foreground"
          >
            Reason / Note (optional):
          </Label>
          <Input
            id="suggest-note"
            value={suggestModal.description}
            onChange={(e) =>
              onChangeState((prev) =>
                prev ? { ...prev, description: e.target.value } : null,
              )
            }
            placeholder="e.g., Fix equation index, improve clarity..."
            className="h-8 text-xs"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-3 border-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 px-3 rounded-md text-xs font-medium cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSubmit}
            disabled={isPending}
            className="h-8 px-3.5 rounded-md text-xs font-medium cursor-pointer gap-1.5"
          >
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            <span>{isPending ? 'Submitting...' : 'Submit Suggestion'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export default SuggestEditModal;
