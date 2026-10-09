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
      <div className="bg-card border shadow-2xl rounded-xl p-5 w-full max-w-2xl space-y-4">
        <div className="flex items-center justify-between pb-2 border-b">
          <div className="flex items-center gap-2">
            <Code2 className="size-4 text-primary" />
            <span className="font-semibold text-sm">Edit Protected LaTeX Environment</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            aria-label="Close protected block editor"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="raw-latex-env-textarea" className="text-xs font-mono text-muted-foreground">
            Raw LaTeX Environment:
          </label>
          <textarea
            id="raw-latex-env-textarea"
            aria-label="Raw LaTeX Environment"
            value={protectedEditCode}
            onChange={(e) => setProtectedEditCode(e.target.value)}
            rows={10}
            className="w-full font-mono text-xs p-3 rounded-lg border bg-muted/20 outline-none focus:ring-1 focus:ring-primary leading-relaxed"
            autoFocus
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            className="text-xs gap-1.5 cursor-pointer font-medium"
          >
            <Check className="size-3.5" />
            <span>Save Environment</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
