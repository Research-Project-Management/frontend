'use client';

import React, { useState, useEffect } from 'react';
import { Code2, Check, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

export interface ActiveProtectedBlockEditorState {
  element: HTMLElement;
  rawLatex: string;
}

export interface VisualProtectedEditorModalProps {
  activeProtected: ActiveProtectedBlockEditorState | null;
  onClose: () => void;
  onSave: (element: HTMLElement, rawLatex: string) => void;
}

export function VisualProtectedEditorModal({
  activeProtected,
  onClose,
  onSave,
}: VisualProtectedEditorModalProps) {
  const [protectedEditCode, setProtectedEditCode] = useState<string>(
    activeProtected?.rawLatex || ''
  );

  useEffect(() => {
    if (activeProtected) {
      setProtectedEditCode(activeProtected.rawLatex);
    }
  }, [activeProtected]);

  if (!activeProtected) return null;

  const handleSave = () => {
    onSave(activeProtected.element, protectedEditCode.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-card border border-border shadow-overlay rounded-md p-5 w-[95vw] sm:w-full max-w-2xl max-h-[90vh] flex flex-col space-y-4 overflow-hidden">
        <div className="flex items-center justify-between pb-2 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Code2 className="size-4 text-primary" />
            <span className="font-semibold text-sm">Edit Protected LaTeX Environment</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer relative after:absolute after:-inset-1.5 after:content-['']"
            aria-label="Close protected block editor"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-1.5 flex-1 min-h-0 flex flex-col">
          <label htmlFor="raw-latex-env-textarea" className="text-xs font-mono text-muted-foreground shrink-0">
            Raw LaTeX Environment:
          </label>
          <textarea
            id="raw-latex-env-textarea"
            aria-label="Raw LaTeX Environment"
            value={protectedEditCode}
            onChange={(e) => setProtectedEditCode(e.target.value)}
            rows={10}
            className="w-full flex-1 min-h-[160px] font-mono text-xs p-3 rounded-md border border-border bg-muted/20 outline-none focus:ring-1 focus:ring-primary leading-relaxed resize-y"
            autoFocus
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs cursor-pointer h-8 relative after:absolute after:-inset-1 after:content-['']"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            className="text-xs gap-1.5 cursor-pointer font-medium h-8 relative after:absolute after:-inset-1 after:content-['']"
          >
            <Check className="size-3.5" />
            <span>Save Environment</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
