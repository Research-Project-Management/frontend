"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/shared/lib/utils";

export interface InlineTextareaProps {
  value: string;
  itemKey?: string;
  placeholder?: string;
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
  itemKey,
  placeholder,
  ariaLabel,
  onSave,
  className,
  rows = 1,
  readOnly = false,
}: InlineTextareaProps) {
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeItemKeyRef = useRef(itemKey);
  const focusedItemKeyRef = useRef(itemKey);
  const focusedInitialValueRef = useRef(value);

  useEffect(() => {
    const isFocused =
      typeof document !== 'undefined' && document.activeElement === textareaRef.current;
    activeItemKeyRef.current = itemKey;
    if (!isFocused) {
      setDraft(value);
    }
  }, [value, itemKey]);

  const handleFocus = () => {
    focusedItemKeyRef.current = itemKey;
    focusedInitialValueRef.current = value;
  };

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const borderOffset = el.offsetHeight - el.clientHeight;
    el.style.height = `${Math.max(28, el.scrollHeight + borderOffset)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [draft, adjustHeight]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
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
          "w-full min-h-7 text-foreground px-2 py-1 rounded-md text-13 leading-normal font-normal break-words [overflow-wrap:anywhere] whitespace-pre-wrap select-text font-sans",
          className,
        )}
      >
        {value || ""}
      </div>
    );
  }

  const commit = () => {
    // Guard against cross-item draft corruption when switching active items mid-edit
    if (
      (itemKey !== undefined && focusedItemKeyRef.current !== activeItemKeyRef.current) ||
      (itemKey === undefined && focusedInitialValueRef.current !== value)
    ) {
      setDraft(value);
      return;
    }
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
      placeholder={placeholder}
      aria-label={ariaLabel || "Text area"}
      onFocus={handleFocus}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          commit();
          (e.target as HTMLTextAreaElement).blur();
        } else if (e.key === "Escape") {
          setDraft(value);
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
      className={cn(
        "w-full min-h-7 bg-transparent text-foreground px-2 py-1 rounded-md border border-transparent hover:bg-muted focus:border-primary focus:ring-1 focus:ring-ring focus:bg-background outline-none text-13 leading-normal font-normal resize-none overflow-hidden break-words [overflow-wrap:anywhere] select-text focus:outline-none focus-visible:outline-none font-sans",
        className,
      )}
    />
  );
}

export default InlineTextarea;
