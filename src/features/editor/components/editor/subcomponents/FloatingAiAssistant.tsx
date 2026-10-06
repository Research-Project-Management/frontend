'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Bot,
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
import { useFloatingAiActions } from '../hooks/useFloatingAiActions';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
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

  const { copySuggestion, applySuggestion, notifyAiError } = useFloatingAiActions();

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
      notifyAiError('Failed to generate AI suggestion');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result?.suggestedText) return;
    copySuggestion(result.suggestedText, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleApply = (mode: 'replace' | 'insert-below') => {
    if (!result?.suggestedText) return;
    applySuggestion(result.suggestedText, mode, onApplyEdit, onClose);
  };

  if (!isOpen || typeof document === 'undefined') return null;

  // Calculate clamped viewport positions to avoid overflowing window edges
  const clampedX = Math.max(16, Math.min(position.x, window.innerWidth - 460));
  const clampedY = Math.max(60, Math.min(position.y + 10, window.innerHeight - 380));

  return createPortal(
    <div
      className="fixed z-50 w-[440px] rounded-lg border border-border bg-popover text-popover-foreground shadow-raised-300 flex flex-col overflow-hidden text-xs animate-in fade-in-50 zoom-in-95 duration-150"
      style={{ left: clampedX, top: clampedY }}
    >
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border bg-background">
        <div className="flex items-center gap-2">
          <div className="size-5 rounded-md bg-ai/10 text-ai flex items-center justify-center">
            <Bot className="size-3.5" />
          </div>
          <span className="font-semibold text-foreground tracking-tight">Flux AI Assist</span>
          <span className="text-10 text-muted-foreground font-mono">
            (Lines {startLine}-{endLine})
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close AI Assist"
          className="size-5 p-0 rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
        >
          <X className="size-3.5" />
        </Button>
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
              ? 'bg-ai text-ai-foreground font-medium'
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
              ? 'bg-ai text-ai-foreground font-medium'
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
              ? 'bg-ai text-ai-foreground font-medium'
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
              ? 'bg-ai text-ai-foreground font-medium'
              : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80',
          )}
        >
          <Languages className="size-3 shrink-0" />
          <span>Translate to English</span>
        </button>
      </div>

      {/* ── Custom Instruction Input ──────────────────────────── */}
      <div className="px-2.5 py-1.5 border-b border-border bg-muted/20 flex items-center gap-1.5">
        <Input
          type="text"
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleExecute('custom', customPrompt);
          }}
          placeholder="Or ask AI custom change (e.g. rewrite in passive voice)..."
          disabled={isLoading}
          className="h-7 text-xs bg-background placeholder:text-muted-foreground/60"
        />
        <Button
          type="button"
          size="icon"
          onClick={() => handleExecute('custom', customPrompt)}
          disabled={isLoading || !customPrompt.trim()}
          className="size-7 shrink-0 cursor-pointer"
        >
          <ArrowRight className="size-3.5" />
        </Button>
      </div>

      {/* ── Diff / Result Preview ─────────────────────────────── */}
      <div className="p-3 max-h-56 overflow-y-auto space-y-2.5 bg-background">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="size-6 animate-spin text-ai" />
            <span className="text-xs">Polishing academic text...</span>
          </div>
        ) : result ? (
          <>
            {/* Original with Strikethrough */}
            <div className="space-y-1">
              <span className="text-10 font-semibold text-destructive tracking-normal">
                Original ({result.diffSummary.wordsOriginal} words)
              </span>
              <div className="p-2 rounded-md bg-destructive/10 border border-destructive/20 text-destructive font-mono text-11 leading-relaxed line-through whitespace-pre-wrap select-text">
                {result.originalText}
              </div>
            </div>

            {/* Suggested Replacement */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-10 font-semibold text-success tracking-normal">
                  Suggested ({result.diffSummary.wordsSuggested} words)
                </span>
                <span className="text-10 font-mono text-muted-foreground">
                  {result.diffSummary.wordsSuggested - result.diffSummary.wordsOriginal >= 0
                    ? `+${result.diffSummary.wordsSuggested - result.diffSummary.wordsOriginal} words`
                    : `${result.diffSummary.wordsSuggested - result.diffSummary.wordsOriginal} words`}
                </span>
              </div>
              <div className="p-2 rounded-md bg-success/10 border border-success/20 text-foreground font-mono text-11 leading-relaxed whitespace-pre-wrap select-text">
                {result.suggestedText}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* ── Action Buttons ────────────────────────────────────── */}
      <div className="p-2.5 border-t border-border bg-background flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={!result || isLoading}
            title="Copy suggested text"
            className="h-7 px-2 text-xs gap-1 cursor-pointer"
          >
            {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </Button>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleApply('insert-below')}
            disabled={!result || isLoading}
            title="Insert suggestion below selection"
            className="h-7 px-2 text-xs font-medium gap-1 cursor-pointer"
          >
            <CornerDownRight className="size-3" />
            <span>Insert Below</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => handleApply('replace')}
            disabled={!result || isLoading}
            title="Replace selection in editor"
            className="h-7 px-2.5 text-xs font-semibold gap-1 bg-primary text-primary-foreground hover:bg-primary-hover cursor-pointer"
          >
            <Check className="size-3.5" />
            <span>Replace Selection</span>
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default FloatingAiAssistant;
