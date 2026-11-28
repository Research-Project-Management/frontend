'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
  Search,
  X,
  Columns3,
  AlignJustify,
  ListFilter,
  Check,
  Files,
  Archive,
  Trash2,
  Tag,
} from 'lucide-react';
import type { PagesFilterTab } from './PagesSidebar';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { cn } from '@/shared/lib/utils';

export interface TopbarProps {
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  onCreateClick: (template?: 'blank' | 'example') => void;
  onImportZip?: (file: File) => void;
  onOpenImportDoc?: (format: 'docx' | 'md') => void;
  onOpenImportGithub?: () => void;
  onOpenTemplates?: (category: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  labels?: Array<{ id: string; name: string; color?: string }>;
  selectedLabelIds?: string[];
  onSelectLabelIds?: (labelIds: string[]) => void;
  activeFilter?: PagesFilterTab;
  activeViewLabel?: string;
}

const VIEW_OPTIONS = [
  { id: 'grid' as const, label: 'Board view', icon: Columns3 },
  { id: 'list' as const, label: 'List view', icon: AlignJustify },
] as const;

const TEMPLATE_CATEGORIES = [
  { label: 'Journal articles', category: 'journal' },
  { label: 'Conferences', category: 'conference' },
  { label: 'Books', category: 'book' },
  { label: 'Formal letters', category: 'letter' },
  { label: 'Assignments', category: 'assignment' },
  { label: 'Posters', category: 'poster' },
  { label: 'Presentations', category: 'presentation' },
  { label: 'Reports', category: 'report' },
  { label: 'CVs and résumés', category: 'cv' },
  { label: 'Theses', category: 'thesis' },
  { label: 'View all', category: 'all' },
] as const;

export function Topbar({
  viewMode,
  setViewMode,
  onCreateClick,
  onImportZip,
  onOpenImportDoc,
  onOpenImportGithub,
  onOpenTemplates,
  searchQuery = '',
  onSearchChange,
  labels = [],
  selectedLabelIds = [],
  onSelectLabelIds,
  activeFilter = 'all',
  activeViewLabel,
}: TopbarProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const isSearching = isSearchExpanded || Boolean(searchQuery);
  const activeLabelIds = selectedLabelIds;

  const handleToggleLabel = (labelId: string) => {
    const next = activeLabelIds.includes(labelId)
      ? activeLabelIds.filter((id) => id !== labelId)
      : [...activeLabelIds, labelId];
    onSelectLabelIds?.(next);
  };

  const selectedLabel = useMemo(
    () => (activeLabelIds.length === 1 ? labels.find((l) => l.id === activeLabelIds[0]) : null),
    [labels, activeLabelIds]
  );

  const filteredLabels = useMemo(() => {
    if (!filterSearch.trim()) return labels;
    const q = filterSearch.toLowerCase().trim();
    return labels.filter((l) => l.name.toLowerCase().includes(q));
  }, [labels, filterSearch]);

  return (
    <header
      className="flex items-center justify-between px-3 sm:px-4 h-11 border-b border-border bg-transparent sticky top-0 z-10 shrink-0 select-none overflow-x-auto scrollbar-none min-w-0"
      style={{ paddingLeft: 'max(1rem, var(--header-offset, 0px))' }}
    >
      {/* Left: Active Page / View Icon & Title */}
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        {activeFilter === 'all' && selectedLabel ? (
          <>
            <Tag
              className="size-4 shrink-0"
              style={{
                color: selectedLabel.color || '#0969DA',
                fill: `${selectedLabel.color || '#0969DA'}25`,
              }}
              strokeWidth={1.75}
            />
            <h1 className="text-sm font-semibold tracking-tight text-foreground truncate">
              {selectedLabel.name}
            </h1>
          </>
        ) : (
          <>
            {activeFilter === 'archived' ? (
              <Archive className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
            ) : activeFilter === 'trash' ? (
              <Trash2 className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
            ) : activeFilter === 'uncategorized' ? (
              <Tag className="size-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
            ) : (
              <Files className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
            )}
            <h1 className="text-sm font-semibold tracking-tight text-foreground truncate">
              {activeViewLabel || 'All pages'}
            </h1>
          </>
        )}
      </div>

      {/* Right: Collapsible Search, Label Filter, Segmented View Switcher & Add Document CTA */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 ml-auto">
        {/* Collapsible Search matching Sticky Topbar style: default is an icon button, click to open */}
        <div
          role="search"
          tabIndex={isSearching ? -1 : 0}
          aria-label="Search pages"
          className={cn(
            'relative flex items-center transition-all duration-300 ease-in-out h-8 rounded-md overflow-hidden group focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
            isSearching
              ? 'w-48 sm:w-64 border border-border bg-background'
              : 'w-8 hover:bg-muted cursor-pointer'
          )}
          onClick={() => {
            if (!isSearchExpanded) {
              setIsSearchExpanded(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }
          }}
          onKeyDown={(e) => {
            if (!isSearchExpanded && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              setIsSearchExpanded(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }
          }}
        >
          <Search
            className={cn(
              'absolute top-1/2 -translate-y-1/2 size-3.5 transition-all duration-300 ease-in-out z-10 text-muted-foreground shrink-0',
              isSearching ? 'left-2.5 translate-x-0' : 'left-1/2 -translate-x-1/2 group-hover:text-foreground'
            )}
          />
          <Input
            ref={inputRef}
            placeholder="Search pages..."
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            onBlur={() => !searchQuery && setIsSearchExpanded(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsSearchExpanded(false);
                onSearchChange?.('');
              }
            }}
            className={cn(
              'h-full text-13 py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground transition-opacity duration-200 pl-8 pr-8 text-foreground',
              isSearching ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
            autoFocus={isSearchExpanded}
          />
          {isSearching && (
            <button
              type="button"
              aria-label="Clear search"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                onSearchChange?.('');
                setIsSearchExpanded(false);
              }}
              className="absolute right-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-0.5 rounded-md relative touch-manipulation sm:after:hidden after:absolute after:-inset-2 after:content-[''] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <X className="size-3.5 shrink-0" />
            </button>
          )}
        </div>

        {/* Label Filter Popover Icon Button */}
        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    'relative size-8 rounded-md bg-transparent border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors shadow-none shrink-0 relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                  )}
                  aria-label={
                    activeLabelIds.length > 0
                      ? `Filtered: ${activeLabelIds.length} label${activeLabelIds.length > 1 ? 's' : ''}`
                      : 'Filter by label'
                  }
                >
                  <ListFilter className="size-4 shrink-0" strokeWidth={1.75} />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="text-11 px-2 py-0.5 rounded-md font-medium">
              {activeLabelIds.length === 1 && selectedLabel
                ? `Filter: ${selectedLabel.name}`
                : activeLabelIds.length > 1
                  ? `Filter: ${activeLabelIds.length} labels`
                  : 'Filter by label'}
            </TooltipContent>
          </Tooltip>

          <PopoverContent
            align="end"
            sideOffset={6}
            className="w-60 p-0 py-1.5 bg-popover border border-border rounded-md shadow-overlay text-foreground overflow-hidden"
          >
            {/* Search Input: Clean background, proper border and active styling */}
            {labels.length > 0 && (
              <div className="px-2 pb-1.5">
                <div className="relative flex items-center">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground shrink-0 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search labels..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    className="h-8 w-full pl-8 pr-7 text-13 bg-background border border-border rounded-md outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none focus:border-border text-foreground placeholder:text-muted-foreground transition-colors"
                    autoFocus
                  />
                  {filterSearch && (
                    <button
                      type="button"
                      onClick={() => setFilterSearch('')}
                      className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded-sm relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      aria-label="Clear search"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div
              className="space-y-0.5 max-h-56 overflow-y-auto pl-1.5 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40 [&::-webkit-scrollbar-button]:hidden"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }}
            >
              {filteredLabels.map((label) => {
                const isSelected = activeLabelIds.includes(label.id);
                const color = label.color || '#0969DA';
                return (
                  <div
                    key={label.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleToggleLabel(label.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggleLabel(label.id);
                      }
                    }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-2 py-1.5 text-12 rounded-md cursor-pointer transition-colors text-left select-none group',
                      isSelected
                        ? 'bg-muted/70 text-foreground font-medium'
                        : 'text-foreground/80 hover:bg-muted/50 hover:text-foreground'
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      className="pointer-events-none shrink-0"
                    />
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate flex-1">{label.name}</span>
                  </div>
                );
              })}

              {labels.length > 0 && filteredLabels.length === 0 && (
                <p className="text-12 text-muted-foreground py-2 text-center">
                  No labels found
                </p>
              )}

              {labels.length === 0 && (
                <p className="text-12 text-muted-foreground py-3 text-center">
                  No labels assigned
                </p>
              )}
            </div>

            {activeLabelIds.length > 0 && (
              <div className="pt-1.5 px-2 border-t border-border mt-1">
                <button
                  type="button"
                  onClick={() => onSelectLabelIds?.([])}
                  className="w-full text-center py-1 text-12 text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-md hover:bg-muted/60 font-medium relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  Clear filter
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Segmented View Switcher matching Storage and Work-Items */}
        <div
          role="tablist"
          aria-label="View mode"
          className="flex items-center bg-muted/70 p-0.5 rounded-md shrink-0 gap-0.5 h-8 border border-border/40"
        >
          {VIEW_OPTIONS.map((opt) => {
            const IconComp = opt.icon;
            const isSelected = viewMode === opt.id;
            return (
              <Tooltip key={opt.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => React.startTransition(() => setViewMode(opt.id))}
                    className={cn(
                      'relative size-7 flex items-center justify-center rounded-md cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden',
                      isSelected
                        ? 'bg-background border border-border/50 text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                    )}
                    aria-label={opt.label}
                  >
                    <span className="relative z-10 flex items-center justify-center">
                      <IconComp className="size-4 shrink-0" strokeWidth={1.75} />
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  sideOffset={6}
                  className="text-11 px-2 py-0.5 rounded-md font-medium"
                >
                  {opt.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Primary Action CTA: "New" menu mirroring Overleaf's New project menu */}
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) onImportZip?.(file);
          }}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              className="h-8 rounded-md px-3 text-12 font-medium cursor-pointer shadow-none relative before:absolute before:-inset-1 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Add page
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="w-56 text-12 shadow-overlay">
            <DropdownMenuItem className="text-12 cursor-pointer" onSelect={() => onCreateClick('blank')}>
              Blank page
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-11 font-normal text-muted-foreground">Import</DropdownMenuLabel>
            <DropdownMenuItem className="text-12 cursor-pointer" onSelect={() => zipInputRef.current?.click()}>
              ZIP archive
            </DropdownMenuItem>
            <DropdownMenuItem className="text-12 cursor-pointer" onSelect={() => onOpenImportDoc?.('docx')}>
              Word document
            </DropdownMenuItem>
            <DropdownMenuItem className="text-12 cursor-pointer" onSelect={() => onOpenImportDoc?.('md')}>
              Markdown document
            </DropdownMenuItem>
            <DropdownMenuItem className="text-12 cursor-pointer" onSelect={() => onOpenImportGithub?.()}>
              GitHub repo
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-11 font-normal text-muted-foreground">Templates</DropdownMenuLabel>
            <DropdownMenuItem className="text-12 cursor-pointer" onSelect={() => onCreateClick('example')}>
              Example page
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-12 cursor-pointer">More templates</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52 text-12 shadow-overlay">
                {TEMPLATE_CATEGORIES.map((item) => (
                  <DropdownMenuItem
                    key={item.category}
                    className="text-12 cursor-pointer"
                    onSelect={() => onOpenTemplates?.(item.category)}
                  >
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default Topbar;
