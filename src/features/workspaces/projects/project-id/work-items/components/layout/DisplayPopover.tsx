'use client';

import React, { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Check,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
} from 'lucide-react';
import { Button } from "@/shared/components/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui";
import { Checkbox } from "@/shared/components/ui";
import { Separator } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import type {
  DisplayOptions,
  DisplayPropertyKey,
  GroupByOption,
  SubGroupByOption,
  OrderByOption,
} from '../../types/types';

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
  { key: 'subtaskCount', label: 'Subtasks count' },
  { key: 'attachmentCount', label: 'Attachment count' },
  { key: 'link', label: 'Link' },
  { key: 'dependencies', label: 'Dependencies' },
  { key: 'attach', label: 'Attach' },
  { key: 'cycle', label: 'Cycle' },
];

const GROUP_BY_OPTIONS: Array<{ value: GroupByOption; label: string }> = [
  { value: 'state', label: 'States' },
  { value: 'priority', label: 'Priority' },
  { value: 'cycle', label: 'Cycle' },
  { value: 'attach', label: 'Attach' },
  { value: 'labels', label: 'Labels' },
  { value: 'assignee', label: 'Assignees' },
  { value: 'createdBy', label: 'Created by' },
];

const SUB_GROUP_BY_OPTIONS: Array<{ value: SubGroupByOption; label: string }> = [
  { value: 'priority', label: 'Priority' },
  { value: 'cycle', label: 'Cycle' },
  { value: 'attach', label: 'Attach' },
  { value: 'labels', label: 'Labels' },
  { value: 'assignee', label: 'Assignees' },
  { value: 'createdBy', label: 'Created by' },
  { value: 'none', label: 'None' },
];

const ORDER_BY_OPTIONS: Array<{ value: OrderByOption; label: string }> = [
  { value: 'manual', label: 'Manual - Rank' },
  { value: 'createdAt', label: 'Created at' },
  { value: 'updatedAt', label: 'Updated at' },
  { value: 'startDate', label: 'Start date' },
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
    subGroupBy,
    orderBy,
    orderDirection,
    showEmptyGroups,
  } = displayOptions;
  const isSubtasksShown = displayOptions.showSubtasks ?? displayOptions.showSubWorkItems ?? true;

  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [groupByOpen, setGroupByOpen] = useState(true);
  const [subGroupByOpen, setSubGroupByOpen] = useState(true);
  const [orderByOpen, setOrderByOpen] = useState(true);

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

  const handleShowSubtasksToggle = (checked: boolean) => {
    onDisplayOptionsChange({
      ...displayOptions,
      showSubtasks: checked,
      showSubWorkItems: checked,
    });
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          className="h-8 px-3 text-13 font-medium bg-background text-foreground hover:bg-muted rounded-md border border-border cursor-pointer transition-colors shrink-0"
          aria-label="Display options"
        >
          <span>Display</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[310px] sm:w-[330px] max-h-[85vh] overflow-y-auto p-3.5 space-y-3 rounded-md text-xs border-border bg-popover"
      >
        {/* 1. Display Properties */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setPropertiesOpen(!propertiesOpen)}
            className="flex w-full items-center justify-between text-13 font-medium text-foreground hover:opacity-80 transition-opacity cursor-pointer select-none"
          >
            <span>Display Properties</span>
            {propertiesOpen ? (
              <ChevronUp className="size-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground shrink-0" />
            )}
          </button>

          {propertiesOpen && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {DISPLAY_PROPERTY_ITEMS.map((item) => {
                const isSelected = Boolean(properties[item.key]);
                return (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onPropertyToggle(item.key, !isSelected)}
                    className={cn(
                      "px-2.5 py-1 text-12 font-medium rounded-md transition-all cursor-pointer select-none",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                        : "border border-border bg-background text-foreground hover:bg-muted"
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <Separator className="bg-border" />

        {/* 2. Group By */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setGroupByOpen(!groupByOpen)}
            className="flex w-full items-center justify-between text-13 font-medium text-foreground hover:opacity-80 transition-opacity cursor-pointer select-none"
          >
            <span>Group by</span>
            {groupByOpen ? (
              <ChevronUp className="size-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground shrink-0" />
            )}
          </button>

          {groupByOpen && (
            <div role="radiogroup" aria-label="Group by" className="space-y-0.5 pt-0.5">
              {GROUP_BY_OPTIONS.map((opt) => {
                const isSelected = groupBy === opt.value;
                return (
                  <div
                    key={opt.value}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleGroupByChange(opt.value);
                      }
                    }}
                    onClick={() => handleGroupByChange(opt.value)}
                    className="flex items-center gap-2.5 py-1 px-1 rounded-sm cursor-pointer text-13 text-foreground hover:bg-muted select-none group outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  >
                    <div
                      className={cn(
                        "size-4 rounded-full flex items-center justify-center transition-colors shrink-0",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "border border-muted-foreground/35 group-hover:border-foreground"
                      )}
                    >
                      {isSelected && <Check className="size-2.5 stroke-[3] text-primary-foreground shrink-0" />}
                    </div>
                    <span className="font-normal">{opt.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Separator className="bg-border" />

        {/* 3. Sub-group By */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setSubGroupByOpen(!subGroupByOpen)}
            className="flex w-full items-center justify-between text-13 font-medium text-foreground hover:opacity-80 transition-opacity cursor-pointer select-none"
          >
            <span>Sub-group by</span>
            {subGroupByOpen ? (
              <ChevronUp className="size-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground shrink-0" />
            )}
          </button>

          {subGroupByOpen && (
            <div role="radiogroup" aria-label="Sub-group by" className="space-y-0.5 pt-0.5">
              {SUB_GROUP_BY_OPTIONS.map((opt) => {
                const isSelected = subGroupBy === opt.value;
                return (
                  <div
                    key={opt.value}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSubGroupByChange(opt.value);
                      }
                    }}
                    onClick={() => handleSubGroupByChange(opt.value)}
                    className="flex items-center gap-2.5 py-1 px-1 rounded-sm cursor-pointer text-13 text-foreground hover:bg-muted select-none group outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  >
                    <div
                      className={cn(
                        "size-4 rounded-full flex items-center justify-center transition-colors shrink-0",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "border border-muted-foreground/35 group-hover:border-foreground"
                      )}
                    >
                      {isSelected && <Check className="size-2.5 stroke-[3] text-primary-foreground shrink-0" />}
                    </div>
                    <span className="font-normal">{opt.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Separator className="bg-border" />

        {/* 4. Order By */}
        <div className="space-y-2">
          <div className="flex w-full items-center justify-between text-13 font-medium text-foreground select-none">
            <button
              type="button"
              onClick={() => setOrderByOpen(!orderByOpen)}
              className="flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer font-medium text-foreground text-13"
            >
              <span>Order by</span>
              {orderByOpen ? (
                <ChevronUp className="size-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="size-4 text-muted-foreground shrink-0" />
              )}
            </button>
            <button
              type="button"
              onClick={toggleOrderDirection}
              className="p-1 rounded-sm border border-border hover:bg-muted text-foreground transition-colors cursor-pointer"
              title={orderDirection === 'asc' ? 'Ascending' : 'Descending'}
              aria-label="Toggle sort direction"
            >
              {orderDirection === 'asc' ? (
                <ArrowUpNarrowWide className="size-3.5 text-foreground shrink-0" />
              ) : (
                <ArrowDownNarrowWide className="size-3.5 text-foreground shrink-0" />
              )}
            </button>
          </div>

          {orderByOpen && (
            <div role="radiogroup" aria-label="Order by" className="space-y-0.5 pt-0.5">
              {ORDER_BY_OPTIONS.map((opt) => {
                const isSelected = orderBy === opt.value;
                return (
                  <div
                    key={opt.value}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOrderByChange(opt.value);
                      }
                    }}
                    onClick={() => handleOrderByChange(opt.value)}
                    className="flex items-center gap-2.5 py-1 px-1 rounded-sm cursor-pointer text-13 text-foreground hover:bg-muted select-none group outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  >
                    <div
                      className={cn(
                        "size-4 rounded-full flex items-center justify-center transition-colors shrink-0",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "border border-border group-hover:border-foreground"
                      )}
                    >
                      {isSelected && <Check className="size-2.5 stroke-[3] text-primary-foreground shrink-0" />}
                    </div>
                    <span className="font-normal">{opt.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Separator className="bg-border" />

        {/* 5. Extra Toggles */}
        <div className="space-y-2 pt-1 pb-1">
          <label className="flex items-center gap-2.5 text-13 text-foreground cursor-pointer select-none py-0.5">
            <Checkbox
              checked={isSubtasksShown}
              onCheckedChange={handleShowSubtasksToggle}
              className="size-4 rounded-sm border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary cursor-pointer"
            />
            <span>Show subtasks</span>
          </label>

          <label className="flex items-center gap-2.5 text-13 text-foreground cursor-pointer select-none py-0.5">
            <Checkbox
              checked={showEmptyGroups}
              onCheckedChange={handleShowEmptyGroupsToggle}
              className="size-4 rounded-sm border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary cursor-pointer"
            />
            <span>Show empty groups</span>
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default DisplayPopover;
