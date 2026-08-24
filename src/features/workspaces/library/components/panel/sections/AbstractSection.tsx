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
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 280)}px`;
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
    <div className="space-y-2 text-xs">
      {/* Top clean action row (Copy button only) */}
      {draft.trim() && (
        <div className="flex items-center justify-end">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-medium cursor-pointer transition-colors px-2 py-0.5 rounded hover:bg-muted"
            title="Copy abstract text"
          >
            {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      )}

      {/* Unconstrained, natural-flowing editable abstract */}
      <textarea
        ref={textareaRef}
        value={draft}
        placeholder="Click to enter abstract summary..."
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            commit();
            textareaRef.current?.blur();
          }
        }}
        className="w-full bg-transparent text-foreground/90 font-serif text-xs leading-relaxed outline-none resize-none placeholder:font-sans placeholder:text-muted-foreground/30 p-1 select-text transition-colors"
      />
    </div>
  );
}
