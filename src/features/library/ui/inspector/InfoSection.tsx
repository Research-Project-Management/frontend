"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { Item } from "@/features/library/domain/types/library.types";
import { cleanDoi } from "@/features/library/domain/identifiers";
import {
  cleanValue,
  parseItemExtraField,
} from "@/features/library/domain/metadata";
import {
  getItemTypeDefinition,
  normalizeCanonicalItemType,
  mapRegistryItemTypes,
  SchemaFieldDefinition,
  SchemaItemTypeDefinition,
} from "@/features/library/domain/types/library.types";
import { toast } from "sonner";
import { copyToClipboard as copyText } from "@/shared/lib/utils";
import { useItemTypes } from "@/features/library/sdk/queries/catalog.queries";
import { CreatorFields } from "./fields/CreatorFields";
import { GeneralFields } from "./fields/GeneralFields";
import { DynamicInspectorField } from "./fields/DynamicInspectorField";
import { ExtraAuditFields } from "./fields/ExtraAuditFields";
import {
  INSPECTOR_FIELD_DESCRIPTORS,
  prepareInspectorFieldContext,
  resolveInspectorFieldValue,
  buildInspectorFieldPatch,
} from "@/features/library/domain/item-field-schema";

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

export default function InfoSection({
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

  const parsedExtraMap = useMemo(
    () => parseItemExtraField(item?.extra),
    [item?.extra],
  );

  const displayDoi = useMemo(
    () => cleanDoi(item?.doi || parsedExtraMap.doi),
    [item?.doi, parsedExtraMap.doi],
  );

  const preparedFieldContext = useMemo(
    () => prepareInspectorFieldContext(item, parsedExtraMap, displayDoi),
    [item, parsedExtraMap, displayDoi],
  );

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
