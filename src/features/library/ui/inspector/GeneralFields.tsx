'use client';

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { type Item, SchemaItemTypeDefinition, ALL_ITEM_TYPES_FLAT, getTitleFieldForType } from '@/features/library/domain/types/core.types';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { cleanValue, getItemDisplayTitle, buildExtraMetadataPatch, formatAndSanitizeExtraMetadata, isValidValue } from '@/features/library/domain/metadata.mapper';
import { buildInspectorFieldPatch } from '@/features/library/domain/item-field-schema.domain';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';

interface GeneralFieldsProps {
  item?: Item;
  currentItemType: string;
  selectableItemTypes: Array<{ value: string; label: string }>;
  typeDefinition: SchemaItemTypeDefinition;
  canEdit?: boolean;
  scopeId?: string;
  onUpdateItem?: (data: Partial<Item>) => void;
}

export function GeneralFields({
  item,
  onUpdateItem,
  currentItemType,
  selectableItemTypes,
  typeDefinition,
  canEdit = true,
  scopeId,
}: GeneralFieldsProps) {
  const openModal = useLibraryUIStore((s) => s.openModal);

  if (!item) return null;

  const effectiveItemTypes =
    selectableItemTypes && selectableItemTypes.length > 0
      ? selectableItemTypes
      : ALL_ITEM_TYPES_FLAT;

  const mappedTitleKey = getTitleFieldForType(currentItemType);
  const titleFieldDef = typeDefinition?.fields?.find(
    (f) => f.field === mappedTitleKey || f.baseField === "title",
  );
  const titleLabel = titleFieldDef?.label || "Title";
  const displayTitleValue = cleanValue(getItemDisplayTitle(item) || item.title);

  const handleTitleChange = (val: string) => {
    const trimmed = val.replace(/\r?\n+/g, " ").trim();
    if (!trimmed) {
      return;
    }
    const patch = buildInspectorFieldPatch(
      item,
      mappedTitleKey || "title",
      trimmed,
    );
    onUpdateItem?.(patch);
  };

  return (
    <>
      {/* Item Type Selector */}
      <div className="grid grid-cols-[84px_1fr] gap-2 items-center py-0.5">
        <span
          className="text-muted-foreground text-right font-medium select-none pr-1 text-11 leading-normal whitespace-nowrap truncate"
          id="label-item-type"
        >
          Item Type
        </span>
        <div className="flex items-center gap-1.5 min-w-0 w-full">
          {canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="w-full h-7 text-left px-2 py-1 rounded-md border border-transparent hover:bg-muted focus:bg-background focus:border-primary focus:ring-1 focus:ring-ring data-[state=open]:border-primary data-[state=open]:bg-muted text-13 leading-normal font-normal text-foreground bg-transparent cursor-pointer outline-none select-none flex items-center justify-between"
                  aria-label="Item Type"
                >
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <span className="truncate whitespace-nowrap">
                      {effectiveItemTypes.find(
                        (t) => t.value === currentItemType,
                      )?.label ||
                        typeDefinition.label ||
                        currentItemType}
                    </span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={4}
                collisionPadding={8}
                className="max-h-[360px] w-60 min-w-[200px] overflow-y-auto p-1 rounded-md shadow-raised-200 border border-border bg-popover text-popover-foreground space-y-0.5 z-50 thin-scrollbar"
              >
                {effectiveItemTypes.map((t) => {
                  const isSelected = t.value === currentItemType;
                  return (
                    <DropdownMenuItem
                      key={t.value}
                      onClick={() => {
                        if (t.value === currentItemType) return;
                        openModal("TYPE_CONVERSION", {
                          item,
                          itemId: item.id,
                          currentType: currentItemType,
                          targetType: t.value,
                          itemTitle: item.title,
                          scopeId,
                        });
                      }}
                      className={cn(
                        "flex items-center justify-between h-7.5 px-2.5 text-13 font-normal rounded-md cursor-pointer text-foreground hover:bg-muted select-none transition-colors",
                        isSelected && "bg-muted text-foreground font-medium",
                      )}
                    >
                      <span className="truncate pr-2">{t.label}</span>
                      {isSelected && (
                        <Check
                          className="size-3.5 text-primary shrink-0"
                          strokeWidth={1.5}
                        />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="w-full h-7 text-left px-2 py-1 text-13 leading-normal font-normal text-foreground flex items-center select-text font-sans truncate">
              <span className="truncate whitespace-nowrap">
                {effectiveItemTypes.find((t) => t.value === currentItemType)
                  ?.label ||
                  typeDefinition.label ||
                  currentItemType}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="grid grid-cols-[84px_1fr] gap-2 items-start py-0.5">
        <span
          className="text-muted-foreground text-right font-medium select-none pr-1 pt-1 text-11 leading-normal whitespace-nowrap truncate"
          id="label-title"
        >
          {titleLabel}
        </span>
        <InlineTextarea
          itemKey={`${item.id}-title`}
          value={displayTitleValue}
          ariaLabel="Item Title"
          onSave={handleTitleChange}
          className="font-normal text-foreground text-13 leading-normal"
          rows={1}
          readOnly={!canEdit}
        />
      </div>
    </>
  );
}

/** Format ISO date into locale format (e.g. 8/20/2026, 3:53:43 PM) */
function formatAuditDate(dateStr?: string | Date | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

interface ExtraAuditFieldsProps {
  item?: Item;
  canEdit?: boolean;
  onUpdateItem?: (data: Partial<Item>) => void;
}

export function ExtraAuditFields({
  item,
  onUpdateItem,
  canEdit = true,
}: ExtraAuditFieldsProps) {
  const formattedExtraMetadata = useMemo(() => {
    if (!item) return "";
    return formatAndSanitizeExtraMetadata(item.extra, item.extraFields, item);
  }, [item]);

  const handleExtraSave = (savedValue: string) => {
    if (!item) return;
    onUpdateItem?.(buildExtraMetadataPatch(item, savedValue));
  };

  if (!item) return null;

  return (
    <>
      {/* Extra Field - Available when populated or in edit mode */}
      {(canEdit || isValidValue(formattedExtraMetadata)) && (
        <div className="grid grid-cols-[84px_1fr] gap-2 items-start py-0.5">
          <span
            className="text-foreground text-right font-normal select-none pr-1 text-12 leading-normal whitespace-nowrap truncate pt-1"
            id="label-extra"
          >
            Extra
          </span>
          <InlineTextarea
            itemKey={`${item.id}-extra`}
            value={formattedExtraMetadata}
            ariaLabel="Extra"
            rows={Math.min(
              4,
              Math.max(
                1,
                formattedExtraMetadata
                  ? formattedExtraMetadata.split("\n").length
                  : 1,
              ),
            )}
            onSave={handleExtraSave}
            readOnly={!canEdit}
          />
        </div>
      )}

      {/* Date Added */}
      {isValidValue(item.createdAt) && (
        <div className="grid grid-cols-[84px_1fr] gap-2 items-center py-0.5">
          <span className="text-foreground text-right font-normal select-none pr-1 text-12 leading-normal whitespace-nowrap truncate">
            Date Added
          </span>
          <span className="text-foreground text-12 leading-normal px-2 py-1 select-text truncate whitespace-nowrap font-normal h-7 flex items-center font-sans">
            {formatAuditDate(item.createdAt)}
          </span>
        </div>
      )}

      {/* Modified */}
      {isValidValue(item.updatedAt) && (
        <div className="grid grid-cols-[84px_1fr] gap-2 items-center py-0.5">
          <span className="text-foreground text-right font-normal select-none pr-1 text-12 leading-normal whitespace-nowrap truncate">
            Modified
          </span>
          <span className="text-foreground text-12 leading-normal px-2 py-1 select-text truncate whitespace-nowrap font-normal h-7 flex items-center font-sans">
            {formatAuditDate(item.updatedAt)}
          </span>
        </div>
      )}
    </>
  );
}

export default GeneralFields;

interface InlineFieldProps {
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
  const draftRef = useRef(value);
  const skipBlurCommitRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeItemKeyRef = useRef(itemKey);
  const focusedItemKeyRef = useRef(itemKey);
  const focusedInitialValueRef = useRef(value);

  useEffect(() => {
    const isFocused =
      typeof document !== 'undefined' && document.activeElement === inputRef.current;
    activeItemKeyRef.current = itemKey;
    if (!isFocused) {
      draftRef.current = value;
      setDraft(value);
    }
  }, [value, itemKey]);

  const handleFocus = () => {
    skipBlurCommitRef.current = false;
    focusedItemKeyRef.current = itemKey;
    focusedInitialValueRef.current = value;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const newVal = e.target.value;
    draftRef.current = newVal;
    setDraft(newVal);
    onChange?.(newVal);
  };

  const handleBlur = () => {
    if (readOnly) return;
    if (skipBlurCommitRef.current) {
      skipBlurCommitRef.current = false;
      return;
    }
    // Guard against cross-item draft corruption when switching active items mid-edit
    if (
      (itemKey !== undefined && focusedItemKeyRef.current !== activeItemKeyRef.current) ||
      (itemKey === undefined && focusedInitialValueRef.current !== value)
    ) {
      draftRef.current = value;
      setDraft(value);
      return;
    }
    const trimmed = draftRef.current.trim();
    if (trimmed !== value.trim()) {
      onSave(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (readOnly) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      skipBlurCommitRef.current = true;
      draftRef.current = value;
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

interface InlineTextareaProps {
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
function InlineTextarea({
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
  const draftRef = useRef(value);
  const skipBlurCommitRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeItemKeyRef = useRef(itemKey);
  const focusedItemKeyRef = useRef(itemKey);
  const focusedInitialValueRef = useRef(value);

  useEffect(() => {
    const isFocused =
      typeof document !== 'undefined' && document.activeElement === textareaRef.current;
    activeItemKeyRef.current = itemKey;
    if (!isFocused) {
      draftRef.current = value;
      setDraft(value);
    }
  }, [value, itemKey]);

  const handleFocus = () => {
    skipBlurCommitRef.current = false;
    focusedItemKeyRef.current = itemKey;
    focusedInitialValueRef.current = value;
  };

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const borderOffset = el.offsetHeight - el.clientHeight;
    el.style.height = `${Math.max(28, el.scrollHeight + borderOffset)}px`;
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
          'w-full min-h-7 text-foreground px-2 py-1 rounded-md text-13 leading-normal font-normal break-words [overflow-wrap:anywhere] whitespace-pre-wrap select-text font-sans',
          className,
        )}
      >
        {value || ''}
      </div>
    );
  }

  const commit = () => {
    if (skipBlurCommitRef.current) {
      skipBlurCommitRef.current = false;
      return;
    }
    // Guard against cross-item draft corruption when switching active items mid-edit
    if (
      (itemKey !== undefined && focusedItemKeyRef.current !== activeItemKeyRef.current) ||
      (itemKey === undefined && focusedInitialValueRef.current !== value)
    ) {
      draftRef.current = value;
      setDraft(value);
      return;
    }
    const trimmed = draftRef.current.trim();
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
      aria-label={ariaLabel || 'Text area'}
      onFocus={handleFocus}
      onChange={(e) => {
        draftRef.current = e.target.value;
        setDraft(e.target.value);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          skipBlurCommitRef.current = true;
          draftRef.current = value;
          setDraft(value);
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
      className={cn(
        'w-full min-h-7 bg-transparent text-foreground px-2 py-1 rounded-md border border-transparent hover:bg-muted focus:border-primary focus:ring-1 focus:ring-ring focus:bg-background outline-none text-13 leading-normal font-normal resize-none overflow-hidden break-words [overflow-wrap:anywhere] select-text focus:outline-none focus-visible:outline-none font-sans',
        className,
      )}
    />
  );
}
