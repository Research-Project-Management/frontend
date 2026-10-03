/**
 * MathInlinePopover.tsx
 *
 * In-place floating Math Editor anchored directly to clicked equation (Overleaf 1:1 Parity).
 * Features:
 * - Floating positioning relative to the clicked KaTeX widget.
 * - Live KaTeX real-time preview.
 * - Keyboard shortcuts: Enter / Ctrl+Enter to save, Esc to cancel.
 * - Quick symbol injection chips (\frac, \sqrt, \alpha, etc.).
 */

import React, { useState, useEffect, useRef } from 'react';
import { Sigma, Check, X } from 'lucide-react';
import { renderMathHtml } from '../../../utils/latex-converter.util';
import type { MathPopoverTrigger } from './latex-visual-plugin';

interface MathInlinePopoverProps {
  trigger: MathPopoverTrigger | null;
  onApply: (newMath: string, from: number, to: number, isDisplay: boolean) => void;
  onClose: () => void;
}

const QUICK_MATH = [
  { label: '\\frac', snippet: '\\frac{a}{b}' },
  { label: '\\sqrt', snippet: '\\sqrt{x}' },
  { label: '\\sum', snippet: '\\sum_{i=1}^{n}' },
  { label: '\\int', snippet: '\\int_{a}^{b}' },
  { label: '\\alpha', snippet: '\\alpha' },
  { label: '\\beta', snippet: '\\beta' },
  { label: '\\theta', snippet: '\\theta' },
  { label: '\\infty', snippet: '\\infty' },
  { label: '\\le', snippet: '\\le' },
  { label: '\\ge', snippet: '\\ge' },
];

export function MathInlinePopover({ trigger, onApply, onClose }: MathInlinePopoverProps) {
  const [formula, setFormula] = useState(trigger?.math ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!trigger) return;
    setFormula(trigger.math);
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
    return () => clearTimeout(timer);
  }, [trigger]);

  if (!trigger) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const handleSave = () => {
    const trimmed = formula.trim();
    if (!trimmed) {
      onClose();
      return;
    }
    onApply(trimmed, trigger.from, trigger.to, trigger.isDisplay);
    onClose();
  };

  // Position calculation
  const top = Math.min(window.innerHeight - 250, Math.max(10, trigger.anchorRect.bottom + 8));
  const left = Math.min(window.innerWidth - 420, Math.max(16, trigger.anchorRect.left));

  const previewHtml = renderMathHtml(formula || ' ', trigger.isDisplay);

  return (
    <div
      className="fixed z-[100] w-96 rounded-lg border border-border bg-popover text-popover-foreground p-3.5 shadow-raised-300 animate-in fade-in zoom-in-95 duration-150 select-none"
      style={{ top, left }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border/50 text-xs font-semibold">
        <div className="flex items-center gap-1.5 text-primary">
          <Sigma className="size-3.5" />
          <span>Edit LaTeX Math (In-place)</span>
          <span className="text-10 text-muted-foreground font-normal">
            {trigger.isDisplay ? '$$ Display $$' : '$ Inline $'}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground cursor-pointer rounded-sm p-0.5"
          title="Close (Esc)"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Input */}
      <div className="my-2.5">
        <input
          ref={inputRef}
          type="text"
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
          placeholder="e.g. \frac{a}{b} + c^2 = d"
        />
      </div>

      {/* Quick symbol chips */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1.5 no-scrollbar">
        {QUICK_MATH.map((m) => (
          <button
            key={m.label}
            type="button"
            onClick={() => setFormula((prev) => `${prev} ${m.snippet}`.trim())}
            className="px-1.5 py-0.5 rounded-sm bg-muted/60 hover:bg-muted text-10 font-mono text-muted-foreground hover:text-foreground shrink-0 cursor-pointer transition-colors"
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Live Preview Box */}
      <div className="my-2 p-2.5 rounded-md bg-muted/30 border border-border/40 min-h-[44px] flex items-center justify-center overflow-x-auto text-sm">
        <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-1.5 border-t border-border/40 text-11 text-muted-foreground">
        <span>Press Enter to save</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-2.5 py-1 rounded-sm bg-primary text-primary-foreground hover:bg-primary-hover font-medium flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
          >
            <Check className="size-3" />
            <span>Apply</span>
          </button>
        </div>
      </div>
    </div>
  );
}
