'use client';

import React, { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Check,
  SlidersHorizontal,
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
  SubGroupByOption,
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
  { key: 'state', label: 'State' },
  { key: 'priority', label: 'Priority' },
  { key: 'assignee', label: 'Assignees' },
  { key: 'dueDate', label: 'Due date' },
  { key: 'startDate', label: 'Start date' },
  { key: 'labels', label: 'Labels' },
  { key: 'cycle', label: 'Cycle' },
  { key: 'childWorkItemCount', label: 'Sub-issues count' },
  { key: 'attachmentCount', label: 'Attachment count' },
  { key: 'link', label: 'Links' },
];

const GROUP_BY_OPTIONS: Array<{ value: GroupByOption; label: string }> = [
  { value: 'state', label: 'States' },
  { value: 'priority', label: 'Priority' },
  { value: 'cycle', label: 'Cycle' },
  { value: 'assignee', label: 'Assignees' },
  { value: 'labels', label: 'Labels' },
  { value: 'none', label: 'None' },
];

const SUB_GROUP_BY_OPTIONS: Array<{ value: SubGroupByOption; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'priority', label: 'Priority' },
  { value: 'assignee', label: 'Assignees' },
  { value: 'cycle', label: 'Cycle' },
  { value: 'labels', label: 'Labels' },
];

const ORDER_BY_OPTIONS: Array<{ value: OrderByOption; label: string }> = [
  { value: 'manual', label: 'Manual' },
  { value: 'createdAt', label: 'Last created' },
  { value: 'updatedAt', label: 'Last updated' },
  { value: 'priority', label: 'Priority' },
  { value: 'dueDate', label: 'Due date' },
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
    subGroupBy,
    orderBy,
    orderDirection,
    showEmptyGroups,
  } = displayOptions;
  const isChildWorkItemsShown = displayOptions.showChildWorkItems ?? true;

  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [groupByOpen, setGroupByOpen] = useState(true);
  const [subGroupByOpen, setSubGroupByOpen] = useState(false);
  const [orderByOpen, setOrderByOpen] = useState(true);
  const [extraOpen, setExtraOpen] = useState(true);

  const handleGroupByChange = (value: GroupByOption) => {
    onDisplayOptionsChange({
      ...displayOptions,
      groupBy: value,
    });
  };

  const handleSubGroupByChange = (value: SubGroupByOption) => {
    onDisplayOptionsChange({
      ...displayOptions,
      subGroupBy: value,
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
          className="h-8 px-2.5 text-xs font-medium bg-background text-foreground hover:bg-muted rounded-md border border-border cursor-pointer transition-colors shadow-2xs shrink-0 gap-1.5"
          aria-label="Display options"
        >
          <SlidersHorizontal className="size-3.5 text-muted-foreground shrink-0" />
          <span>Display</span>
          {activePropertyCount > 0 && (
            <span className="size-1.5 rounded-full bg-primary shrink-0" />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[320px] max-h-[85vh] overflow-y-auto p-0 rounded-lg text-xs border-border bg-popover divide-y divide-border shadow-md"
      >
        {/* 1. Display Properties */}
        <div className="p-3">
          <button
            type="button"
            onClick={() => setPropertiesOpen(!propertiesOpen)}
            className="flex w-full items-center justify-between text-xs font-semibold text-foreground hover:text-foreground/80 transition-colors cursor-pointer select-none pb-2"
          >
            <span>Display properties</span>
            {propertiesOpen ? (
              <ChevronUp className="size-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
            )}
          </button>

          {propertiesOpen && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {DISPLAY_PROPERTY_ITEMS.map((item) => {
                const isSelected = Boolean(properties[item.key]);
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onPropertyToggle(item.key, !isSelected)}
                    className={cn(
                      "px-2 py-0.5 text-11 font-medium rounded-md border transition-all cursor-pointer select-none",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary dark:bg-primary/20 font-semibold shadow-2xs"
                        : "border-border/70 bg-background text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. Group By (Plane.so checkmark list pattern) */}
        <div className="p-3">
          <button
            type="button"
            onClick={() => setGroupByOpen(!groupByOpen)}
            className="flex w-full items-center justify-between text-xs font-semibold text-foreground hover:text-foreground/80 transition-colors cursor-pointer select-none pb-1.5"
          >
            <span>Group by</span>
            {groupByOpen ? (
              <ChevronUp className="size-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
            )}
          </button>

          {groupByOpen && (
            <div role="radiogroup" aria-label="Group by" className="space-y-0.5 pt-0.5">
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
                      "flex w-full items-center justify-between py-1.5 px-2 rounded-md text-xs transition-colors cursor-pointer select-none",
                      isSelected
                        ? "bg-accent/80 text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    <span>{opt.label}</span>
                    {isSelected && (
                      <Check className="size-3.5 text-primary stroke-[2.2] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Sub-group By (Kanban swimlanes) */}
        <div className="p-3">
          <button
            type="button"
            onClick={() => setSubGroupByOpen(!subGroupByOpen)}
            className="flex w-full items-center justify-between text-xs font-semibold text-foreground hover:text-foreground/80 transition-colors cursor-pointer select-none pb-1.5"
          >
            <span>Sub-group by</span>
            {subGroupByOpen ? (
              <ChevronUp className="size-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
            )}
          </button>

          {subGroupByOpen && (
            <div role="radiogroup" aria-label="Sub-group by" className="space-y-0.5 pt-0.5">
              {SUB_GROUP_BY_OPTIONS.map((opt) => {
                const isSelected = subGroupBy === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleSubGroupByChange(opt.value)}
                    className={cn(
                      "flex w-full items-center justify-between py-1.5 px-2 rounded-md text-xs transition-colors cursor-pointer select-none",
                      isSelected
                        ? "bg-accent/80 text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    <span>{opt.label}</span>
                    {isSelected && (
                      <Check className="size-3.5 text-primary stroke-[2.2] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Order By */}
        <div className="p-3">
          <div className="flex w-full items-center justify-between text-xs font-semibold text-foreground select-none pb-1.5">
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
            <div role="radiogroup" aria-label="Order by" className="space-y-0.5 pt-0.5">
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
                      "flex w-full items-center justify-between py-1.5 px-2 rounded-md text-xs transition-colors cursor-pointer select-none",
                      isSelected
                        ? "bg-accent/80 text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    <span>{opt.label}</span>
                    {isSelected && (
                      <Check className="size-3.5 text-primary stroke-[2.2] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 5. Extra Options */}
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground select-none pb-0.5">
            <span>Extra options</span>
          </div>

          <label className="flex items-center justify-between text-xs text-foreground cursor-pointer select-none py-1 px-1 rounded hover:bg-muted/50 transition-colors">
            <span className="text-muted-foreground font-medium">Show empty groups</span>
            <Checkbox
              checked={showEmptyGroups}
              onCheckedChange={handleShowEmptyGroupsToggle}
              className="size-4 rounded-xs border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between text-xs text-foreground cursor-pointer select-none py-1 px-1 rounded hover:bg-muted/50 transition-colors">
            <span className="text-muted-foreground font-medium">Show sub-work items</span>
            <Checkbox
              checked={isChildWorkItemsShown}
              onCheckedChange={handleShowChildWorkItemsToggle}
              className="size-4 rounded-xs border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary cursor-pointer"
            />
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default DisplayPopover;
