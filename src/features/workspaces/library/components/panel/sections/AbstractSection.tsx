'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import type { Paper } from '@/features/workspaces/library/types/library.types';

interface AbstractSectionProps {
  paper: Paper;
  onUpdatePaper?: (data: Partial<Paper>) => void;
}

export default function AbstractSection({ paper, onUpdatePaper }: AbstractSectionProps) {
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
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 200)}px`;
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
    <div className="space-y-3 text-xs min-w-0">
      {/* Header bar */}
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
                  className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                  aria-label="Copy abstract"
                >
                  {copied ? <Check className="size-3.5 text-emerald-500" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-[11px] py-1 px-2">
                Copy abstract
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Editable abstract card */}
      <div className="p-2.5 bg-muted/20 rounded-lg border border-border/30 focus-within:border-border/60 transition-colors space-y-2">
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
          <div className="flex items-center justify-end pt-1 border-t border-border/10 text-[10px] font-mono text-muted-foreground/60 select-none">
            <span>
              {draft.trim().split(/\s+/).filter(Boolean).length} words • {draft.trim().length} chars
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
