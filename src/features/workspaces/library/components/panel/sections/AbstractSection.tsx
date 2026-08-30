'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import type { Paper } from '@/features/workspaces/library/types/library.types';

interface AbstractSectionProps {
  paper: Paper;
  onUpdatePaper?: (data: Partial<Paper>) => void;
  hideHeader?: boolean;
}

export default function AbstractSection({
  paper,
  onUpdatePaper,
  hideHeader = false,
}: AbstractSectionProps) {
  const currentAbstract = paper.abstract || (paper as any).abstractNote || '';
  const [draft, setDraft] = useState(currentAbstract);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(currentAbstract);
  }, [paper.id, currentAbstract]);

  // Auto-resize textarea to fit all content naturally without internal scroll cutoff
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [draft]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed !== (paper.abstract || (paper as any).abstractNote || '').trim()) {
      if (onUpdatePaper) {
        onUpdatePaper({ abstract: trimmed || undefined, abstractNote: trimmed || undefined } as any);
      }
    }
  };

  const handleCopy = () => {
    if (!draft.trim()) {
      toast.error('No abstract content to copy');
      return;
    }
    navigator.clipboard.writeText(draft.trim());
    setCopied(true);
    toast.success('Abstract copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2 text-xs min-w-0">
      {/* Header bar */}
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-foreground">
            Abstract
          </h3>

          {draft.trim() && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                    aria-label="Copy abstract"
                  >
                    {copied ? (
                      <Check className="size-3 text-foreground" />
                    ) : (
                      <Copy className="size-3 text-foreground" />
                    )}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs py-0.5 px-1.5">
                  Copy abstract text
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}

      {/* Editable abstract card */}
      <div className="p-2.5 bg-muted/20 rounded-md border border-border/40 focus-within:border-border/70 transition-colors space-y-2">
        <textarea
          ref={textareaRef}
          value={draft}
          aria-label="Paper abstract summary"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              commit();
              textareaRef.current?.blur();
            }
          }}
          className="w-full bg-transparent text-foreground text-xs leading-relaxed outline-none resize-none select-text font-sans"
        />
        {draft.trim() && (
          <div className="flex items-center justify-end pt-1 border-t border-border/20 text-xs font-mono text-muted-foreground select-none">
            <span>
              {draft.trim().split(/\s+/).filter(Boolean).length} words • {draft.trim().length} chars
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
