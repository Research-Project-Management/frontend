'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  Check,
  Copy,
  X,
  Loader2,
  ArrowRight,
  BookOpen,
  Scissors,
  Wand2,
  Languages,
  CornerDownRight,
} from 'lucide-react';
import {
  AcademicAiService,
  type AcademicAiActionType,
  type AcademicAiActionResult,
} from '@/features/editor/services/ai-academic-assistant.service';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';

export interface FloatingAiAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText: string;
  startLine: number;
  endLine: number;
  position: { x: number; y: number };
  onApplyEdit: (newText: string, mode: 'replace' | 'insert-below') => void;
}

export function FloatingAiAssistant({
  isOpen,
  onClose,
  selectedText,
  startLine,
  endLine,
  position,
  onApplyEdit,
}: FloatingAiAssistantProps) {
  const [activeAction, setActiveAction] = useState<AcademicAiActionType>('academic-tone');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AcademicAiActionResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset or run initial action on open
  useEffect(() => {
    if (isOpen && selectedText) {
      setResult(null);
      setCustomPrompt('');
      handleExecute('academic-tone');
    }
  }, [isOpen, selectedText]);

  const handleExecute = async (action: AcademicAiActionType, custom?: string) => {
    if (!selectedText.trim()) return;
    setIsLoading(true);
    setActiveAction(action);

    try {
      const res = await AcademicAiService.executeAction({
        action,
        selectedText,
        customPrompt: custom || customPrompt,
      });
      setResult(res);
    } catch {
      toast.error('Failed to generate AI suggestion');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result?.suggestedText) return;
    navigator.clipboard.writeText(result.suggestedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied suggestion to clipboard');
  };

  const handleApply = (mode: 'replace' | 'insert-below') => {
    if (!result?.suggestedText) return;
    onApplyEdit(result.suggestedText, mode);
    toast.success(mode === 'replace' ? 'Selection replaced!' : 'Inserted below selection!');
    onClose();
  };

  if (!isOpen || typeof document === 'undefined') return null;

  // Calculate clamped viewport positions to avoid overflowing window edges
  const clampedX = Math.max(16, Math.min(position.x, window.innerWidth - 460));
  const clampedY = Math.max(60, Math.min(position.y + 10, window.innerHeight - 380));

  return createPortal(
    <div
      className="fixed z-[100000] w-[440px] rounded-lg border border-border bg-popover text-popover-foreground shadow-raised-300 flex flex-col overflow-hidden text-xs animate-in fade-in-50 zoom-in-95 duration-150"
      style={{ left: clampedX, top: clampedY }}
    >
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border bg-background">
        <div className="flex items-center gap-2">
          <div className="size-5 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles className="size-3.5" />
          </div>
          <span className="font-semibold text-foreground tracking-tight">Overleaf AI Assist</span>
          <span className="text-10 text-muted-foreground font-mono">
            (Lines {startLine}-{endLine})
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="size-5 rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* ── Quick Action Tabs (Overleaf 2024-2026 Parity) ─────── */}
      <div className="p-2 border-b border-border bg-background flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => handleExecute('academic-tone')}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-11 font-medium transition-colors cursor-pointer',
            activeAction === 'academic-tone'
              ? 'bg-primary text-primary-foreground shadow-2xs font-semibold'
              : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80',
          )}
        >
          <BookOpen className="size-3 shrink-0" />
          <span>Academic Tone</span>
        </button>

        <button
          type="button"
          onClick={() => handleExecute('make-concise')}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-11 font-medium transition-colors cursor-pointer',
            activeAction === 'make-concise'
              ? 'bg-primary text-primary-foreground shadow-2xs font-semibold'
              : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80',
          )}
        >
          <Scissors className="size-3 shrink-0" />
          <span>Make Concise</span>
        </button>

        <button
          type="button"
          onClick={() => handleExecute('fix-grammar')}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-11 font-medium transition-colors cursor-pointer',
            activeAction === 'fix-grammar'
              ? 'bg-primary text-primary-foreground shadow-2xs font-semibold'
              : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80',
          )}
        >
          <Wand2 className="size-3 shrink-0" />
          <span>Fix Grammar & Flow</span>
        </button>

        <button
          type="button"
          onClick={() => handleExecute('translate-english')}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-11 font-medium transition-colors cursor-pointer',
            activeAction === 'translate-english'
              ? 'bg-primary text-primary-foreground shadow-2xs font-semibold'
              : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80',
          )}
        >
          <Languages className="size-3 shrink-0" />
          <span>Translate to English</span>
        </button>
      </div>

      {/* ── Custom Instruction Input ──────────────────────────── */}
      <div className="px-2.5 py-1.5 border-b border-border bg-muted/20 flex items-center gap-1.5">
        <input
          type="text"
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleExecute('custom', customPrompt);
          }}
          placeholder="Or ask AI custom change (e.g. rewrite in passive voice)..."
          disabled={isLoading}
          className="flex-1 bg-transparent px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none"
        />
        <button
          type="button"
          onClick={() => handleExecute('custom', customPrompt)}
          disabled={isLoading || !customPrompt.trim()}
          className="size-6 rounded-sm bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-40 flex items-center justify-center shrink-0 transition-colors cursor-pointer shadow-2xs"
        >
          <ArrowRight className="size-3.5" />
        </button>
      </div>

      {/* ── Diff / Result Preview ─────────────────────────────── */}
      <div className="p-3 max-h-56 overflow-y-auto space-y-2.5 bg-background">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="text-xs">Polishing academic text...</span>
          </div>
        ) : result ? (
          <>
            {/* Original with Strikethrough */}
            <div className="space-y-1">
              <span className="text-10 font-semibold text-rose-500 uppercase tracking-wider">
                Original ({result.diffSummary.wordsOriginal} words)
              </span>
              <div className="p-2 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 font-mono text-11 leading-relaxed line-through whitespace-pre-wrap select-text">
                {result.originalText}
              </div>
            </div>

            {/* Suggested Replacement */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-10 font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Suggested ({result.diffSummary.wordsSuggested} words)
                </span>
                <span className="text-10 font-mono text-muted-foreground">
                  {result.diffSummary.wordsSuggested - result.diffSummary.wordsOriginal >= 0
                    ? `+${result.diffSummary.wordsSuggested - result.diffSummary.wordsOriginal} words`
                    : `${result.diffSummary.wordsSuggested - result.diffSummary.wordsOriginal} words`}
                </span>
              </div>
              <div className="p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-foreground font-mono text-11 leading-relaxed whitespace-pre-wrap select-text">
                {result.suggestedText}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* ── Action Buttons ────────────────────────────────────── */}
      <div className="p-2.5 border-t border-border bg-background flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!result || isLoading}
            title="Copy suggested text"
            className="flex items-center gap-1 px-2 py-1 rounded-sm border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground text-11 transition-colors cursor-pointer disabled:opacity-40"
          >
            {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleApply('insert-below')}
            disabled={!result || isLoading}
            title="Insert suggestion below selection"
            className="flex items-center gap-1 px-2 py-1 rounded-sm border border-border bg-background hover:bg-muted text-foreground text-11 font-medium transition-colors cursor-pointer disabled:opacity-40"
          >
            <CornerDownRight className="size-3" />
            <span>Insert Below</span>
          </button>

          <button
            type="button"
            onClick={() => handleApply('replace')}
            disabled={!result || isLoading}
            title="Replace selection in editor"
            className="flex items-center gap-1 px-2.5 py-1 rounded-sm bg-primary hover:bg-primary-hover text-primary-foreground text-11 font-semibold transition-colors cursor-pointer shadow-2xs disabled:opacity-40"
          >
            <Check className="size-3.5" />
            <span>Replace Selection</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default FloatingAiAssistant;
