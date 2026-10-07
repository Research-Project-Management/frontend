'use client';

import React from 'react';
import { Tag, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';

interface HistoryLabelModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  labelText: string;
  onChangeLabelText: (text: string) => void;
  existingLabel?: string;
  onSaveLabel: () => Promise<void> | void;
  onRemoveLabel: () => Promise<void> | void;
  isSaving?: boolean;
}

export function HistoryLabelModal({
  isOpen,
  onOpenChange,
  labelText,
  onChangeLabelText,
  existingLabel,
  onSaveLabel,
  onRemoveLabel,
  isSaving = false,
}: HistoryLabelModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] rounded-md font-sans border border-border bg-popover text-popover-foreground shadow-raised-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-13 font-semibold text-foreground">
            <Tag className="size-4 text-primary" />
            <span>{existingLabel ? 'Edit version label' : 'Label this version'}</span>
          </DialogTitle>
          <DialogDescription className="text-12 text-muted-foreground pt-1 leading-relaxed">
            Assign a milestone label to bookmark key checkpoints such as submission drafts or peer review revisions.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-2">
          <label htmlFor="version-label-input" className="text-11 font-mono text-muted-foreground uppercase tracking-wide">
            Label name
          </label>
          <Input
            id="version-label-input"
            value={labelText}
            onChange={(e) => onChangeLabelText(e.target.value)}
            placeholder="e.g. Conference Submission v1"
            aria-label="Milestone version label"
            className="text-12 rounded-md h-8"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSaveLabel();
              }
            }}
          />
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2">
          {existingLabel ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isSaving}
              onClick={onRemoveLabel}
              className="rounded-md text-12 h-8"
            >
              Remove label
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
              className="rounded-md text-12 h-8"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSaving}
              onClick={onSaveLabel}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-12 h-8 flex items-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                  <span>Saving…</span>
                </>
              ) : (
                <span>Save label</span>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default HistoryLabelModal;
