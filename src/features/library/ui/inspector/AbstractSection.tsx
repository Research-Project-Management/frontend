"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Item } from "@/features/library/domain/types/library.types";

import { cn } from "@/shared/lib/utils";

interface AbstractSectionProps {
  item?: Item;
  onUpdateItem?: (data: Partial<Item>) => void;
  hideHeader?: boolean;
  canEdit?: boolean;
}

function getAbstractValue(item: Item): string {
  return item.abstractNote || "";
}

export default function AbstractSection({
  item,
  onUpdateItem,
  hideHeader = false,
  canEdit = true,
}: AbstractSectionProps) {
  const currentAbstract = item ? getAbstractValue(item) : "";
  const [draft, setDraft] = useState(currentAbstract);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const handleUpdate = onUpdateItem;

  // On item change, initialize draft directly from backend canonical abstract
  useEffect(() => {
    setDraft(currentAbstract || "");
  }, [item?.id, currentAbstract]);

  // Auto-resize textarea to fit content naturally without jump
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(48, el.scrollHeight)}px`;
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

  const commit = useCallback(() => {
    if (!item) return;
    const trimmed = draft.trim();
    const existing = getAbstractValue(item).trim();
    if (trimmed !== existing) {
      if (handleUpdate) {
        handleUpdate({
          abstractNote: trimmed || undefined,
        });
      }
    }
  }, [draft, item, handleUpdate]);

  return (
    <div className="space-y-1 text-xs min-w-0">
      {!hideHeader && (
        <div className="flex items-center justify-between px-1 pb-0.5">
          <span className="font-sans font-medium text-foreground text-12">
            Abstract
          </span>
        </div>
      )}

      {/* Abstract Content: Flat border without card shadow, scholarly serif font */}
      <div
        className={cn(
          "rounded-md border border-border bg-background transition-colors",
          canEdit &&
            "focus-within:border-primary focus-within:ring-1 focus-within:ring-ring",
        )}
      >
        <textarea
          ref={textareaRef}
          rows={2}
          value={draft}
          placeholder={canEdit ? "Add abstract..." : "No abstract"}
          aria-label="Item abstract summary"
          readOnly={!canEdit}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              commit();
              textareaRef.current?.blur();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setDraft(currentAbstract || "");
              textareaRef.current?.blur();
            }
          }}
          className={cn(
            "w-full text-13 leading-normal text-foreground font-sans font-normal resize-none overflow-hidden outline-none break-words select-text rounded-md",
            "p-2 bg-transparent border-0 focus:outline-none focus:ring-0",
            canEdit && "cursor-text",
            !canEdit && "cursor-default",
            !draft &&
              "placeholder:font-sans placeholder:text-12 placeholder:text-muted-foreground",
          )}
        />
      </div>
    </div>
  );
}
