'use client';

import React, { useState } from 'react';
import {
  ListFilter,
  Check,
  RotateCcw,
  Folder,
  FileText,
  Table2,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  ArrowUpDown,
  ChevronDown,
} from 'lucide-react';
import { Button } from "@/shared/components/ui";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/shared/components/ui";
import { Checkbox } from "@/shared/components/ui";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import {
  useStorageFilterStore,
  type StorageTypeFilter,
  type StorageSortBy,
} from '../../store/use-filter-store';

const TYPE_OPTIONS: {
  label: string;
  value: StorageTypeFilter;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { label: 'Documents', value: 'document', icon: FileText },
  { label: 'Images', value: 'image', icon: ImageIcon },
  { label: 'Videos', value: 'video', icon: Video },
  { label: 'Audio', value: 'audio', icon: Music },
  { label: 'Spreadsheets', value: 'spreadsheet', icon: Table2 },
  { label: 'Archives', value: 'archive', icon: Archive },
  { label: 'Folders', value: 'folder', icon: Folder },
];

const SORT_OPTIONS: { label: string; value: StorageSortBy }[] = [
  { label: 'Last modified: Newest', value: 'date-desc' },
  { label: 'Last modified: Oldest', value: 'date-asc' },
  { label: 'Name: A to Z', value: 'name-asc' },
  { label: 'Name: Z to A', value: 'name-desc' },
  { label: 'File size: Largest', value: 'size-desc' },
  { label: 'File size: Smallest', value: 'size-asc' },
];

export function StorageFilterPopover() {
  const [open, setOpen] = useState(false);
  const [isTypesOpen, setIsTypesOpen] = useState(true);
  const [isSortOpen, setIsSortOpen] = useState(false);

  const {
    selectedTypes,
    sortBy,
    toggleType,
    setSortBy,
    resetFilters,
    isFilterActive,
    getActiveFilterCount,
  } = useStorageFilterStore();

  const isActive = isFilterActive();
  const activeCount = getActiveFilterCount();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  'relative size-8 rounded-md bg-transparent border border-border hover:bg-muted cursor-pointer outline-none transition-colors',
                  isActive &&
                    'bg-muted border-primary text-primary hover:bg-muted hover:text-primary'
                )}
                aria-label="Filter & sort"
              >
                <ListFilter className="size-4 shrink-0" strokeWidth={1.5} />
                {isActive && (
                  <span className="absolute -top-1 -right-1 size-2 rounded-full bg-primary" />
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6} className="text-xs">
            Filter & sort {activeCount > 0 ? `(${activeCount})` : ''}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-80 p-3 rounded-md border border-border bg-popover text-popover-foreground z-50 select-none animate-in fade-in-0 zoom-in-95"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-border">
          <div className="flex items-center gap-1.5">
            <ListFilter className="size-3.5 text-primary shrink-0" />
            <span className="text-xs font-semibold text-foreground">Filter & Sort</span>
            {activeCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-10 font-semibold bg-muted border border-border text-foreground">
                {activeCount}
              </span>
            )}
          </div>
          {isActive && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-11 font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none"
            >
              <RotateCcw className="size-3 shrink-0" />
              Reset all
            </button>
          )}
        </div>

        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
          {/* 1. File Type Section */}
          <div>
            <button
              type="button"
              onClick={() => setIsTypesOpen(!isTypesOpen)}
              className="flex items-center justify-between w-full py-1 text-xs font-semibold text-foreground hover:text-foreground cursor-pointer outline-none"
            >
              <div className="flex items-center gap-1.5">
                <span>File type</span>
                {selectedTypes.length > 0 && (
                  <span className="text-10 text-primary font-medium">
                    ({selectedTypes.length})
                  </span>
                )}
              </div>
              <ChevronDown
                className={cn(
                  'size-3.5 text-muted-foreground shrink-0 transition-transform duration-200',
                  isTypesOpen ? '' : '-rotate-90'
                )}
              />
            </button>

            {isTypesOpen && (
              <div className="mt-1 space-y-0.5">
                {TYPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isChecked = selectedTypes.includes(opt.value);
                  return (
                    <div
                      key={opt.value}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleType(opt.value)}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          toggleType(opt.value);
                        }
                      }}
                      className={cn(
                        'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors',
                        isChecked
                          ? 'bg-accent text-foreground font-medium'
                          : 'hover:bg-muted text-foreground'
                      )}
                    >
                      <Checkbox
                        checked={isChecked}
                        tabIndex={-1}
                        className="pointer-events-none"
                      />
                      <Icon className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{opt.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Sort By Section */}
          <div className="border-t border-border pt-2.5">
            <button
              type="button"
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="flex items-center justify-between w-full py-1 text-xs font-semibold text-foreground hover:text-foreground cursor-pointer outline-none"
            >
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="size-3 text-muted-foreground shrink-0" />
                <span>Sort by</span>
              </div>
              <ChevronDown
                className={cn(
                  'size-3.5 text-muted-foreground shrink-0 transition-transform duration-200',
                  isSortOpen ? '' : '-rotate-90'
                )}
              />
            </button>

            {isSortOpen && (
              <div className="mt-1 space-y-0.5">
                {SORT_OPTIONS.map((opt) => {
                  const isSelected = sortBy === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSortBy(opt.value)}
                      className={cn(
                        'flex items-center justify-between w-full px-2 py-1.5 rounded-md text-xs text-left cursor-pointer transition-colors',
                        isSelected
                          ? 'bg-accent text-foreground font-medium'
                          : 'hover:bg-muted text-foreground'
                      )}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && <Check className="size-3.5 text-primary shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default StorageFilterPopover;
