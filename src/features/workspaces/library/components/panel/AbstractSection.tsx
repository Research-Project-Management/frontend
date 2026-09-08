'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Copy, Check, Sparkles, AlignJustify, AlignLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useCopyToClipboard } from '@/shared/hooks/use-copy-to-clipboard';
import { cleanAbstractText } from '@/features/workspaces/library/utils/library.util';
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
  const [isJustified, setIsJustified] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { copy, isCopied } = useCopyToClipboard();

  // On paper change, initialize draft. If raw abstract contains obvious year artifacts or prefix, auto-clean it.
  useEffect(() => {
    if (!currentAbstract) {
      setDraft('');
      return;
    }
    const hasYearArtifacts = /(?:\((?:19|20)\d{2}\)\s*){2,}\.?/.test(currentAbstract);
    const hasLeadingAbstractHeading = /^(?:abstract|summary)\s*[:.—\-–\u2014\u2013]?\s+/i.test(currentAbstract);

    if (hasYearArtifacts || hasLeadingAbstractHeading) {
      const sanitized = cleanAbstractText(currentAbstract);
      setDraft(sanitized);
    } else {
      setDraft(currentAbstract);
    }
  }, [currentAbstract]);

  // Auto-resize textarea to fit content naturally
  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(textareaRef.current.scrollHeight, 100)}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [draft, adjustHeight]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    const existing = getAbstractValue(paper).trim();
    if (trimmed !== existing) {
      if (onUpdatePaper) {
        onUpdatePaper({
          abstract: trimmed || undefined,
          abstractNote: trimmed || undefined,
        } as unknown as Partial<CatalogItem>);
      }
    }
  }, [draft, paper, onUpdatePaper]);

  const handleCleanAndFormat = () => {
    const cleaned = cleanAbstractText(draft);
    if (!cleaned) {
      toast.info('No content to format');
      return;
    }
    setDraft(cleaned);
    if (onUpdatePaper && cleaned !== getAbstractValue(paper).trim()) {
      onUpdatePaper({
        abstract: cleaned,
        abstractNote: cleaned,
      } as unknown as Partial<CatalogItem>);
      toast.success('Abstract formatted & cleaned', { id: 'library-abstract-format' });
    } else {
      toast.success('Abstract already clean', { id: 'library-abstract-format' });
    }
  };

  const handleCopy = async () => {
    if (!draft.trim()) return;
    const ok = await copy(draft.trim());
    if (ok) {
      toast.success('Abstract copied to clipboard', { id: 'library-clipboard' });
    }
  };

  const hasContent = draft.trim().length > 0;

  return (
    <div className="space-y-1.5 text-xs min-w-0 font-sans">
      {/* Action Toolbar */}
      {(hasContent || !hideHeader) && (
        <div className="flex items-center justify-between px-0.5 pb-0.5">
          <div>
            {!hideHeader && (
              <span className="font-sans font-medium text-foreground text-12">Abstract</span>
            )}
          </div>

          {hasContent && (
            <div className="flex items-center gap-1 ml-auto">
              {/* Clean & Format action */}
              <button
                type="button"
                onClick={handleCleanAndFormat}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-11 text-foreground hover:bg-muted cursor-pointer transition-colors"
                title="Clean artifacts (years, prefixes) and format paragraph lines"
                aria-label="Clean and format abstract text"
              >
                <Sparkles className="size-3 text-foreground shrink-0" />
                <span>Format</span>
              </button>

              {/* Alignment toggle */}
              <button
                type="button"
                onClick={() => setIsJustified((prev) => !prev)}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-11 text-foreground hover:bg-muted cursor-pointer transition-colors"
                title={isJustified ? 'Switch to left-aligned' : 'Switch to justified alignment'}
                aria-label="Toggle text alignment"
              >
                {isJustified ? (
                  <AlignJustify className="size-3 text-foreground shrink-0" />
                ) : (
                  <AlignLeft className="size-3 text-foreground shrink-0" />
                )}
                <span>{isJustified ? 'Justified' : 'Left'}</span>
              </button>

              {/* Copy action */}
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-11 text-foreground hover:bg-muted cursor-pointer transition-colors"
                aria-label="Copy abstract"
              >
                {isCopied ? (
                  <Check className="size-3 text-foreground shrink-0" />
                ) : (
                  <Copy className="size-3 text-foreground shrink-0" />
                )}
                <span>{isCopied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Editable abstract textarea */}
      <div className="rounded-md border border-border focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 bg-background transition-colors">
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
          className={`w-full bg-transparent p-2.5 text-foreground text-12 leading-normal outline-none resize-none select-text font-sans focus:outline-none focus-visible:outline-none placeholder:text-muted-foreground/60 ${
            isJustified ? 'text-justify [text-align-last:left] text-pretty' : 'text-left'
          }`}
        />
      </div>
    </div>
  );
}
