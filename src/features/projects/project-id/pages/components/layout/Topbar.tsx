'use client';

import React, { useState, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { PenLine, Search, X, Columns3, AlignJustify, ListFilter, Check } from 'lucide-react';
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
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { cn } from '@/shared/lib/utils';
import { Switcher } from '@/features/projects/project-id/components/layout/Switcher';

export interface TopbarProps {
  project?: {
    id?: string;
    name?: string;
    avatar?: string | null;
  };
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  /** Open the create dialog preselected with the chosen starter template. */
  onCreateClick: (template?: 'blank' | 'example') => void;
  /** Import an existing LaTeX project (.zip) into the current project. */
  onImportZip?: (file: File) => void;
  /** Open the document conversion modal for Word (.docx) or Markdown (.md). */
  onOpenImportDoc?: (format: 'docx' | 'md') => void;
  /** Open the GitHub repository import modal. */
  onOpenImportGithub?: () => void;
  /** Open the template gallery modal, optionally pre-filtered by category. */
  onOpenTemplates?: (category: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  projectLabels?: Array<{ id: string; name: string; color?: string }>;
  selectedLabelId?: string | null;
  onSelectLabelId?: (labelId: string | null) => void;
  selectedLabelIds?: string[];
  onSelectLabelIds?: (labelIds: string[]) => void;
}

const VIEW_OPTIONS = [
  { id: 'grid' as const, label: 'Board view', icon: Columns3 },
  { id: 'list' as const, label: 'List view', icon: AlignJustify },
] as const;


const OVERLEAF_TEMPLATE_CATEGORIES = [
  { label: 'Journal articles', category: 'journal' },
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
  project,
  viewMode,
  setViewMode,
  onCreateClick,
  onImportZip,
  onOpenImportDoc,
  onOpenImportGithub,
  onOpenTemplates,
  searchQuery = '',
  onSearchChange,
  projectLabels = [],
  selectedLabelId = null,
  onSelectLabelId,
  selectedLabelIds,
  onSelectLabelIds,
}: TopbarProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const isSearching = isSearchExpanded || Boolean(searchQuery);

  const activeLabelIds = useMemo(() => {
    if (selectedLabelIds !== undefined) return selectedLabelIds;
    return selectedLabelId ? [selectedLabelId] : [];
  }, [selectedLabelIds, selectedLabelId]);

  const handleToggleLabel = (labelId: string) => {
    const next = activeLabelIds.includes(labelId)
      ? activeLabelIds.filter((id) => id !== labelId)
      : [...activeLabelIds, labelId];
    if (onSelectLabelIds) {
      onSelectLabelIds(next);
    } else if (onSelectLabelId) {
      onSelectLabelId(next.length === 1 ? next[0] : (next.length === 0 ? null : next[next.length - 1]));
    }
  };

  const selectedLabel = useMemo(
    () => (activeLabelIds.length === 1 ? projectLabels.find((l) => l.id === activeLabelIds[0]) : null),
    [projectLabels, activeLabelIds]
  );

  const filteredLabels = useMemo(() => {
    if (!filterSearch.trim()) return projectLabels;
    const q = filterSearch.toLowerCase().trim();
    return projectLabels.filter((l) => l.name.toLowerCase().includes(q));
  }, [projectLabels, filterSearch]);

  return (
    <header
      className="flex items-center justify-between px-3 sm:px-4 h-11 border-b border-border bg-transparent sticky top-0 z-10 shrink-0 select-none overflow-x-auto scrollbar-none min-w-0"
      style={{ paddingLeft: 'max(1rem, var(--header-offset, 0px))' }}
    >
      {/* Left: Project Switcher & Module Title */}
      <Switcher
        project={project}
        moduleTitle="Pages"
        moduleIcon={PenLine}
      />

      {/* Right: Collapsible Search, Label Filter, Segmented View Switcher & Add Document CTA */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 ml-auto">
        {/* Collapsible Search matching Sticky Topbar style: default is an icon button, click to open */}
        <div
          role="search"
          tabIndex={isSearching ? -1 : 0}
          aria-label="Search pages"
          className={cn(
            'relative flex items-center transition-all duration-300 ease-in-out h-8 rounded-md overflow-hidden group focus-visible:ring-2 focus-visible:ring-ring',
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
              'h-full text-xs py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground transition-opacity duration-200 pl-8 pr-8 text-foreground',
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
              className="absolute right-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-0.5 rounded-md"
            >
              <X className="size-3.5 shrink-0" />
            </button>
          )}
        </div>

        {/* Label Filter Popover Icon Button */}
        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                      'relative size-8 rounded-md bg-transparent border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors shadow-none shrink-0',
                      activeLabelIds.length > 0 && 'bg-muted border-border font-medium text-foreground'
                    )}
                    aria-label={
                      activeLabelIds.length > 0
                        ? `Filtered: ${activeLabelIds.length} label${activeLabelIds.length > 1 ? 's' : ''}`
                        : 'Filter by label'
                    }
                  >
                    <ListFilter className="size-4 shrink-0" strokeWidth={1.75} />
                    {activeLabelIds.length === 1 && selectedLabel ? (
                      <span
                        className="absolute bottom-1 right-1 size-1.5 rounded-full ring-1 ring-background shrink-0"
                        style={{ backgroundColor: selectedLabel.color || '#3b82f6' }}
                      />
                    ) : activeLabelIds.length > 1 ? (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-11 font-mono font-medium text-background">
                        {activeLabelIds.length}
                      </span>
                    ) : null}
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
          </TooltipProvider>

          <PopoverContent
            align="end"
            sideOffset={6}
            className="w-60 p-0 py-1.5 bg-popover border border-border rounded-md shadow-md z-50 text-foreground overflow-hidden"
          >
            {/* Search Input: Clean background, proper border and active styling */}
            {projectLabels.length > 0 && (
              <div className="px-2 pb-1.5">
                <div className="relative flex items-center">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground shrink-0 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search labels..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    className="h-8 w-full pl-8 pr-7 text-xs bg-background border border-border rounded-md outline-none focus:ring-1 focus:ring-ring focus:border-border text-foreground placeholder:text-muted-foreground transition-colors"
                    autoFocus
                  />
                  {filterSearch && (
                    <button
                      type="button"
                      onClick={() => setFilterSearch('')}
                      className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded-sm"
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
                const color = label.color || '#3b82f6';
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
                      'w-full flex items-center gap-2.5 px-2 py-1.5 text-xs rounded-md cursor-pointer transition-colors text-left select-none group',
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

              {projectLabels.length > 0 && filteredLabels.length === 0 && (
                <p className="text-12 text-muted-foreground py-2 text-center">
                  No labels found
                </p>
              )}

              {projectLabels.length === 0 && (
                <p className="text-12 text-muted-foreground py-3 text-center">
                  No labels assigned
                </p>
              )}
            </div>

            {activeLabelIds.length > 0 && (
              <div className="pt-1.5 px-2 border-t border-border mt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectLabelIds) onSelectLabelIds([]);
                    else if (onSelectLabelId) onSelectLabelId(null);
                  }}
                  className="w-full text-center py-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-md hover:bg-muted/60 font-medium"
                >
                  Clear filter
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Segmented View Switcher matching Storage and Work-Items */}
        <TooltipProvider delayDuration={150}>
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
                      onClick={() => setViewMode(opt.id)}
                      className={cn(
                        'relative size-7 flex items-center justify-center rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                        isSelected
                          ? 'text-foreground font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                      )}
                      aria-label={opt.label}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="pages-view-toggle"
                          className="absolute inset-0 bg-background rounded-md border border-border/50"
                          transition={{ duration: 0.15, ease: 'easeOut' }}
                        />
                      )}
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
        </TooltipProvider>

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
              className="h-8 rounded-md px-3 text-xs font-medium cursor-pointer shadow-none"
            >
              Add page
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="w-56 text-xs">
            <DropdownMenuItem className="text-xs cursor-pointer" onSelect={() => onCreateClick('blank')}>
              Blank page
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-11 font-normal text-muted-foreground">Import</DropdownMenuLabel>
            <DropdownMenuItem className="text-xs cursor-pointer" onSelect={() => zipInputRef.current?.click()}>
              ZIP archive
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs cursor-pointer" onSelect={() => onOpenImportDoc?.('docx')}>
              Word document
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs cursor-pointer" onSelect={() => onOpenImportDoc?.('md')}>
              Markdown document
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs cursor-pointer" onSelect={() => onOpenImportGithub?.()}>
              GitHub repo
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-11 font-normal text-muted-foreground">Templates</DropdownMenuLabel>
            <DropdownMenuItem className="text-xs cursor-pointer" onSelect={() => onCreateClick('example')}>
              Example project
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-xs cursor-pointer">More templates</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52">
                {OVERLEAF_TEMPLATE_CATEGORIES.map((item) => (
                  <DropdownMenuItem
                    key={item.category}
                    className="text-xs cursor-pointer"
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

export const TopBar = Topbar;
export default Topbar;
