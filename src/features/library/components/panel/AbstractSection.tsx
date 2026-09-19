'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Item } from '@/features/library/types/library.types';

import { cn } from "@/shared/lib/utils";

interface AbstractSectionProps {
  paper: Item;
  onUpdatePaper?: (data: Partial<Item>) => void;
  hideHeader?: boolean;
  canEdit?: boolean;
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
  canEdit = true,
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

      {/* Abstract textarea */}
      <div
        className={cn(
          "rounded-md border border-border bg-background transition-colors",
          canEdit && "focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20"
        )}
      >
        <textarea
          ref={textareaRef}
          value={draft}
          readOnly={!canEdit}
          placeholder={canEdit ? "No abstract available. Click to add abstract..." : "No abstract available."}
          aria-label="Paper abstract summary"
          onChange={canEdit ? (e) => setDraft(e.target.value) : undefined}
          onBlur={canEdit ? commit : undefined}
          onKeyDown={canEdit ? (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              commit();
              textareaRef.current?.blur();
            }
          } : undefined}
          className="w-full bg-transparent p-2.5 text-foreground text-12 leading-normal outline-none resize-none select-text font-sans focus:outline-none focus-visible:outline-none placeholder:text-muted-foreground/60 text-left"
        />
      </div>
    </div>
  );
}
