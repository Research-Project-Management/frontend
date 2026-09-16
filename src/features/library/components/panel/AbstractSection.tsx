'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Item } from '@/features/library/types/library.types';

interface AbstractSectionProps {
  paper: Item;
  onUpdatePaper?: (data: Partial<Item>) => void;
  hideHeader?: boolean;
}

function getAbstractValue(p: Item): string {
  const item = p as Item & {
    abstractNote?: string;
  };
  return item.abstract || item.abstractNote || '';
}

export default function AbstractSection({
  paper,
  onUpdatePaper,
  hideHeader = false,
}: AbstractSectionProps) {
  const currentAbstract = getAbstractValue(paper);
  const [draft, setDraft] = useState(currentAbstract);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // On paper change, initialize draft directly from backend canonical abstract
  useEffect(() => {
    setDraft(currentAbstract || '');
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
        } as unknown as Partial<Item>);
      }
    }
  }, [draft, paper, onUpdatePaper]);

  return (
    <div className="space-y-1.5 text-xs min-w-0 font-sans">
      {!hideHeader && (
        <div className="flex items-center justify-between px-0.5 pb-0.5">
          <span className="font-sans font-medium text-foreground text-12">Abstract</span>
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
          className="w-full bg-transparent p-2.5 text-foreground text-12 leading-normal outline-none resize-none select-text font-sans focus:outline-none focus-visible:outline-none placeholder:text-muted-foreground/60 text-left"
        />
      </div>
    </div>
  );
}
