'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/shared/lib/utils';

export interface InlineFieldProps {
  value: string;
  ariaLabel?: string;
  onSave: (val: string) => void;
  className?: string;
  mono?: boolean;
  readOnly?: boolean;
}

/**
 * Clean Inline Editable Text Input
 * Saves on Enter / Blur, Cancels on Escape.
 */
export function InlineField({
  value,
  ariaLabel,
  onSave,
  className,
  mono,
  readOnly = false,
}: InlineFieldProps) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const handleBlur = () => {
    if (readOnly) return;
    const trimmed = draft.trim();
    if (trimmed !== value.trim()) {
      onSave(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (readOnly) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBlur();
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setDraft(value);
      inputRef.current?.blur();
    }
  };

  if (readOnly) {
    return (
      <div
        className={cn(
          'w-full h-7 text-foreground px-1.5 py-0.5 rounded-md text-12 leading-normal font-normal truncate select-text flex items-center font-sans',
          mono && 'font-mono text-11 tabular-nums tracking-normal',
          className,
        )}
      >
        {value || ''}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      aria-label={ariaLabel || 'Metadata field'}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={cn(
        'w-full h-7 bg-transparent text-foreground px-1.5 py-0.5 rounded-md border border-transparent outline-none text-12 leading-normal font-normal truncate transition-colors font-sans',
        'hover:bg-muted/40 focus:bg-background focus:border-primary focus:ring-1 focus:ring-primary focus:hover:bg-background',
        mono && 'font-mono text-11 tabular-nums tracking-normal',
        className,
      )}
    />
  );
}

export default InlineField;
