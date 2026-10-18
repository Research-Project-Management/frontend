'use client';

/**
 * RenameCitationModal.tsx
 *
 * Dedicated Dialog for Project-Wide Citation Key Renaming & Refactoring.
 * Location: `features/editor/ui/modals/citation-picker/RenameCitationModal.tsx`
 *
 * Provides a clean modal workflow for researchers:
 * - Real-time input validation (no illegal characters, no spaces, must differ from old key)
 * - Clear explanation of scope (cascades updates to all \cite commands and .bib files)
 * - Safe execution via workspaceCoordinator.refactorCitekey
 */

import React, { useState, useEffect, useId } from 'react';
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
import { validateCitationKey } from '@/features/editor/subsystems/citation/model/citation-refactor';
import { workspaceCoordinator, editorCommandBus } from '@/features/editor/core';

export interface RenameCitationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oldKey: string;
}

export const RenameCitationModal: React.FC<RenameCitationModalProps> = ({
  open,
  onOpenChange,
  oldKey,
}) => {
  const [newKey, setNewKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const inputId = useId();

  useEffect(() => {
    if (open) {
      setNewKey(oldKey || '');
      setTouched(false);
      setIsSubmitting(false);
    }
  }, [open, oldKey]);

  const validation = validateCitationKey(newKey, oldKey);
  const showError = touched && !validation.isValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);

    if (!validation.isValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await workspaceCoordinator.refactorCitekey(oldKey, newKey.trim());
      if (res.success) {
        onOpenChange(false);
        editorCommandBus.dispatch({ type: 'dialog:close', dialog: 'rename-symbol' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[440px] text-foreground bg-background border border-border shadow-raised-200 p-6 rounded-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader className="pr-6">
            <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
              Rename Citation Key (Refactor)
            </DialogTitle>
            <DialogDescription className="text-12 text-muted-foreground mt-0.5">
              Safely rename this citation key across all project <code>.tex</code>, <code>.bib</code>, and <code>.md</code> files without breaking references.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="text-xs flex items-center justify-between">
              <span className="text-muted-foreground">Current key:</span>
              <span className="font-mono bg-muted/60 px-2 py-0.5 rounded-sm text-foreground font-semibold">
                @{oldKey}
              </span>
            </div>

            <div className="space-y-1.5">
              <label htmlFor={inputId} className="text-xs font-medium text-foreground">
                New citation key:
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs select-none">
                  @
                </span>
                <Input
                  id={inputId}
                  type="text"
                  value={newKey}
                  onChange={(e) => {
                    setNewKey(e.target.value.replace(/^@/, ''));
                    setTouched(true);
                  }}
                  autoFocus
                  placeholder="e.g. vaswani2017attention"
                  className={`pl-7 font-mono text-xs ${
                    showError ? 'border-destructive focus-visible:ring-destructive' : ''
                  }`}
                />
              </div>
              {showError && (
                <p className="text-[11px] text-destructive leading-tight font-medium mt-1">
                  {validation.error}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-8 text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!validation.isValid || isSubmitting}
              className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-none"
            >
              {isSubmitting ? 'Updating...' : 'Rename Key'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RenameCitationModal;
