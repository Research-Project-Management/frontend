'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/shared/lib/utils';

export interface InlineTextareaProps {
  value: string;
  ariaLabel?: string;
  onSave: (val: string) => void;
  className?: string;
  rows?: number;
  readOnly?: boolean;
}

/**
 * Clean Inline Editable Auto-Expanding Textarea
 * Used for Title and Abstract editing.
 */
export function InlineTextarea({
  value,
  ariaLabel,
  onSave,
  className,
  rows = 1,
  readOnly = false,
}: InlineTextareaProps) {
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(28, el.scrollHeight)}px`;
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

  if (readOnly) {
    return (
      <div
        className={cn(
          'w-full min-h-7 text-foreground px-2 py-1 rounded-md text-12 leading-normal font-normal break-words [overflow-wrap:anywhere] whitespace-pre-wrap select-text font-sans',
          className,
        )}
      >
        {value || ''}
      </div>
    );
  }

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed !== value) {
      onSave(trimmed);
    }
  };

  return (
    <textarea
      ref={textareaRef}
      rows={rows}
      value={draft}
      aria-label={ariaLabel || 'Text area'}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          commit();
          (e.target as HTMLTextAreaElement).blur();
        } else if (e.key === 'Escape') {
          setDraft(value);
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
      className={cn(
        'w-full min-h-7 bg-transparent text-foreground px-2 py-1 rounded-md border border-transparent focus:border-primary focus:ring-1 focus:ring-primary focus:bg-background outline-none text-12 leading-normal font-normal resize-none overflow-hidden break-words [overflow-wrap:anywhere] select-text focus:outline-none focus-visible:outline-none font-sans',
        className,
      )}
    />
  );
}

export default InlineTextarea;
