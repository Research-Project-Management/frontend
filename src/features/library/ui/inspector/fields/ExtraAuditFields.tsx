"use client";

import { useMemo } from "react";
import type { Item } from "@/features/library/domain/types/library.types";
import {
  formatAndSanitizeExtraMetadata,
  isValidValue,
} from "@/features/library/domain/metadata";
import { InlineTextarea } from "./InlineTextarea";

/** Format ISO date into locale format (e.g. 8/20/2026, 3:53:43 PM) */
export function formatAuditDate(dateStr?: string | Date | null): string {
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

export interface ExtraAuditFieldsProps {
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
    onUpdateItem?.({
      ...(item.itemType ? { itemType: item.itemType } : {}),
      extra: savedValue || undefined,
    });
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
            itemKey={item.id}
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

export default ExtraAuditFields;
