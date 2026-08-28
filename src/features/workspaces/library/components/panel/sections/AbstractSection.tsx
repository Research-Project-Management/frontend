'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { Paper } from '@/features/workspaces/library/types/library.types';

interface AbstractSectionProps {
  paper: Paper;
  onUpdatePaper?: (data: Partial<Paper>) => void;
}

export default function AbstractSection({ paper, onUpdatePaper }: AbstractSectionProps) {
  const [draft, setDraft] = useState(paper.abstract || '');
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(paper.abstract || '');
  }, [paper.id, paper.abstract]);

  // Auto-resize textarea to fit all content naturally without internal scroll cutoff
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [draft]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed !== (paper.abstract || '').trim()) {
      if (onUpdatePaper) {
        onUpdatePaper({ abstract: trimmed || undefined });
        toast.success('Abstract updated', { duration: 800 });
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
          <button
            type="button"
            onClick={handleCopy}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            title="Copy abstract"
            aria-label="Copy abstract"
          >
            {copied ? <Check className="size-3.5 text-emerald-500" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
          </button>
        )}
      </div>

      {/* Editable abstract card */}
      <div className="p-3 bg-muted/20 rounded-lg border border-border/30 focus-within:border-border/60 transition-colors">
        <textarea
          ref={textareaRef}
          value={draft}
          aria-label="Paper abstract summary"
          placeholder="Click to enter paper abstract summary..."
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              commit();
              textareaRef.current?.blur();
            }
          }}
          className="w-full bg-transparent text-foreground text-xs leading-relaxed outline-none resize-none placeholder:text-muted-foreground/40 select-text transition-colors"
        />
      </div>
    </div>
  );
}
