"use client";

import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Label } from "@/shared/components/ui/label";
import type { Item } from "@/features/library/domain/types/library.types";
import {
  ALL_ITEM_TYPES_FLAT,
  FIELD_LABELS,
  ITEM_TYPE_FIELDS_MAP,
  BASE_FIELD_MAPPINGS,
  REVERSE_BASE_FIELD_MAPPINGS,
  humanizeFieldName,
} from "@/features/library/domain/types/library.types";
import {
  useItemTypeConversion,
  useItemTypeConversionPreviewQuery,
  type TypeConversionPreview,
} from "@/features/library/sdk/queries/saved-searches-relations.queries";
import { useLibraryCacheSynchronizer } from "@/features/library/sdk/queries/catalog.queries";

export type TypeConversionItemLike = {
  id?: string;
  itemType?: string;
  projectId?: string | null;
  title?: string;
  version?: number;
  [key: string]: unknown;
};

export interface TypeConversionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item | TypeConversionItemLike;
  targetType: string;
  scopeId?: string;
  initialPreview?: TypeConversionPreview | null;
  onSuccess?: (updatedItem: Item, retainUnmapped?: boolean) => void;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v)))
      .join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function resolveFieldLabel(fieldKey: string): string {
  if (!fieldKey) return "";
  return FIELD_LABELS[fieldKey] || humanizeFieldName(fieldKey);
}

export function TypeConversionModal({
  open,
  onOpenChange,
  item: currentItem,
  targetType,
  scopeId: propScopeId,
  initialPreview,
  onSuccess,
}: TypeConversionModalProps) {
  const itemId = currentItem?.id || "";
  const sourceType = currentItem?.itemType || "journalArticle";
  const currentType = sourceType;
  const isOpen = open;
  const scopeId = propScopeId || currentItem?.projectId || "user";

  // ── State & Preview Query ──────────────────────────────────────────────────
  const [retainUnmapped, setRetainUnmapped] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setRetainUnmapped(true);
    }
  }, [isOpen, currentItem?.id, targetType]);

  const hasInitialPreview = Boolean(
    initialPreview && initialPreview.targetType === targetType,
  );
  const previewQuery = useItemTypeConversionPreviewQuery(
    scopeId,
    currentItem?.id,
    targetType,
    isOpen &&
      !!currentItem?.id &&
      !!targetType &&
      targetType !== currentType &&
      !hasInitialPreview,
  );

  const preview: TypeConversionPreview | null = hasInitialPreview
    ? (initialPreview ?? null)
    : (previewQuery.data ?? null);
  const isLoadingPreview = !hasInitialPreview && previewQuery.isLoading;
  const previewError =
    !hasInitialPreview && previewQuery.error
      ? previewQuery.error instanceof Error
        ? previewQuery.error.message
        : "Failed to preview type conversion"
      : null;

  const { convertAsync, isConverting } = useItemTypeConversion(scopeId);
  const { invalidateItemById } = useLibraryCacheSynchronizer(scopeId);

  const sourceTypeName = useMemo(() => {
    return (
      ALL_ITEM_TYPES_FLAT.find((t) => t.value === sourceType)?.label ||
      sourceType
    );
  }, [sourceType]);

  const targetTypeName = useMemo(() => {
    return (
      ALL_ITEM_TYPES_FLAT.find((t) => t.value === targetType)?.label ||
      targetType
    );
  }, [targetType]);

  const loadPreview = () => {
    void previewQuery.refetch();
  };

  // Fields that actually have content and will be dropped/lost in this specific item
  const droppedWithValues = useMemo(() => {
    return (preview?.droppedFields ?? []).filter(
      (d) => d.value !== null && d.value !== undefined && d.value !== "",
    );
  }, [preview?.droppedFields]);

  // Schema-level unsupported fields: Prefer authoritative Backend preview response; fall back to local schema map while loading
  const schemaUnsupportedFieldLabels = useMemo(() => {
    if (!sourceType || !targetType || sourceType === targetType) return [];

    if (Array.isArray(preview?.schemaUnsupportedFieldLabels)) {
      return preview.schemaUnsupportedFieldLabels;
    }
    if (Array.isArray(preview?.schemaUnsupportedFields)) {
      return preview.schemaUnsupportedFields.map((f) => resolveFieldLabel(f));
    }

    const sourceFields = ITEM_TYPE_FIELDS_MAP[sourceType] || [];
    const targetFields = new Set(ITEM_TYPE_FIELDS_MAP[targetType] || []);

    const sourceReverseBase = REVERSE_BASE_FIELD_MAPPINGS[sourceType] || {};
    const targetBase = BASE_FIELD_MAPPINGS[targetType] || {};

    const unsupported = sourceFields.filter((sf) => {
      // Direct field match in target
      if (targetFields.has(sf)) return false;

      // Base semantic mapping match (e.g. proceedingsTitle -> publicationTitle -> bookTitle)
      const baseSemantic = sourceReverseBase[sf] || sf;
      const mappedTarget =
        targetBase[baseSemantic] ||
        (targetFields.has(baseSemantic) ? baseSemantic : undefined);
      if (mappedTarget && targetFields.has(mappedTarget)) return false;

      // Always preserved system/metadata fields
      if (
        sf === "title" ||
        sf === "abstract" ||
        sf === "abstractNote" ||
        sf === "date" ||
        sf === "year" ||
        sf === "url" ||
        sf === "DOI" ||
        sf === "extra" ||
        sf === "citationKey"
      ) {
        return false;
      }

      return true;
    });

    return unsupported.map((f) => resolveFieldLabel(f));
  }, [
    sourceType,
    targetType,
    preview?.schemaUnsupportedFieldLabels,
    preview?.schemaUnsupportedFields,
  ]);

  // ── Confirm Handler ────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!itemId || !targetType) return;
    try {
      const result = await convertAsync({
        itemId,
        targetType,
        expectedVersion: currentItem?.version,
        retainUnmappedInExtra: retainUnmapped,
      });
      const updatedItem = result?.item;
      if (updatedItem) {
        onSuccess?.(updatedItem, retainUnmapped);
      }
      onOpenChange(false);
    } catch (err: unknown) {
      // Invalidate item query cache immediately on error so UI synchronizes latest version
      const targetScope = scopeId || currentItem?.projectId || "user";
      void invalidateItemById(itemId, targetScope);

      const errMsg = err instanceof Error ? err.message : String(err || "");
      const isVersionConflict =
        errMsg.includes("Version conflict") ||
        errMsg.includes("VERSION_MISMATCH") ||
        (err as { code?: string })?.code === "VERSION_MISMATCH" ||
        (err as { statusCode?: number })?.statusCode === 412 ||
        (err as { statusCode?: number })?.statusCode === 409;

      if (isVersionConflict) {
        toast.warning(
          "Item was modified elsewhere. Refreshed to latest version — please review and try again.",
          { id: "type-conversion-conflict" },
        );
        void previewQuery.refetch();
        return;
      }
    }
  };

  if (!currentItem) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (isConverting) return; onOpenChange(v); }}>
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-full sm:max-w-[480px] p-6 bg-background border border-border shadow-raised-200 rounded-md gap-4 overflow-hidden"
      >
        {/* Header with Title only */}
        <DialogHeader className="text-left shrink-0">
          <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
            Convert Item Type
          </DialogTitle>
          <DialogDescription className="sr-only">
            Review item type conversion details and confirm changes.
          </DialogDescription>
        </DialogHeader>

        {/* Body Content */}
        <div className="space-y-4">
          {isLoadingPreview ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
              <Loader2 className="size-4 animate-spin text-muted-foreground shrink-0" />
              <p className="text-13 text-muted-foreground">
                Checking field compatibility…
              </p>
            </div>
          ) : previewError ? (
            <div className="p-3 rounded-md border border-destructive/30 bg-destructive/5 text-destructive space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <p className="text-13 font-medium">
                  Failed to check field compatibility
                </p>
              </div>
              <p className="text-12 opacity-90">{previewError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadPreview}
                className="h-7 text-12 gap-1.5 rounded-md border-border"
              >
                <RefreshCw className="size-3" /> Retry
              </Button>
            </div>
          ) : (
            <div className="space-y-3.5 text-13">
              {/* Primary confirmation prompt */}
              <p className="text-foreground leading-normal">
                Are you sure you want to change the item type from{" "}
                <span className="font-semibold">{sourceTypeName}</span> to{" "}
                <span className="font-semibold">{targetTypeName}</span>?
              </p>

              {/* Case 1: Item has populated fields that will be dropped */}
              {droppedWithValues.length > 0 ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-foreground font-medium">
                      {retainUnmapped
                        ? "Unmapped Fields — Moved to Extra"
                        : "Unmapped Fields — Will Be Discarded"}
                    </p>
                  </div>

                  <div className="rounded-md border border-border bg-muted/30 p-2.5 max-h-[160px] overflow-y-auto thin-scrollbar">
                    <ul className="space-y-1.5 text-12">
                      {droppedWithValues.map((d) => {
                        const label = d.label || resolveFieldLabel(d.field);
                        const valStr = formatValue(d.value);
                        return (
                          <li
                            key={d.field}
                            className="flex items-start justify-between gap-3 text-foreground"
                          >
                            <span className="font-medium shrink-0">{label}:</span>
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="text-muted-foreground truncate text-right font-normal"
                                title={valStr}
                              >
                                {valStr}
                              </span>
                              <span className="text-11 font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                {retainUnmapped ? "→ Extra" : "→ Discard"}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {/* Safety option: preserve unmapped fields in Extra */}
                  <div className="pt-1 flex items-start gap-2.5">
                    <Checkbox
                      id="preserve-extra"
                      checked={retainUnmapped}
                      onCheckedChange={(checked) =>
                        setRetainUnmapped(Boolean(checked))
                      }
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor="preserve-extra"
                      className="text-12 font-normal text-muted-foreground leading-tight cursor-pointer"
                    >
                      Preserve lost fields in the{" "}
                      <span className="font-medium text-foreground">Extra</span>{" "}
                      field
                    </Label>
                  </div>
                </div>
              ) : schemaUnsupportedFieldLabels.length > 0 ? (
                /* Case 2: Current item has no values in unmapped fields, but schemas differ */
                <div className="space-y-1.5 text-12 text-muted-foreground">
                  <p>
                    No filled data will be lost on this item.
                  </p>
                  <p className="text-11 leading-normal opacity-90">
                    Fields not supported by {targetTypeName}:{" "}
                    <span className="text-foreground font-medium">
                      {schemaUnsupportedFieldLabels.join(", ")}
                    </span>
                    .
                  </p>
                </div>
              ) : (
                /* Case 3: Fully compatible schemas */
                <p className="text-12 text-muted-foreground">
                  All fields in this item are supported by {targetTypeName}. No
                  data will be lost.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="pt-2 shrink-0 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isConverting}
            className="h-8 px-3 text-13 font-medium cursor-pointer text-foreground rounded-md hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={
              isConverting || isLoadingPreview || Boolean(previewError)
            }
            className="h-8 px-3 text-13 font-medium cursor-pointer rounded-md shadow-none gap-1.5"
          >
            {isConverting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Converting…</span>
              </>
            ) : (
              <span>Convert to {targetTypeName}</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TypeConversionModal;
