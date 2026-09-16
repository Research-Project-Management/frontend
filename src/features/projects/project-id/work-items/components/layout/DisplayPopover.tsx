'use client';

import React, { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Check,
  ArrowUpNarrowWide,
  ArrowDownNarrowWide,
} from 'lucide-react';
import {
  Button,
  Checkbox,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import type {
  DisplayOptions,
  DisplayPropertyKey,
  GroupByOption,
  OrderByOption,
} from '../../types/work-item.types';

export interface DisplayPopoverProps {
  displayOptions: DisplayOptions;
  onDisplayOptionsChange: (options: DisplayOptions) => void;
  onPropertyToggle: (key: DisplayPropertyKey, value: boolean) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DISPLAY_PROPERTY_ITEMS: Array<{ key: DisplayPropertyKey; label: string }> = [
  { key: 'id', label: 'ID' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'startDate', label: 'Start date' },
  { key: 'dueDate', label: 'Due date' },
  { key: 'labels', label: 'Labels' },
  { key: 'priority', label: 'Priority' },
  { key: 'state', label: 'State' },
  { key: 'childWorkItemCount', label: 'Sub-work item count' },
  { key: 'attachmentCount', label: 'Attachment count' },
  { key: 'link', label: 'Link' },
];

const GROUP_BY_OPTIONS: Array<{ value: GroupByOption; label: string }> = [
  { value: 'state', label: 'States' },
  { value: 'priority', label: 'Priority' },
  { value: 'labels', label: 'Labels' },
  { value: 'assignee', label: 'Assignees' },
  { value: 'none', label: 'None' },
];

const ORDER_BY_OPTIONS: Array<{ value: OrderByOption; label: string }> = [
  { value: 'manual', label: 'Manual - Rank' },
  { value: 'createdAt', label: 'Created at' },
  { value: 'updatedAt', label: 'Updated at' },
  { value: 'dueDate', label: 'Due date' },
  { value: 'priority', label: 'Priority' },
];

export function DisplayPopover({
  displayOptions,
  onDisplayOptionsChange,
  onPropertyToggle,
  open,
  onOpenChange,
}: DisplayPopoverProps) {
  const {
    properties,
    groupBy,
    orderBy,
    orderDirection,
    showEmptyGroups,
  } = displayOptions;
  const isChildWorkItemsShown = displayOptions.showChildWorkItems ?? true;

  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [groupByOpen, setGroupByOpen] = useState(true);
  const [orderByOpen, setOrderByOpen] = useState(true);
  const [extraOpen, setExtraOpen] = useState(true);

  const handleGroupByChange = (value: GroupByOption) => {
    onDisplayOptionsChange({
      ...displayOptions,
      groupBy: value,
    });
  };

  const handleOrderByChange = (value: OrderByOption) => {
    onDisplayOptionsChange({
      ...displayOptions,
      orderBy: value,
    });
  };

  const toggleOrderDirection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDisplayOptionsChange({
      ...displayOptions,
      orderDirection: orderDirection === 'asc' ? 'desc' : 'asc',
    });
  };

  const handleShowEmptyGroupsToggle = (checked: boolean) => {
    onDisplayOptionsChange({
      ...displayOptions,
      showEmptyGroups: checked,
    });
  };

  const handleShowChildWorkItemsToggle = (checked: boolean) => {
    onDisplayOptionsChange({
      ...displayOptions,
      showChildWorkItems: checked,
    });
  };

  // Count active non-default overrides for badge indicator
  const activePropertyCount = Object.values(properties).filter(Boolean).length;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          className="h-8 px-3 text-13 font-medium bg-background text-foreground hover:bg-muted rounded-md border border-border cursor-pointer transition-colors shadow-2xs shrink-0"
          aria-label="Display options"
        >
          <span>Display</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-68 sm:w-72 max-h-[85vh] overflow-y-auto p-2 rounded-md text-12 border-border bg-popover shadow-none space-y-2"
      >
        {/* 1. Display Properties */}
        <div>
          <button
            type="button"
            onClick={() => setPropertiesOpen(!propertiesOpen)}
            className="flex w-full items-center justify-between px-1 py-1 text-12 font-medium text-foreground hover:text-foreground/80 transition-colors cursor-pointer select-none"
          >
            <span>Display properties</span>
            {propertiesOpen ? (
              <ChevronUp className="size-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
            )}
          </button>

          {propertiesOpen && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1.5 px-0.5">
              {DISPLAY_PROPERTY_ITEMS.map((item) => {
                const isSelected = Boolean(properties[item.key]);
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onPropertyToggle(item.key, !isSelected)}
                    className={cn(
                      "px-2.5 py-1 text-12 font-medium rounded-md border transition-colors cursor-pointer select-none",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/70 bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border/50" />

        {/* 2. Group By */}
        <div>
          <button
            type="button"
            onClick={() => setGroupByOpen(!groupByOpen)}
            className="flex w-full items-center justify-between px-1 py-1 text-12 font-medium text-foreground hover:text-foreground/80 transition-colors cursor-pointer select-none"
          >
            <span>Group by</span>
            {groupByOpen ? (
              <ChevronUp className="size-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
            )}
          </button>

          {groupByOpen && (
            <div role="radiogroup" aria-label="Group by" className="space-y-0.5 pt-1">
              {GROUP_BY_OPTIONS.map((opt) => {
                const isSelected = groupBy === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleGroupByChange(opt.value)}
                    className={cn(
                      "flex w-full items-center gap-2.5 py-1.5 px-2 rounded-md text-12 transition-colors cursor-pointer select-none",
                      isSelected
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    <div
                      className={cn(
                        "size-4 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40 bg-background"
                      )}
                    >
                      {isSelected && <Check className="size-2.5 text-primary-foreground stroke-[3] shrink-0" />}
                    </div>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border/50" />

        {/* 3. Order By */}
        <div>
          <div className="flex w-full items-center justify-between px-1 py-1 text-12 font-medium text-foreground select-none">
            <button
              type="button"
              onClick={() => setOrderByOpen(!orderByOpen)}
              className="flex items-center gap-1 hover:text-foreground/80 transition-colors cursor-pointer"
            >
              <span>Order by</span>
              {orderByOpen ? (
                <ChevronUp className="size-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
              )}
            </button>
            <button
              type="button"
              onClick={toggleOrderDirection}
              className="p-1 rounded border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title={orderDirection === 'asc' ? 'Ascending' : 'Descending'}
              aria-label="Toggle sort direction"
            >
              {orderDirection === 'asc' ? (
                <ArrowUpNarrowWide className="size-3 text-foreground shrink-0" />
              ) : (
                <ArrowDownNarrowWide className="size-3 text-foreground shrink-0" />
              )}
            </button>
          </div>

          {orderByOpen && (
            <div role="radiogroup" aria-label="Order by" className="space-y-0.5 pt-1">
              {ORDER_BY_OPTIONS.map((opt) => {
                const isSelected = orderBy === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleOrderByChange(opt.value)}
                    className={cn(
                      "flex w-full items-center gap-2.5 py-1.5 px-2 rounded-md text-12 transition-colors cursor-pointer select-none",
                      isSelected
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    <div
                      className={cn(
                        "size-4 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40 bg-background"
                      )}
                    >
                      {isSelected && <Check className="size-2.5 text-primary-foreground stroke-[3] shrink-0" />}
                    </div>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border/50" />

        {/* 4. Sub-work items and Empty groups checkboxes */}
        <div className="space-y-1 pt-0.5 select-none">
          <label className="flex items-center gap-2.5 text-12 text-foreground cursor-pointer select-none py-1 px-1 rounded-md hover:text-foreground/90 transition-colors">
            <Checkbox
              checked={isChildWorkItemsShown}
              onCheckedChange={handleShowChildWorkItemsToggle}
              className="size-4 rounded-xs border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary cursor-pointer"
            />
            <span className="font-normal">Show sub-work items</span>
          </label>

          <label className="flex items-center gap-2.5 text-12 text-foreground cursor-pointer select-none py-1 px-1 rounded-md hover:text-foreground/90 transition-colors">
            <Checkbox
              checked={showEmptyGroups}
              onCheckedChange={handleShowEmptyGroupsToggle}
              className="size-4 rounded-xs border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary cursor-pointer"
            />
            <span className="font-normal">Show empty groups</span>
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default DisplayPopover;
