'use client';

import React, { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ArrowUpNarrowWide,
  ArrowDownNarrowWide,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { cn } from "@/shared/lib/utils";
import type {
  GroupByOption,
  OrderByOption,
} from '@/features/projects/project-id/work-items/types/work-item.types';
import type { DisplayPopoverProps } from '@/features/projects/project-id/work-items/types/layout.types';
import {
  DISPLAY_PROPERTY_ITEMS,
  GROUP_BY_OPTIONS,
  ORDER_BY_OPTIONS,
} from '@/features/projects/project-id/work-items/utils/display.utils';

export type { DisplayPopoverProps };

export function DisplayPopover({
  displayOptions,
  onDisplayOptionsChange = () => {},
  onPropertyToggle = () => {},
  open = false,
  onOpenChange = () => {},
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

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          className="relative h-8 px-3 text-13 font-medium bg-background text-foreground hover:bg-muted rounded-md border border-border cursor-pointer transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
          aria-label="Display options"
        >
          <span>Display</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-68 sm:w-72 max-h-[85vh] overflow-y-auto p-2 rounded-md text-12 border-border bg-popover shadow-overlay space-y-2"
      >
        {/* 1. Group By */}
        <div>
          <button
            type="button"
            onClick={() => setGroupByOpen(!groupByOpen)}
            className="flex w-full items-center justify-between px-1 py-1 text-12 font-medium text-foreground hover:bg-muted/50 transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
          >
            <span>Group by</span>
            {groupByOpen ? (
              <ChevronUp className="size-3.5 text-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-3.5 text-foreground shrink-0" />
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
                      "flex w-full items-center gap-2.5 py-1.5 px-2 rounded-md text-12 transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      isSelected
                        ? "text-foreground font-medium"
                        : "text-foreground hover:bg-muted/40"
                    )}
                  >
                    <div
                      className={cn(
                        "size-4 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                        isSelected
                          ? "border-primary bg-background"
                          : "border-border bg-background"
                      )}
                    >
                      {isSelected && <div className="size-2 rounded-full bg-primary" />}
                    </div>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border" />

        {/* 2. Order By */}
        <div>
          <div className="flex w-full items-center justify-between px-1 py-1 text-12 font-medium text-foreground select-none">
            <button
              type="button"
              onClick={() => setOrderByOpen(!orderByOpen)}
              className="flex items-center gap-1 hover:bg-muted/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-1"
            >
              <span>Order by</span>
              {orderByOpen ? (
                <ChevronUp className="size-3.5 text-foreground shrink-0" />
              ) : (
                <ChevronDown className="size-3.5 text-foreground shrink-0" />
              )}
            </button>
            <button
              type="button"
              onClick={toggleOrderDirection}
              className="relative p-1 rounded-md border border-border hover:bg-muted text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden"
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
                        : "text-foreground hover:bg-muted/40"
                    )}
                  >
                    <div
                      className={cn(
                        "size-4 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                        isSelected
                          ? "border-primary bg-background"
                          : "border-border bg-background"
                      )}
                    >
                      {isSelected && <div className="size-2 rounded-full bg-primary" />}
                    </div>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border" />

        {/* 3. Display Properties */}
        <div>
          <button
            type="button"
            onClick={() => setPropertiesOpen(!propertiesOpen)}
            className="flex w-full items-center justify-between px-1 py-1 text-12 font-medium text-foreground hover:bg-muted/50 transition-colors cursor-pointer select-none rounded"
          >
            <span>Display properties</span>
            {propertiesOpen ? (
              <ChevronUp className="size-3.5 text-foreground shrink-0" />
            ) : (
              <ChevronDown className="size-3.5 text-foreground shrink-0" />
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
                      "px-2.5 py-1 text-12 font-medium rounded-md border transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring relative before:absolute before:-inset-1 md:before:hidden",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-border" />

        {/* 4. Sub-work items and Empty groups checkboxes */}
        <div className="space-y-1 pt-0.5 select-none">
          <label className="flex items-center gap-2.5 text-12 text-foreground cursor-pointer select-none py-1 px-1 rounded-md hover:bg-muted/40 transition-colors">
            <Checkbox
              checked={isChildWorkItemsShown}
              onCheckedChange={handleShowChildWorkItemsToggle}
              className="size-4 rounded-sm border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary cursor-pointer"
            />
            <span className="font-normal">Show sub-work items</span>
          </label>

          <label className="flex items-center gap-2.5 text-12 text-foreground cursor-pointer select-none py-1 px-1 rounded-md hover:bg-muted/40 transition-colors">
            <Checkbox
              checked={showEmptyGroups}
              onCheckedChange={handleShowEmptyGroupsToggle}
              className="size-4 rounded-sm border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary cursor-pointer"
            />
            <span className="font-normal">Show empty groups</span>
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default DisplayPopover;
