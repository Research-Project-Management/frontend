'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useCopyToClipboard } from '@/shared/hooks/use-copy-to-clipboard';
import type { CatalogItem } from '@/features/workspaces/library/types/library.types';

interface AbstractSectionProps {
  paper: CatalogItem;
  onUpdatePaper?: (data: Partial<CatalogItem>) => void;
  hideHeader?: boolean;
}

function getAbstractValue(p: CatalogItem): string {
  const item = p as CatalogItem & {
    abstractNote?: string;
    extra?: { abstract?: string };
    metadata?: { abstract?: string };
    description?: string;
  };
  return (
    item.abstract ||
    item.abstractNote ||
    item.extra?.abstract ||
    item.metadata?.abstract ||
    item.description ||
    ''
  );
}

export default function AbstractSection({
  paper,
  onUpdatePaper,
  hideHeader = false,
}: AbstractSectionProps) {
  const currentAbstract = getAbstractValue(paper);
  const [draft, setDraft] = useState(currentAbstract);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { copy, isCopied } = useCopyToClipboard();

  useEffect(() => {
    setDraft(currentAbstract);
  }, [currentAbstract]);

  // Auto-resize textarea to fit content naturally
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 100)}px`;
    }
  }, [draft]);

  const commit = () => {
    const trimmed = draft.trim();
    const existing = getAbstractValue(paper).trim();
    if (trimmed !== existing) {
      if (onUpdatePaper) {
        onUpdatePaper({ abstract: trimmed || undefined, abstractNote: trimmed || undefined } as any);
      }
    }
  };

  const handleCopy = async () => {
    if (!draft.trim()) return;
    const ok = await copy(draft.trim());
    if (ok) {
      toast.success('Abstract copied to clipboard', { id: 'library-clipboard' });
    }
  };

  return (
    <div className="space-y-2 text-xs min-w-0 font-sans">
      {/* Header bar */}
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-foreground">Abstract</h3>

          {draft.trim() && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs text-foreground hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              aria-label="Copy abstract"
            >
              {isCopied ? (
                <Check className="size-3 text-foreground" />
              ) : (
                <Copy className="size-3 text-foreground" />
              )}
              <span>{isCopied ? 'Copied' : 'Copy'}</span>
            </button>
          )}
        </div>
      )}

      {/* Editable abstract */}
      <div className="space-y-1.5">
        <textarea
          ref={textareaRef}
          value={draft}
          placeholder="No abstract available. Click to add abstract..."
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
          className="w-full bg-transparent rounded-md border border-border/60 focus:border-primary p-2 text-foreground text-xs leading-relaxed outline-none resize-none select-text font-sans focus:outline-none focus-visible:outline-none placeholder:text-muted-foreground/60"
        />
      </div>
    </div>
  );
}
