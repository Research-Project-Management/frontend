'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check } from 'lucide-react';
import { useLibraryClipboard } from '@/features/workspaces/library/hooks/library/use-clipboard';
import type { CatalogItem } from '@/features/workspaces/library/types/library.types';

interface AbstractSectionProps {
  paper: CatalogItem;
  onUpdatePaper?: (data: Partial<CatalogItem>) => void;
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
  const { copyToClipboard } = useLibraryClipboard();

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
    copyToClipboard(draft.trim(), 'Abstract copied to clipboard');
    if (draft.trim()) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-2 text-xs min-w-0">
      {/* Header bar */}
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-foreground">
            Abstract
          </h3>

          {draft.trim() && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs text-foreground hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              aria-label="Copy abstract"
            >
              {copied ? (
                <Check className="size-3 text-foreground" />
              ) : (
                <Copy className="size-3 text-foreground" />
              )}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}
        </div>
      )}

      {/* Editable abstract */}
      <div className="space-y-1.5">
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
          className="w-full bg-transparent rounded-md border border-border/60 focus:border-primary p-2 text-foreground text-xs leading-relaxed outline-none resize-none select-text font-sans focus:outline-none focus-visible:outline-none"
        />
        {draft.trim() && (
          <div className="flex items-center justify-end text-[11px] font-mono text-foreground select-none">
            <span>
              {draft.trim().split(/\s+/).filter(Boolean).length} words • {draft.trim().length} chars
            </span>
          </div>
        )}
      </div>
    </div>
  );
}




