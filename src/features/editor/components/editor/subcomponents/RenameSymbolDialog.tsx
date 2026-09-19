'use client';

import React from 'react';
import { createPortal } from 'react-dom';

export interface RenameDialogState {
  word: string;
  newName: string;
}

export interface RenameSymbolDialogProps {
  renameDialog: RenameDialogState | null;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  onChangeNewName: (name: string) => void;
  onApply: (word: string, newName: string) => void;
  onCancel: () => void;
}

export const RenameSymbolDialog = React.memo(function RenameSymbolDialog({
  renameDialog,
  renameInputRef,
  onChangeNewName,
  onApply,
  onCancel,
}: RenameSymbolDialogProps) {
  if (!renameDialog || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-dialog-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/50 backdrop-blur-xs"
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4 space-y-3 shadow-raised-200">
        <h2
          id="rename-dialog-title"
          className="text-sm font-semibold text-foreground"
        >
          Rename Occurrences
        </h2>
        <div className="space-y-1">
          <label
            htmlFor="rename-input"
            className="text-xs text-muted-foreground"
          >
            Rename{' '}
            <code className="bg-muted px-1 py-0.5 rounded font-mono text-foreground">
              {renameDialog.word}
            </code>{' '}
            to:
          </label>
          <input
            id="rename-input"
            ref={renameInputRef}
            value={renameDialog.newName}
            onChange={(e) => onChangeNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter')
                onApply(renameDialog.word, renameDialog.newName);
              if (e.key === 'Escape') onCancel();
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono outline-none focus:ring-2 focus:ring-ring"
            spellCheck={false}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onApply(renameDialog.word, renameDialog.newName)}
            disabled={
              !renameDialog.newName.trim() ||
              renameDialog.newName === renameDialog.word
            }
            className="px-3 py-1.5 rounded-md text-xs bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Rename
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
});
