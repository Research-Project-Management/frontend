"use client";

import { useMemo } from "react";
import type { Item } from "@/features/library/domain/types/library.types";
import {
  formatAndSanitizeExtraMetadata,
  isValidValue,
} from "@/features/library/domain/metadata";
import { formatAuditDate } from "@/features/library/ui/inspector/InfoSection";
import { InlineTextarea } from "./InlineTextarea";

export interface ExtraAuditFieldsProps {
  item?: Item;
  paper?: Item;
  canEdit?: boolean;
  onUpdateItem?: (data: Partial<Item>) => void;
  onUpdatePaper?: (data: Partial<Item>) => void;
}

export function ExtraAuditFields(props: ExtraAuditFieldsProps) {
  const item = props.item || props.paper;
  const onUpdateItem = props.onUpdateItem || props.onUpdatePaper;
  const { canEdit = true } = props;

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
