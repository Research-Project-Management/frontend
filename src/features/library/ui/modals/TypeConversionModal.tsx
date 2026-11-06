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
import type { Item } from "@/features/library/types/core.types";
import {
  ALL_ITEM_TYPES_FLAT,
  FIELD_LABELS,
  humanizeFieldName,
} from "@/features/library/types/core.types";
import {
  useItemTypeConversion,
  useItemTypeConversionPreviewQuery,
  type TypeConversionPreview,
} from "@/features/library/core/coordinator/saved-search-builder.coordinator";
import { useLibraryCacheSynchronizer } from "@/features/library/core/coordinator/item-action.coordinator";

type TypeConversionItemLike = {
  id?: string;
  itemType?: string;
  projectId?: string | null;
  title?: string;
  version?: number;
  [key: string]: unknown;
};

interface TypeConversionModalProps {
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

function resolveFieldLabel(fieldKeyOrLabel: string): string {
  if (!fieldKeyOrLabel) return "";
  const key = fieldKeyOrLabel.trim();
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  const lower = key.toLowerCase();
  if (FIELD_LABELS[lower]) return FIELD_LABELS[lower];
  return humanizeFieldName(key);
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
      if (updatedItem && onSuccess) {
        onSuccess(updatedItem, retainUnmapped);
      } else {
        onOpenChange(false);
      }
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
        className="w-full sm:max-w-[420px] p-5 bg-background border border-border shadow-raised-200 rounded-md gap-4 overflow-hidden"
      >
        <DialogHeader className="text-left shrink-0">
          <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
            Convert Item Type
          </DialogTitle>
          <DialogDescription className="sr-only">
            Change item type from {sourceTypeName} to {targetTypeName}
          </DialogDescription>
        </DialogHeader>

        {/* Body Content */}
        <div className="space-y-3.5">
          {isLoadingPreview ? (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
              <Loader2 className="size-4 animate-spin text-muted-foreground shrink-0" />
              <p className="text-12 text-muted-foreground">Checking fields…</p>
            </div>
          ) : previewError ? (
            <div className="p-3 rounded-md border border-destructive/30 bg-destructive/5 text-destructive space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <p className="text-12 font-medium">Failed to check fields</p>
              </div>
              <p className="text-11 opacity-90">{previewError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadPreview}
                className="h-6 text-11 gap-1.5 rounded-md border-border"
              >
                <RefreshCw className="size-3" /> Retry
              </Button>
            </div>
          ) : (
            <div className="space-y-3 text-13">
              {/* Type transition */}
              <div className="flex items-center gap-2 text-13 font-normal text-muted-foreground">
                <span className="font-semibold text-foreground">{sourceTypeName}</span>
                <span>→</span>
                <span className="font-semibold text-foreground">{targetTypeName}</span>
              </div>

              {/* Case 1: Item has populated fields that will be moved to Extra */}
              {droppedWithValues.length > 0 ? (
                <div className="space-y-2.5">
                  <div className="rounded-md border border-border bg-muted/30 p-2.5 max-h-[140px] overflow-y-auto thin-scrollbar">
                    <ul className="space-y-1.5 text-12">
                      {droppedWithValues.map((d) => {
                        const label = resolveFieldLabel(d.label || d.field);
                        const valStr = formatValue(d.value);
                        return (
                          <li
                            key={d.field}
                            className="flex items-start justify-between gap-3 text-foreground"
                          >
                            <span className="text-muted-foreground shrink-0">{label}:</span>
                            <span
                              className="font-medium text-foreground truncate text-right select-text"
                              title={valStr}
                            >
                              {valStr}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {/* Single clear checkbox */}
                  <div className="flex items-center gap-2 pt-0.5">
                    <Checkbox
                      id="preserve-extra"
                      checked={retainUnmapped}
                      onCheckedChange={(checked) =>
                        setRetainUnmapped(Boolean(checked))
                      }
                    />
                    <Label
                      htmlFor="preserve-extra"
                      className="text-12 font-normal text-muted-foreground cursor-pointer select-none"
                    >
                      Save unsupported fields to <span className="font-medium text-foreground">Extra</span>
                    </Label>
                  </div>
                </div>
              ) : (
                /* No dropped values */
                <p className="text-12 text-muted-foreground">
                  All fields are supported. No data will be lost.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="pt-1 shrink-0 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isConverting}
            className="h-8 px-3 text-12 font-medium cursor-pointer text-foreground rounded-md hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={
              isConverting || isLoadingPreview || Boolean(previewError)
            }
            className="h-8 px-3 text-12 font-medium cursor-pointer rounded-md shadow-none gap-1.5"
          >
            {isConverting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Converting…</span>
              </>
            ) : (
              <span>Convert</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TypeConversionModal;
