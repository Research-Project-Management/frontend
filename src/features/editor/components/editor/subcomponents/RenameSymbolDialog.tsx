'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

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
  if (!renameDialog) return null;

  return (
    <Dialog
      open={Boolean(renameDialog)}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md p-5 gap-4">
        <DialogHeader>
          <DialogTitle className="text-16 font-semibold tracking-tight text-foreground">
            Rename Occurrences
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="rename-input" className="text-xs text-muted-foreground font-normal">
            Rename{' '}
            <code className="bg-muted px-1.5 py-0.5 rounded-md font-mono text-foreground text-xs">
              {renameDialog.word}
            </code>{' '}
            to:
          </Label>
          <Input
            id="rename-input"
            ref={renameInputRef}
            value={renameDialog.newName}
            onChange={(e) => onChangeNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onApply(renameDialog.word, renameDialog.newName);
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
              }
            }}
            className="w-full font-mono text-13 h-9"
            spellCheck={false}
            autoFocus
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="h-8 px-3 rounded-md text-xs font-medium cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onApply(renameDialog.word, renameDialog.newName)}
            disabled={
              !renameDialog.newName.trim() ||
              renameDialog.newName === renameDialog.word
            }
            className="h-8 px-3 rounded-md text-xs font-medium cursor-pointer"
          >
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

export default RenameSymbolDialog;
