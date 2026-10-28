"use client";

import { Check } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { Item } from "@/features/library/domain/types/library.types";
import { useLibraryUIStore } from "@/features/library/core/store/library-ui.store";
import {
  SchemaItemTypeDefinition,
  ALL_ITEM_TYPES_FLAT,
  getTitleFieldForType,
} from "@/features/library/domain/types/library.types";
import {
  cleanValue,
  getItemDisplayTitle,
} from "@/features/library/domain/metadata";
import { buildInspectorFieldPatch } from "@/features/library/domain/item-field-schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { InlineTextarea } from "./InlineTextarea";

export interface GeneralFieldsProps {
  item?: Item;
  currentItemType: string;
  selectableItemTypes: Array<{ value: string; label: string }>;
  typeDefinition: SchemaItemTypeDefinition;
  canEdit?: boolean;
  scopeId?: string;
  onUpdateItem?: (data: Partial<Item>) => void;
}

/**
 * Builds coupled top-level and `extraFields` updates for Inspector field edits and clears (`""`),
 * delegating directly to the canonical `buildInspectorFieldPatch` engine in `item-field-schema.ts`.
 */
export function buildCoupledFieldUpdates(
  item: Partial<Item> | Record<string, unknown>,
  fieldKey: string,
  value: string,
): Partial<Item> & Record<string, unknown> {
  return buildInspectorFieldPatch(item as Partial<Item>, fieldKey, value);
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
    const patch = buildCoupledFieldUpdates(
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

export default GeneralFields;
