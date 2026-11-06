"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Plus,
  Minus,
  Folder,
  ChevronDown,
  Check,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/shared/components/ui/popover";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";
import type { Collection } from "@/features/library/types/core.types";
import type {
  SavedSearchField,
  SavedSearchOperator,
} from "@/features/library/types/ingestion.types";
import {
  type ConditionRow,
  PRIMARY_SAVED_SEARCH_FIELD_ITEMS,
  ALL_SCHEMA_FIELD_ITEMS,
  READ_STATUS_OPTIONS,
  RATING_OPTIONS,
  HAS_ATTACHMENT_OPTIONS,
  getFieldConfig,
  parseDurationParts,
} from "@/features/library/domain/saved-search-ast.domain";

interface ConditionFieldSelectProps {
  value: SavedSearchField;
  onChange: (field: SavedSearchField) => void;
  ariaLabel?: string;
}

function ConditionFieldSelect({
  value,
  onChange,
  ariaLabel,
}: ConditionFieldSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const activeConfig = getFieldConfig(value);

  const filteredPrimary = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return PRIMARY_SAVED_SEARCH_FIELD_ITEMS;
    return PRIMARY_SAVED_SEARCH_FIELD_ITEMS.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.value.toLowerCase().includes(q),
    );
  }, [search]);

  const filteredAZ = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ALL_SCHEMA_FIELD_ITEMS;
    return ALL_SCHEMA_FIELD_ITEMS.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.value.toLowerCase().includes(q),
    );
  }, [search]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(t);
    } else {
      setSearch("");
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel || "Select field"}
          className="w-full sm:w-[175px] h-8 px-3 flex items-center justify-between gap-2 text-13 font-normal text-foreground bg-background border border-border rounded-md hover:border-border-hover focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring transition-colors shrink-0 select-none cursor-pointer"
        >
          <span className="truncate">{activeConfig.label}</span>
          <ChevronDown className="size-4 opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        onWheel={(e) => e.stopPropagation()}
        className="w-56 p-0 rounded-md border border-border shadow-raised-200 bg-popover text-popover-foreground overflow-hidden z-[60]"
      >
        <div className="flex items-center gap-2 px-2.5 h-8.5 border-b border-border">
          <Search className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
          <input
            ref={inputRef}
            type="text"
            aria-label="Filter fields"
            placeholder="Filter fields..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
              } else if (e.key === "Enter") {
                const first = filteredPrimary[0] || filteredAZ[0];
                if (first) {
                  onChange(first.value);
                  setOpen(false);
                }
              }
            }}
            className="flex-1 min-w-0 h-full bg-transparent text-12 text-foreground placeholder:text-muted-foreground outline-none border-none font-sans"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-muted-foreground hover:text-foreground hover:bg-muted p-0.5 rounded cursor-pointer flex items-center justify-center shrink-0 focus-visible:outline-none"
              aria-label="Clear filter"
            >
              <X className="size-3 shrink-0" strokeWidth={1.5} />
            </button>
          )}
        </div>

        <ScrollArea type="always" className="max-h-64">
          <div className="p-1 pr-2.5">
            {filteredPrimary.length === 0 && filteredAZ.length === 0 ? (
              <div className="py-4 text-center text-12 text-muted-foreground select-none">
                No matching fields
              </div>
            ) : (
              <>
                {filteredPrimary.map((field) => {
                  const isSelected = field.value === value;
                  return (
                    <button
                      key={field.value}
                      type="button"
                      onClick={() => {
                        onChange(field.value);
                        setOpen(false);
                      }}
                      className={cn(
                        "w-full h-7 px-2 flex items-center justify-between gap-2 rounded-md text-12 text-left transition-colors cursor-pointer select-none",
                        isSelected
                          ? "bg-muted font-medium text-foreground"
                          : "text-foreground hover:bg-muted font-normal",
                      )}
                    >
                      <span className="truncate">{field.label}</span>
                      {isSelected && (
                        <Check className="size-3.5 text-foreground shrink-0 ml-1" strokeWidth={1.5} />
                      )}
                    </button>
                  );
                })}

                {filteredPrimary.length > 0 && filteredAZ.length > 0 && (
                  <div className="my-1 border-t border-border" />
                )}

                {filteredAZ.map((field) => {
                  const isSelected = field.value === value;
                  return (
                    <button
                      key={field.value}
                      type="button"
                      onClick={() => {
                        onChange(field.value);
                        setOpen(false);
                      }}
                      className={cn(
                        "w-full h-7 px-2 flex items-center justify-between gap-2 rounded-md text-12 text-left transition-colors cursor-pointer select-none",
                        isSelected
                          ? "bg-muted font-medium text-foreground"
                          : "text-foreground hover:bg-muted font-normal",
                      )}
                    >
                      <span className="truncate">{field.label}</span>
                      {isSelected && (
                        <Check className="size-3.5 text-foreground shrink-0 ml-1" strokeWidth={1.5} />
                      )}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

interface ConditionRowEditorProps {
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
      <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0">
        <ConditionFieldSelect
          value={cond.field}
          onChange={(val) => onFieldChange(cond.id, val)}
          ariaLabel={`Field for condition ${idx + 1}`}
        />

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
                className="text-13 py-1.5 px-2 rounded-md cursor-pointer focus:bg-muted font-normal"
              >
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
                className="w-20 h-8 text-13 text-foreground bg-background border border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring rounded-md"
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
                  className="w-[105px] h-8 text-13 font-normal text-foreground bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring rounded-md shrink-0"
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
                    className="text-13 py-1.5 px-2 rounded-md cursor-pointer font-normal"
                  >
                    Days
                  </SelectItem>
                  <SelectItem
                    value="weeks"
                    className="text-13 py-1.5 px-2 rounded-md cursor-pointer font-normal"
                  >
                    Weeks
                  </SelectItem>
                  <SelectItem
                    value="months"
                    className="text-13 py-1.5 px-2 rounded-md cursor-pointer font-normal"
                  >
                    Months
                  </SelectItem>
                  <SelectItem
                    value="years"
                    className="text-13 py-1.5 px-2 rounded-md cursor-pointer font-normal"
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
              className="flex-1 min-w-0 h-8 text-13 text-foreground bg-background border border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring rounded-md placeholder:text-muted-foreground"
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
                      className="text-13 py-1.5 px-2 rounded-md cursor-pointer focus:bg-muted font-normal"
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
                    <div className="p-2 text-12 text-muted-foreground text-center">
                      No collections found
                    </div>
                  ) : (
                    collections.map((col) => (
                      <SelectItem
                        key={col.id}
                        value={col.id}
                        className="text-13 py-1.5 px-2 rounded-md cursor-pointer focus:bg-muted font-normal"
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
                className="h-8 text-13 text-foreground bg-background border border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring rounded-md placeholder:text-muted-foreground"
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
              className="flex-1 min-w-0 h-8 text-13 text-foreground bg-background border border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring rounded-md placeholder:text-muted-foreground"
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
                      className="text-13 py-1.5 px-2 rounded-md cursor-pointer focus:bg-muted font-normal"
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
                      className="text-13 py-1.5 px-2 rounded-md cursor-pointer focus:bg-muted font-normal"
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
                      className="text-13 py-1.5 px-2 rounded-md cursor-pointer focus:bg-muted font-normal"
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
              className="flex-1 min-w-0 h-8 text-13 text-foreground bg-background border border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring rounded-md placeholder:text-muted-foreground"
            />
          )
        ) : (
          <div className="flex-1 min-w-0 h-8 flex items-center px-3 text-13 text-muted-foreground italic rounded-md border border-dashed border-border bg-muted">
            No value required
          </div>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onAddAfter(idx)}
            title="Add condition below"
            aria-label={`Add condition after condition ${idx + 1}`}
            className="size-8 text-foreground hover:bg-muted border-border hover:border-border-hover rounded-md cursor-pointer shrink-0 shadow-none"
          >
            <Plus className="size-3.5 shrink-0" strokeWidth={1.5} />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onRemove(cond.id)}
            disabled={!canRemove}
            title="Remove condition"
            aria-label={`Remove condition ${idx + 1}`}
            className="size-8 text-foreground hover:bg-muted border-border hover:border-border-hover rounded-md cursor-pointer shrink-0 shadow-none"
          >
            <Minus className="size-3.5 shrink-0" strokeWidth={1.5} />
          </Button>
        </div>
      </div>
    </div>
  );
}
