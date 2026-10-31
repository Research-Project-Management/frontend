"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { Item } from "@/features/library/domain/types/core.types";
import type { ReaderDocument } from "@/features/library/domain/types/reader.schema";
import { cleanValue } from "@/features/library/domain/metadata-mapper";
import {
  getItemTypeDefinition,
  normalizeCanonicalItemType,
  mapRegistryItemTypes,
  SchemaFieldDefinition,
  SchemaItemTypeDefinition,
} from "@/features/library/domain/types/core.types";
import { toast } from "sonner";
import { cn, copyToClipboard as copyText } from "@/shared/lib/utils";
import { useItemTypes } from "@/features/library/sdk/queries/catalog.queries";
import { CreatorFields } from "./fields/CreatorFields";
import { GeneralFields, ExtraAuditFields } from "./fields/GeneralFields";
import { DynamicInspectorField } from "./fields/DynamicInspectorField";
import {
  INSPECTOR_FIELD_DESCRIPTORS,
  prepareInspectorFieldContext,
  resolveInspectorFieldValue,
  buildInspectorFieldPatch,
} from "@/features/library/domain/item-field-schema";
import {
  openInNewTab,
  buildReaderPaperUrl,
} from "@/features/library/core/coordinator/citation-export.coordinator";
import {
  LibraryInspector,
  INSPECTOR_LEVELS,
  type LibraryInspectorProps,
} from "./LibraryInspector";

export { INSPECTOR_LEVELS };

export interface InfoSectionProps {
  item?: Item;
  onUpdateItem?: (data: Partial<Item>, options?: { silent?: boolean }) => void;
  canEdit?: boolean;
  scopeId?: string;
}

const EXCLUDED_DYNAMIC_LOOP_FIELDS = new Set([
  "title",
  "casename",
  "nameofact",
  "subject",
  "abstractnote",
  "abstract",
  "extra",
  "dateadded",
  "datemodified",
]);

export function InfoSection({
  item,
  onUpdateItem,
  canEdit = true,
  scopeId: propScopeId,
}: InfoSectionProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const currentItemType = normalizeCanonicalItemType(item?.itemType);
  const scopeId = propScopeId || item?.projectId || "user";

  const { types: registryItemTypes } = useItemTypes(scopeId || undefined);

  const itemTypeDefinitions = useMemo(
    () => mapRegistryItemTypes(registryItemTypes),
    [registryItemTypes],
  );

  const selectableItemTypes = useMemo(
    () =>
      itemTypeDefinitions
        .filter(
          (t) =>
            t.isBibliographic !== false &&
            !t.isSpecial &&
            t.itemType !== "attachment" &&
            t.itemType !== "note" &&
            t.itemType !== "annotation",
        )
        .map(({ itemType, label }) => ({ value: itemType, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [itemTypeDefinitions],
  );

  const typeDefinition: SchemaItemTypeDefinition = useMemo(
    () =>
      itemTypeDefinitions.find((type) => type.itemType === currentItemType) ||
      getItemTypeDefinition(currentItemType) ||
      getItemTypeDefinition("journalArticle")!,
    [currentItemType, itemTypeDefinitions],
  );

  const preparedFieldContext = useMemo(
    () => prepareInspectorFieldContext(item),
    [item],
  );

  const displayDoi = preparedFieldContext?.displayDoi || "";

  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const copyToClipboard = async (text: string, label: string) => {
    if (!text || !text.trim()) {
      toast.error("Nothing to copy", { id: "library-clipboard" });
      return;
    }
    const ok = await copyText(text);
    if (ok) {
      toast.success(`Copied ${label}`, { id: "library-clipboard" });
      setCopiedKey(label);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedKey(null), 1500);
    } else {
      toast.error("Failed to copy to clipboard", { id: "library-clipboard" });
    }
  };

  /** Helper to retrieve value for a field definition key from item */
  const getFieldValue = useCallback(
    (fieldKey: string): string => {
      const rawVal = resolveInspectorFieldValue(
        item,
        fieldKey,
        preparedFieldContext,
      );
      const descriptor = INSPECTOR_FIELD_DESCRIPTORS[fieldKey.toLowerCase()];
      return descriptor?.formatDisplay
        ? descriptor.formatDisplay(rawVal)
        : cleanValue(rawVal);
    },
    [item, preparedFieldContext],
  );

  /**
   * Helper to save value for a dynamic field definition atomically.
   * Batches all multi-field mutations into a single onUpdateItem call
   * to eliminate 409 Version Mismatch race conditions and preserve extraFields.
   */
  const saveFieldValue = (fieldDef: SchemaFieldDefinition, val: string) => {
    if (!onUpdateItem || !item) return;
    onUpdateItem(buildInspectorFieldPatch(item, fieldDef, val));
  };

  // Render all schema fields for the selected item type in registry order
  const dynamicFields = useMemo(() => {
    const raw = (typeDefinition?.fields || []).filter(
      (f: SchemaFieldDefinition) =>
        !EXCLUDED_DYNAMIC_LOOP_FIELDS.has(f.field.toLowerCase()),
    );

    // Deduplicate against type-specific mapped venue/publisher fields if backend returned both base & mapped keys
    const fieldKeySet = new Set(raw.map((f) => f.field.toLowerCase()));
    const mappedPubTitle = typeDefinition?.fields?.find(
      (f) =>
        f.baseField === "publicationTitle" && f.field !== "publicationTitle",
    )?.field;
    return raw.filter((f: SchemaFieldDefinition) => {
      const k = f.field.toLowerCase();
      if (
        (k === "publicationtitle" || k === "journal") &&
        (mappedPubTitle ||
          fieldKeySet.has("proceedingstitle") ||
          fieldKeySet.has("booktitle") ||
          fieldKeySet.has("websitetitle") ||
          fieldKeySet.has("blogtitle") ||
          (currentItemType === "preprint" && fieldKeySet.has("repository")))
      ) {
        return false;
      }
      if (
        k === "publisher" &&
        currentItemType === "preprint" &&
        fieldKeySet.has("repository")
      ) {
        return false;
      }
      return true;
    });
  }, [typeDefinition, currentItemType]);

  if (!item) return null;

  return (
    <div className="space-y-0.5 select-text font-sans antialiased">
      {/* General Section: Warning, Item Type Selector, Title */}
      <GeneralFields
        item={item}
        currentItemType={currentItemType}
        selectableItemTypes={selectableItemTypes}
        typeDefinition={typeDefinition}
        canEdit={canEdit}
        scopeId={scopeId}
        onUpdateItem={onUpdateItem}
      />

      {/* Creators / Authors */}
      <CreatorFields
        item={item}
        typeDefinition={typeDefinition}
        canEdit={canEdit}
        onUpdateItem={onUpdateItem}
      />

      {/* Dynamic Schema Fields for Selected Item Type in Canonical Zotero Order */}
      {dynamicFields.map((fieldDef: SchemaFieldDefinition) => (
        <DynamicInspectorField
          key={`${item.id}-${fieldDef.field}`}
          fieldDef={fieldDef}
          val={getFieldValue(fieldDef.field)}
          displayDoi={displayDoi}
          copiedKey={copiedKey}
          canEdit={canEdit}
          onSave={(newVal) => saveFieldValue(fieldDef, newVal)}
          onCopy={copyToClipboard}
        />
      ))}

      {/* Extra Field, Date Added, Modified */}
      <ExtraAuditFields
        item={item}
        canEdit={canEdit}
        onUpdateItem={onUpdateItem}
      />
    </div>
  );
}

export interface AbstractSectionProps {
  item?: Item;
  onUpdateItem?: (data: Partial<Item>) => void;
  hideHeader?: boolean;
  canEdit?: boolean;
}

function getAbstractValue(item: Item): string {
  const raw =
    resolveInspectorFieldValue(item, "abstractNote") || item.abstractNote || "";
  return raw.replace(/\*\*([A-Za-z0-9\s_-]+?):\*\*/g, "$1:");
}

export function AbstractSection({
  item,
  onUpdateItem,
  hideHeader = false,
  canEdit = true,
}: AbstractSectionProps) {
  const currentAbstract = item ? getAbstractValue(item) : "";
  const [draft, setDraft] = useState(currentAbstract);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const focusedItemIdRef = useRef<string | null>(null);
  const prevItemIdRef = useRef<string | undefined>(item?.id);
  const handleUpdate = onUpdateItem;

  // On item change or background abstract update, synchronize draft cleanly
  useEffect(() => {
    const itemChanged = prevItemIdRef.current !== item?.id;
    prevItemIdRef.current = item?.id;
    const isFocused =
      typeof document !== "undefined" && document.activeElement === textareaRef.current;
    if (itemChanged) {
      focusedItemIdRef.current = isFocused ? (item?.id ?? null) : null;
      setDraft(currentAbstract || "");
      return;
    }
    if (!isFocused) {
      setDraft(currentAbstract || "");
    }
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
    if (!item || (focusedItemIdRef.current && focusedItemIdRef.current !== item.id)) {
      return;
    }
    const trimmed = draft.trim();
    const existing = getAbstractValue(item).trim();
    if (trimmed !== existing) {
      if (handleUpdate) {
        handleUpdate(buildInspectorFieldPatch(item, "abstractNote", trimmed));
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
          onFocus={() => {
            focusedItemIdRef.current = item?.id ?? null;
          }}
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

export interface ReaderInspectorProps extends Omit<
  LibraryInspectorProps,
  "item"
> {
  item?: Item | ReaderDocument | null;
}

/**
 * Autonomous Zone 4: ReaderInspector
 * Thin wrapper around the shared LibraryInspector with reader-specific navigation fallbacks.
 */
export function ReaderInspector({
  item,
  onSelectItem,
  ...rest
}: ReaderInspectorProps) {
  const defaultSelectItem = useCallback(
    (itemId: string) => {
      const projectId =
        item && "projectId" in item && item.projectId
          ? String(item.projectId)
          : rest.scopeId;
      openInNewTab(buildReaderPaperUrl(itemId, { projectId }));
    },
    [item, rest.scopeId],
  );

  const effectiveItem = (item || null) as Item | null;
  const effectiveOnSelect = onSelectItem || defaultSelectItem;

  return (
    <LibraryInspector
      {...rest}
      item={effectiveItem}
      onSelectItem={effectiveOnSelect}
      hideRailToggle={rest.hideRailToggle ?? false}
      defaultOpen={rest.defaultOpen}
      isReader={true}
    />
  );
}

export default InfoSection;
