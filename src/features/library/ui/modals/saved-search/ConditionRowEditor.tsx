"use client";

import React from "react";
import { Plus, Minus, Folder } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shared/components/ui/select";
import type { Collection } from "@/features/library/domain/types/library.types";
import type {
  SavedSearchField,
  SavedSearchOperator,
} from "@/features/library/domain/types/saved-searches.types";
import {
  type ConditionRow,
  READ_STATUS_OPTIONS,
  RATING_OPTIONS,
  HAS_ATTACHMENT_OPTIONS,
  getFieldConfig,
  parseDurationParts,
} from "@/features/library/domain/saved-search-schema.domain";
import { ConditionFieldSelect } from "./ConditionFieldSelect";

export interface ConditionRowEditorProps {
  condition: ConditionRow;
  index: number;
  canRemove: boolean;
  itemTypeOptions: { value: string; label: string }[];
  collections: Collection[];
  tagList: string[];
  onFieldChange: (id: string, field: SavedSearchField) => void;
  onOperatorChange: (id: string, operator: SavedSearchOperator) => void;
  onValueChange: (id: string, value: string) => void;
  onAddAfter: (index: number) => void;
  onRemove: (id: string) => void;
}

export function ConditionRowEditor({
  condition: cond,
  index: idx,
  canRemove,
  itemTypeOptions,
  collections,
  tagList,
  onFieldChange,
  onOperatorChange,
  onValueChange,
  onAddAfter,
  onRemove,
}: ConditionRowEditorProps) {
  const activeConfig = getFieldConfig(cond.field);
  const isNoValueOperator =
    cond.operator === "isPresent" || cond.operator === "isAbsent";

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-2 sm:p-0 rounded-md sm:rounded-none bg-muted sm:bg-transparent border border-border-subtle sm:border-0">
      {/* Field & Operator controls: Side-by-side grid on mobile, inline on desktop */}
      <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0">
        {/* Field Select - 2-tier Schema Combobox Popover */}
        <ConditionFieldSelect
          value={cond.field}
          onChange={(val) => onFieldChange(cond.id, val)}
          ariaLabel={`Field for condition ${idx + 1}`}
        />

        {/* Operator Select - Scaled compact popper */}
        <Select
          key={`${cond.id}-${cond.field}`}
          value={cond.operator}
          onValueChange={(val) =>
            onOperatorChange(cond.id, val as SavedSearchOperator)
          }
        >
          <SelectTrigger
            size="sm"
            aria-label={`Operator for condition ${idx + 1}`}
            className="w-full sm:w-[135px] h-8 text-13 font-normal text-foreground bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring rounded-md shrink-0"
          >
            <SelectValue placeholder="Operator" />
          </SelectTrigger>
          <SelectContent
            position="popper"
            sideOffset={4}
            className="max-h-56 min-w-[135px] p-1 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md"
          >
            {activeConfig.operators.map((op) => (
              <SelectItem
                key={op.value}
                value={op.value}
                className="text-13 py-1.5 px-2 rounded-sm cursor-pointer focus:bg-muted"
              >
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Value Input or Select & Action buttons */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {!isNoValueOperator ? (
          cond.operator === "isInTheLast" ? (
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <Input
                type="number"
                min={1}
                value={parseDurationParts(cond.value).count}
                onChange={(e) => {
                  const count = e.target.value;
                  const unit = parseDurationParts(cond.value).unit;
                  onValueChange(cond.id, `${count} ${unit}`);
                }}
                placeholder="30"
                className="w-20 h-8 text-13 text-foreground bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring rounded-md"
              />
              <Select
                value={parseDurationParts(cond.value).unit}
                onValueChange={(val) => {
                  const count = parseDurationParts(cond.value).count;
                  onValueChange(cond.id, `${count} ${val}`);
                }}
              >
                <SelectTrigger
                  size="sm"
                  className="w-[105px] h-8 text-13 text-foreground bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring rounded-md shrink-0"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  sideOffset={4}
                  className="p-1 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md"
                >
                  <SelectItem
                    value="days"
                    className="text-13 py-1.5 px-2 rounded-sm cursor-pointer"
                  >
                    Days
                  </SelectItem>
                  <SelectItem
                    value="weeks"
                    className="text-13 py-1.5 px-2 rounded-sm cursor-pointer"
                  >
                    Weeks
                  </SelectItem>
                  <SelectItem
                    value="months"
                    className="text-13 py-1.5 px-2 rounded-sm cursor-pointer"
                  >
                    Months
                  </SelectItem>
                  <SelectItem
                    value="years"
                    className="text-13 py-1.5 px-2 rounded-sm cursor-pointer"
                  >
                    Years
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : cond.field === "anyField" ? (
            <Input
              value={cond.value}
              onChange={(e) => onValueChange(cond.id, e.target.value)}
              placeholder={activeConfig.placeholder}
              aria-label={`Keyword for condition ${idx + 1}`}
              className="flex-1 min-w-0 h-8 text-13 text-foreground bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring rounded-md placeholder:text-muted-foreground"
            />
          ) : cond.field === "itemType" ? (
            <div className="flex-1 min-w-0">
              <Select
                value={
                  cond.value || itemTypeOptions[0]?.value || "journalArticle"
                }
                onValueChange={(val) => onValueChange(cond.id, val)}
              >
                <SelectTrigger
                  size="sm"
                  aria-label={`Item type for condition ${idx + 1}`}
                  className="w-full h-8 text-13 font-normal text-foreground bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring rounded-md"
                >
                  <SelectValue placeholder="Select item type" />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  sideOffset={4}
                  className="max-h-56 p-1 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md"
                >
                  {itemTypeOptions.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className="text-13 py-1.5 px-2 rounded-sm cursor-pointer focus:bg-muted"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : cond.field === "collection" ? (
            <div className="flex-1 min-w-0">
              <Select
                value={cond.value || (collections[0]?.id ?? "")}
                onValueChange={(val) => onValueChange(cond.id, val)}
              >
                <SelectTrigger
                  size="sm"
                  aria-label={`Collection for condition ${idx + 1}`}
                  className="w-full h-8 text-13 font-normal text-foreground bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring rounded-md"
                >
                  <SelectValue placeholder="Select collection..." />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  sideOffset={4}
                  className="max-h-56 p-1 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md"
                >
                  {collections.length === 0 ? (
                    <div className="p-2 text-11 text-foreground text-center">
                      No collections found
                    </div>
                  ) : (
                    collections.map((col) => (
                      <SelectItem
                        key={col.id}
                        value={col.id}
                        className="text-13 py-1.5 px-2 rounded-sm cursor-pointer focus:bg-muted"
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <Folder
                            className="size-3.5 text-foreground shrink-0"
                            strokeWidth={1.5}
                          />
                          <span className="truncate">{col.name}</span>
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          ) : cond.field === "tag" ? (
            <div className="flex-1 min-w-0 relative">
              <Input
                list={`tag-suggestions-${cond.id}`}
                value={cond.value}
                onChange={(e) => onValueChange(cond.id, e.target.value)}
                placeholder="Enter tag name..."
                aria-label={`Tag for condition ${idx + 1}`}
                className="h-8 text-13 text-foreground bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring rounded-md placeholder:text-muted-foreground"
              />
              <datalist id={`tag-suggestions-${cond.id}`}>
                {tagList.map((tag) => (
                  <option key={tag} value={tag} />
                ))}
              </datalist>
            </div>
          ) : cond.field === "year" ? (
            <Input
              type="number"
              value={cond.value}
              onChange={(e) => onValueChange(cond.id, e.target.value)}
              placeholder="YYYY"
              aria-label={`Year for condition ${idx + 1}`}
              className="flex-1 min-w-0 h-8 text-13 text-foreground bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring rounded-md placeholder:text-muted-foreground"
            />
          ) : cond.field === "readStatus" ? (
            <div className="flex-1 min-w-0">
              <Select
                value={cond.value || "unread"}
                onValueChange={(val) => onValueChange(cond.id, val)}
              >
                <SelectTrigger
                  size="sm"
                  aria-label={`Reading status for condition ${idx + 1}`}
                  className="w-full h-8 text-13 font-normal text-foreground bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring rounded-md"
                >
                  <SelectValue placeholder="Select reading status..." />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  sideOffset={4}
                  className="max-h-56 p-1 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md"
                >
                  {READ_STATUS_OPTIONS.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className="text-13 py-1.5 px-2 rounded-sm cursor-pointer focus:bg-muted"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : cond.field === "rating" ? (
            <div className="flex-1 min-w-0">
              <Select
                value={cond.value || "3"}
                onValueChange={(val) => onValueChange(cond.id, val)}
              >
                <SelectTrigger
                  size="sm"
                  aria-label={`Rating for condition ${idx + 1}`}
                  className="w-full h-8 text-13 font-normal text-foreground bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring rounded-md"
                >
                  <SelectValue placeholder="Select rating..." />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  sideOffset={4}
                  className="max-h-56 p-1 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md"
                >
                  {RATING_OPTIONS.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className="text-13 py-1.5 px-2 rounded-sm cursor-pointer focus:bg-muted"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : cond.field === "hasAttachment" ? (
            <div className="flex-1 min-w-0">
              <Select
                value={cond.value || "true"}
                onValueChange={(val) => onValueChange(cond.id, val)}
              >
                <SelectTrigger
                  size="sm"
                  aria-label={`Attachment filter for condition ${idx + 1}`}
                  className="w-full h-8 text-13 font-normal text-foreground bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring rounded-md"
                >
                  <SelectValue placeholder="Select attachment status..." />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  sideOffset={4}
                  className="max-h-56 p-1 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md"
                >
                  {HAS_ATTACHMENT_OPTIONS.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className="text-13 py-1.5 px-2 rounded-sm cursor-pointer focus:bg-muted"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <Input
              value={cond.value}
              onChange={(e) => onValueChange(cond.id, e.target.value)}
              placeholder={activeConfig.placeholder}
              aria-label={`${activeConfig.label} for condition ${idx + 1}`}
              className="flex-1 min-w-0 h-8 text-13 text-foreground bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring rounded-md placeholder:text-muted-foreground"
            />
          )
        ) : (
          <div className="flex-1 min-w-0 h-8 flex items-center px-3 text-13 text-muted-foreground italic rounded-md border border-dashed border-border bg-muted">
            No value required
          </div>
        )}

        {/* Action buttons (+ / -) */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onAddAfter(idx)}
            title="Add condition below"
            aria-label={`Add condition after condition ${idx + 1}`}
            className="size-8 text-foreground hover:bg-muted border border-border hover:border-border-hover rounded-md cursor-pointer flex items-center justify-center shrink-0 transition-colors"
          >
            <Plus className="size-3.5 shrink-0" strokeWidth={1.5} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onRemove(cond.id)}
            disabled={!canRemove}
            title="Remove condition"
            aria-label={`Remove condition ${idx + 1}`}
            className="size-8 text-foreground hover:bg-muted border border-border hover:border-border-hover rounded-md cursor-pointer disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center shrink-0 transition-colors"
          >
            <Minus className="size-3.5 shrink-0" strokeWidth={1.5} />
          </Button>
        </div>
      </div>
    </div>
  );
}
