'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Sigma, Check, X, Trash2, Eye, Variable, Grid3X3 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { renderMathHtml } from '@/features/editor/domain/latex/latex-converter';
import { editorCommandBus } from '@/features/editor/core';
import { VisualMathSymbolPalette } from './VisualMathSymbolPalette';

export interface ActiveMathEditorState {
  element: HTMLElement;
  isDisplay: boolean;
  initialMath: string;
  currentMath: string;
}

export interface VisualMathEditorModalProps {
  activeMath: ActiveMathEditorState | null;
  onClose: () => void;
  onSave: (state: ActiveMathEditorState) => void;
  onDelete: (state: ActiveMathEditorState) => void;
}

export function VisualMathEditorModal({
  activeMath,
  onClose,
  onSave,
  onDelete,
}: VisualMathEditorModalProps) {
  const [currentMath, setCurrentMath] = useState<string>(activeMath?.currentMath || '');
  const [showSymbolPalette, setShowSymbolPalette] = useState<boolean>(true);
  const mathInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeMath) {
      setCurrentMath(activeMath.currentMath);
    }
  }, [activeMath]);

  const mathLivePreviewHtml = useMemo(() => {
    if (!currentMath.trim()) return '';
    return renderMathHtml(currentMath, activeMath?.isDisplay ?? false);
  }, [currentMath, activeMath?.isDisplay]);

  const handleInsertSymbol = useCallback((symbolSnippet: string) => {
    const input = mathInputRef.current;
    if (input) {
      const val = input.value;
      const start = input.selectionStart ?? val.length;
      const end = input.selectionEnd ?? val.length;
      const next = val.substring(0, start) + symbolSnippet + val.substring(end);
      setCurrentMath(next);

      setTimeout(() => {
        input.focus();
        const newPos = start + symbolSnippet.length;
        input.setSelectionRange(newPos, newPos);
      }, 0);
    } else {
      setCurrentMath((prev) => (prev ? `${prev} ${symbolSnippet}` : symbolSnippet));
    }
  }, []);

  // Allow external wizards (such as Matrix Wizard) to insert code directly into math formula
  useEffect(() => {
    return editorCommandBus.subscribe('editor:insert-text', (cmd) => {
      if (cmd.text) {
        handleInsertSymbol(cmd.text);
      }
    });
  }, [handleInsertSymbol]);

  if (!activeMath) return null;

  const handleApply = () => {
    onSave({
      ...activeMath,
      currentMath,
    });
  };

  const handleDelete = () => {
    onDelete(activeMath);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-card border border-border shadow-overlay rounded-md p-5 w-[95vw] sm:w-full max-w-2xl max-h-[90vh] flex flex-col space-y-4 overflow-hidden">
        <div className="flex items-center justify-between pb-2 border-b shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Sigma className="size-4 text-primary shrink-0" />
            <span className="font-semibold text-sm truncate">
              Edit LaTeX Math ({activeMath.isDisplay ? 'Equation Block' : 'Inline Formula'})
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'matrix-wizard' });
              }}
              className="h-7 px-2 text-xs gap-1.5 cursor-pointer font-medium relative after:absolute after:-inset-1 after:content-['']"
              title="Open Table & Matrix Wizard"
              aria-label="Open Matrix Wizard"
            >
              <Grid3X3 className="size-3.5 text-primary shrink-0" />
              <span className="hidden sm:inline">Matrix Wizard</span>
            </Button>
            <Button
              type="button"
              variant={showSymbolPalette ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setShowSymbolPalette((prev) => !prev)}
              className="h-7 px-2 text-xs gap-1.5 cursor-pointer font-medium relative after:absolute after:-inset-1 after:content-['']"
              title="Toggle Quick-Symbol Palette"
              aria-label="Toggle math symbol palette"
            >
              <Variable className="size-3.5 text-primary shrink-0" />
              <span className="hidden sm:inline">{showSymbolPalette ? 'Hide Symbols' : 'Quick Symbols'}</span>
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer relative after:absolute after:-inset-1.5 after:content-['']"
              aria-label="Close math editor"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
          {/* KaTeX Quick-Symbol & Template Palette */}
          {showSymbolPalette && (
            <VisualMathSymbolPalette onInsertSymbol={handleInsertSymbol} />
          )}

          {/* LaTeX input */}
          <div className="space-y-1.5">
            <label htmlFor="latex-math-input-source" className="text-xs font-mono text-muted-foreground">
              LaTeX Equation Source:
            </label>
            <Input
              id="latex-math-input-source"
              ref={mathInputRef}
              aria-label="LaTeX equation input"
              value={currentMath}
              onChange={(e) => setCurrentMath(e.target.value)}
              autoFocus
              placeholder="e.g. \int_{0}^{\infty} e^{-x^2} dx = \frac{\sqrt{\pi}}{2}"
              className="font-mono text-sm h-10"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleApply();
                } else if (e.key === 'Escape') {
                  onClose();
                }
              }}
            />
          </div>

          {/* Real-time KaTeX Live Preview */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Eye className="size-3.5" />
              <span>Live Preview:</span>
            </span>
            <div
              className="min-h-16 p-4 rounded-md bg-muted/40 border border-border flex items-center justify-center overflow-x-auto text-base"
              dangerouslySetInnerHTML={{
                __html:
                  mathLivePreviewHtml ||
                  '<span class="text-xs text-muted-foreground italic">Type formula above to preview...</span>',
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-border/50 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-destructive hover:bg-destructive/10 text-xs gap-1.5 cursor-pointer h-8 relative after:absolute after:-inset-1 after:content-['']"
          >
            <Trash2 className="size-3.5" />
            <span>Delete Formula</span>
          </Button>

          <div className="flex items-center gap-2 justify-end">
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
              onClick={handleApply}
              className="text-xs gap-1.5 cursor-pointer font-medium h-8 relative after:absolute after:-inset-1 after:content-['']"
            >
              <Check className="size-3.5" />
              <span>Apply Changes</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
