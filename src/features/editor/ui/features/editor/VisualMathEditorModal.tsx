'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Sigma, Check, X, Trash2, Eye, Sparkles } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { renderMathHtml } from '@/features/editor/domain/latex/latex-converter';
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

  const handleInsertSymbol = useCallback(
    (symbolSnippet: string) => {
      const input = mathInputRef.current;
      if (input) {
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        const next = currentMath.substring(0, start) + symbolSnippet + currentMath.substring(end);
        setCurrentMath(next);

        setTimeout(() => {
          input.focus();
          const newPos = start + symbolSnippet.length;
          input.setSelectionRange(newPos, newPos);
        }, 0);
      } else {
        setCurrentMath((prev) => (prev ? `${prev} ${symbolSnippet}` : symbolSnippet));
      }
    },
    [currentMath]
  );

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
      <div className="bg-card border shadow-2xl rounded-xl p-5 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b">
          <div className="flex items-center gap-2">
            <Sigma className="size-4 text-primary" />
            <span className="font-semibold text-sm">
              Edit LaTeX Math ({activeMath.isDisplay ? 'Equation Block' : 'Inline Formula'})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={showSymbolPalette ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setShowSymbolPalette((prev) => !prev)}
              className="h-7 px-2 text-xs gap-1.5 cursor-pointer font-medium"
              title="Toggle Quick-Symbol Palette"
              aria-label="Toggle math symbol palette"
            >
              <Sparkles className="size-3.5 text-primary" />
              <span>{showSymbolPalette ? 'Hide Symbols' : 'Quick Symbols'}</span>
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label="Close math editor"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

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
            className="min-h-16 p-4 rounded-lg bg-muted/40 border flex items-center justify-center overflow-x-auto text-base"
            dangerouslySetInnerHTML={{
              __html:
                mathLivePreviewHtml ||
                '<span class="text-xs text-muted-foreground italic">Type formula above to preview...</span>',
            }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-destructive hover:bg-destructive/10 text-xs gap-1.5 cursor-pointer"
          >
            <Trash2 className="size-3.5" />
            <span>Delete Formula</span>
          </Button>

          <div className="flex items-center gap-2">
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
              onClick={handleApply}
              className="text-xs gap-1.5 cursor-pointer font-medium"
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
