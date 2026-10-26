'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Folder,
  Tag,
  FileText,
  Type,
  User,
  Calendar,
  BookOpen,
  AlignLeft,
  Layers,
  Hash,
  Barcode,
  Globe,
  CalendarPlus,
  CalendarClock,
  StickyNote,
  Paperclip,
  CheckCircle2,
  Star,
  ChevronsUpDown,
  Check,
  Search,
  X,
} from 'lucide-react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/shared/components/ui/popover';
import { cn } from '@/shared/lib/utils';
import type { SavedSearchField } from '@/features/library/domain/types/saved-searches.types';
import {
  PRIMARY_SAVED_SEARCH_FIELD_ITEMS,
  ALL_SCHEMA_FIELD_ITEMS,
  getFieldConfig,
} from '@/features/library/domain/saved-search-schema.domain';

export const FIELD_ICONS: Record<
  string,
  React.ComponentType<{ className?: string; strokeWidth?: number | string }>
> = {
  title: Type,
  creator: User,
  year: Calendar,
  dateAdded: CalendarPlus,
  dateModified: CalendarClock,
  anyField: Search,
  itemType: Layers,
  collection: Folder,
  tag: Tag,
  noteContent: StickyNote,
  attachmentContent: FileText,
  attachmentFilename: Paperclip,
  doi: Hash,
  isbn: Barcode,
  url: Globe,
  readStatus: CheckCircle2,
  rating: Star,
  publicationTitle: BookOpen,
  abstract: AlignLeft,
};

export const PRIMARY_FIELDS = PRIMARY_SAVED_SEARCH_FIELD_ITEMS.map((item) => ({
  ...item,
  icon: FIELD_ICONS[item.value] || BookOpen,
}));

export const ALL_SCHEMA_FIELDS = ALL_SCHEMA_FIELD_ITEMS.map((item) => ({
  ...item,
  icon: FIELD_ICONS[item.value] || BookOpen,
}));

export interface ConditionFieldSelectProps {
  value: SavedSearchField;
  onChange: (field: SavedSearchField) => void;
  ariaLabel?: string;
}

export function ConditionFieldSelect({
  value,
  onChange,
  ariaLabel,
}: ConditionFieldSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const activeConfig = getFieldConfig(value);
  const ActiveIcon = FIELD_ICONS[value] || BookOpen;

  const filteredPrimary = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return PRIMARY_FIELDS;
    return PRIMARY_FIELDS.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.value.toLowerCase().includes(q),
    );
  }, [search]);

  const filteredAZ = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ALL_SCHEMA_FIELDS;
    return ALL_SCHEMA_FIELDS.filter(
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
      setSearch('');
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel || 'Select field'}
          className="w-full sm:w-[175px] h-8 px-2.5 flex items-center justify-between gap-1.5 text-13 font-normal text-foreground bg-background border border-border rounded-md hover:border-border-hover focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-ring transition-colors shrink-0 select-none cursor-pointer"
        >
          <span className="flex items-center gap-1.5 min-w-0 truncate">
            <ActiveIcon className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            <span className="truncate">{activeConfig.label}</span>
          </span>
          <ChevronsUpDown className="size-3.5 text-foreground shrink-0 ml-1" strokeWidth={1.5} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[230px] p-0 rounded-lg border border-border shadow-raised-300 bg-popover text-popover-foreground overflow-hidden z-50"
      >
        <div className="p-1.5 border-b border-border">
          <div className="flex items-center gap-1.5 h-8 px-2 rounded-md bg-background border border-border text-13 focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-colors hover:border-border-hover">
            <Search className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            <input
              ref={inputRef}
              type="text"
              aria-label="Filter fields"
              placeholder="Filter fields..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setOpen(false);
                } else if (e.key === 'Enter') {
                  const first = filteredPrimary[0] || filteredAZ[0];
                  if (first) {
                    onChange(first.value);
                    setOpen(false);
                  }
                }
              }}
              className="flex-1 min-w-0 h-full bg-transparent text-13 text-foreground placeholder:text-muted-foreground outline-none leading-none font-sans"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-muted-foreground hover:text-foreground hover:bg-muted p-0.5 rounded cursor-pointer flex items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Clear filter"
              >
                <X className="size-3 shrink-0" strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[280px] overflow-y-auto scrollbar-thin p-1 space-y-2">
          {filteredPrimary.length === 0 && filteredAZ.length === 0 ? (
            <div className="py-6 text-center text-11 text-foreground select-none">
              No matching fields
            </div>
          ) : (
            <>
              {filteredPrimary.length > 0 && (
                <div className="space-y-0.5">
                  <div className="px-2 pt-1 pb-0.5 text-10 font-semibold text-muted-foreground uppercase tracking-wider select-none">
                    Primary Fields
                  </div>
                  {filteredPrimary.map((field) => {
                    const isSelected = field.value === value;
                    const Icon = field.icon;
                    return (
                      <button
                        key={field.value}
                        type="button"
                        onClick={() => {
                          onChange(field.value);
                          setOpen(false);
                        }}
                        className={cn(
                          'w-full h-7 px-2 py-1 flex items-center justify-between gap-2 rounded-sm text-13 text-left transition-colors cursor-pointer select-none',
                          isSelected
                            ? 'bg-muted font-medium text-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Icon className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                          <span className="truncate">{field.label}</span>
                        </span>
                        {isSelected && (
                          <Check className="size-3.5 text-foreground shrink-0 ml-1" strokeWidth={1.5} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {filteredAZ.length > 0 && (
                <div className="-mx-1 px-1 space-y-0.5 pt-1 border-t border-border">
                  <div className="px-2 pt-1 pb-0.5 text-10 font-semibold text-muted-foreground uppercase tracking-wider select-none">
                    All Fields (A–Z)
                  </div>
                  {filteredAZ.map((field) => {
                    const isSelected = field.value === value;
                    const Icon = field.icon;
                    return (
                      <button
                        key={field.value}
                        type="button"
                        onClick={() => {
                          onChange(field.value);
                          setOpen(false);
                        }}
                        className={cn(
                          'w-full h-7 px-2 py-1 flex items-center justify-between gap-2 rounded-sm text-13 text-left transition-colors cursor-pointer select-none',
                          isSelected
                            ? 'bg-muted font-medium text-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Icon className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
                          <span className="truncate">{field.label}</span>
                        </span>
                        {isSelected && (
                          <Check className="size-3.5 text-foreground shrink-0 ml-1" strokeWidth={1.5} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
