'use client';

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/shared/lib/utils';

export interface InlineFieldProps {
  value: string;
  itemKey?: string;
  ariaLabel?: string;
  onSave: (val: string) => void;
  onChange?: (val: string) => void;
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
  itemKey,
  ariaLabel,
  onSave,
  onChange,
  className,
  mono,
  readOnly = false,
}: InlineFieldProps) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeItemKeyRef = useRef(itemKey);
  const focusedItemKeyRef = useRef(itemKey);
  const focusedInitialValueRef = useRef(value);

  useEffect(() => {
    const isFocused =
      typeof document !== 'undefined' && document.activeElement === inputRef.current;
    activeItemKeyRef.current = itemKey;
    if (!isFocused) {
      setDraft(value);
    }
  }, [value, itemKey]);

  const handleFocus = () => {
    focusedItemKeyRef.current = itemKey;
    focusedInitialValueRef.current = value;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const newVal = e.target.value;
    setDraft(newVal);
    onChange?.(newVal);
  };

  const handleBlur = () => {
    if (readOnly) return;
    // Guard against cross-item draft corruption when switching active items mid-edit
    if (
      (itemKey !== undefined && focusedItemKeyRef.current !== activeItemKeyRef.current) ||
      (itemKey === undefined && focusedInitialValueRef.current !== value)
    ) {
      setDraft(value);
      return;
    }
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
          'w-full h-7 text-foreground px-2 py-1 rounded-md text-13 leading-normal font-normal truncate whitespace-nowrap select-text flex items-center font-sans',
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
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={cn(
        'w-full flex-1 min-w-0 h-7 bg-transparent text-foreground px-2 py-1 rounded-md border border-transparent outline-none text-13 leading-normal font-normal truncate transition-colors font-sans',
        'hover:bg-muted focus:bg-background focus:border-primary focus:ring-1 focus:ring-ring focus:hover:bg-background',
        mono && 'font-mono text-11 tabular-nums tracking-normal',
        className,
      )}
    />
  );
}

export default InlineField;
