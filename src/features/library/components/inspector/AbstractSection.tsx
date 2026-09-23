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

  // Auto-resize textarea to fit content naturally without jump
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(48, el.scrollHeight)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [draft, adjustHeight]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      adjustHeight();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [adjustHeight]);

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
    <div className="space-y-1 text-xs min-w-0 font-sans">
      {!hideHeader && (
        <div className="flex items-center justify-between px-1 pb-0.5">
          <span className="font-sans font-medium text-foreground text-12">Abstract</span>
        </div>
      )}

      {/* Abstract Content: Seamless auto-resizing without size jump */}
      <textarea
        ref={textareaRef}
        rows={2}
        value={draft}
        placeholder={canEdit ? "No abstract available. Click to add abstract..." : "No abstract available."}
        aria-label="Paper abstract summary"
        readOnly={!canEdit}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            commit();
            textareaRef.current?.blur();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setDraft(currentAbstract || '');
            textareaRef.current?.blur();
          }
        }}
        className={cn(
          "w-full text-12 leading-normal text-foreground font-sans resize-none overflow-hidden outline-none break-words select-text rounded-md",
          "px-1.5 py-1 border border-transparent bg-transparent transition-[border-color,background-color,box-shadow]",
          canEdit && [
            "cursor-pointer hover:bg-muted/40",
            "focus:cursor-text focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary focus:hover:bg-background",
          ],
          !canEdit && "cursor-default",
          !draft && "placeholder:italic placeholder:text-muted-foreground"
        )}
      />
    </div>
  );
}
