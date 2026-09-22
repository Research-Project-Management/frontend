'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { FileCheck, X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

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
  if (!suggestModal || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="suggest-dialog-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/50 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-background p-5 space-y-4 shadow-raised-300">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <FileCheck className="size-4" />
            </div>
            <div>
              <h2
                id="suggest-dialog-title"
                className="text-sm font-semibold text-foreground"
              >
                Suggest Edit (Track Changes)
              </h2>
              <p className="text-xs text-muted-foreground">
                Propose an edit on lines {suggestModal.fromLine} - {suggestModal.toLine}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Type selection */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Action:</span>
          <div className="inline-flex rounded-md p-0.5 bg-muted text-xs border border-border">
            {(['replace', 'insert', 'delete'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() =>
                  onChangeState((prev) => (prev ? { ...prev, type: t } : null))
                }
                className={cn(
                  'px-2.5 py-1 rounded-sm capitalize font-medium transition-colors cursor-pointer',
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
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Original Code / Text:
            </label>
            <div className="max-h-24 overflow-y-auto rounded-md border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs font-mono text-rose-700 dark:text-rose-400">
              {suggestModal.originalText}
            </div>
          </div>
        )}

        {/* Suggested text input */}
        {suggestModal.type !== 'delete' && (
          <div className="space-y-1">
            <label
              htmlFor="suggested-text"
              className="text-xs font-medium text-muted-foreground"
            >
              Suggested Code / Text:
            </label>
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
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              spellCheck={false}
            />
          </div>
        )}

        {/* Optional reason / description */}
        <div className="space-y-1">
          <label
            htmlFor="suggest-note"
            className="text-xs font-medium text-muted-foreground"
          >
            Reason / Note (optional):
          </label>
          <input
            id="suggest-note"
            value={suggestModal.description}
            onChange={(e) =>
              onChangeState((prev) =>
                prev ? { ...prev, description: e.target.value } : null,
              )
            }
            placeholder="e.g., Fix equation index, improve clarity..."
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isPending}
            className="px-4 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
          >
            {isPending ? 'Submitting...' : 'Submit Suggestion'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
});
