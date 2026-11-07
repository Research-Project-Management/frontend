'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  PanelLeft,
  Files,
  Archive,
  Plus,
  Tag,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';

export type PagesFilterTab = 'all' | 'archived' | 'uncategorized';

export interface PagesSidebarLabel {
  id: string;
  name: string;
  color?: string;
}

export interface PagesSidebarProps {
  /** 'personal' (userId space) vs 'project' (projectId space) */
  spaceType?: 'personal' | 'project';
  activeFilter: PagesFilterTab;
  onSelectFilter: (filter: PagesFilterTab) => void;
  labels?: PagesSidebarLabel[];
  selectedLabelIds?: string[];
  onToggleLabel?: (labelId: string) => void;
  onClearLabels?: () => void;
  onCreateLabel?: (input: { name: string; color: string }) => Promise<unknown>;
  isCreatingLabel?: boolean;
  onToggleCollapse?: () => void;
}

const LABEL_COLOR_PRESETS = [
  '#0969DA', // Primer Blue
  '#1A7F37', // Forest Green
  '#8250DF', // Purple
  '#CF222E', // Crimson
  '#B45309', // Amber
  '#0E7490', // Cyan
  '#D97706', // Orange
  '#EC4899', // Pink
];

export function PagesSidebar({
  spaceType = 'project',
  activeFilter,
  onSelectFilter,
  labels = [],
  selectedLabelIds = [],
  onToggleLabel,
  onClearLabels,
  onCreateLabel,
  isCreatingLabel = false,
  onToggleCollapse,
}: PagesSidebarProps) {
  const [tagsExpanded, setTagsExpanded] = useState(true);
  const [isNewTagOpen, setIsNewTagOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(LABEL_COLOR_PRESETS[0]);

  const isPersonalSpace = spaceType === 'personal';
  const allPagesLabel = isPersonalSpace ? 'My pages' : 'All pages';

  const handleCreateNewTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTagName.trim();
    if (!trimmed || !onCreateLabel || isCreatingLabel) return;
    try {
      await onCreateLabel({ name: trimmed, color: newTagColor });
      setNewTagName('');
      setIsNewTagOpen(false);
    } catch {
      // Error toast is handled by mutation hook
    }
  };

  return (
    <aside className="flex flex-col h-full w-full shrink-0 overflow-hidden bg-transparent select-none">
      {/* 1. Topbar Header matching Library & Projects (h-11) */}
      <div className="h-11 px-2.5 flex items-center shrink-0">
        <div className="flex items-center justify-between h-8 px-1 font-semibold text-sm tracking-tight text-foreground select-none w-full">
          <span className="shrink-0 font-semibold text-15 tracking-tight text-foreground truncate">
            Pages
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => {
                  if (onToggleCollapse) {
                    onToggleCollapse();
                  } else {
                    window.dispatchEvent(new CustomEvent('toggle-pages-sidebar'));
                  }
                }}
                aria-label="Collapse sidebar"
                className="rounded-md p-1.5 text-foreground hover:bg-muted cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary shrink-0"
              >
                <PanelLeft className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="start" sideOffset={6} alignOffset={2}>
              Collapse sidebar
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* 2. Scrollable Navigation Content */}
      <div className="flex-1 min-h-0 overflow-y-auto sidebar-scrollbar flex flex-col gap-3 p-2.5 pt-2.5 pb-2">
        {/* ── SECTION 1: Space Views (All pages / My pages & Archived) ── */}
        <div className="shrink-0">
          <nav className="flex flex-col gap-0.5" aria-label="Pages navigation">
            <button
              type="button"
              onClick={() => {
                onSelectFilter('all');
                if (selectedLabelIds.length > 0) onClearLabels?.();
              }}
              className={cn(
                'group relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 transition-colors outline-none select-none cursor-pointer text-left',
                activeFilter === 'all' && selectedLabelIds.length === 0
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-foreground hover:bg-muted font-normal'
              )}
            >
              <Files className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
              <span className="min-w-0 truncate flex-1 tracking-tight">{allPagesLabel}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectFilter('archived');
                if (selectedLabelIds.length > 0) onClearLabels?.();
              }}
              className={cn(
                'group relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 transition-colors outline-none select-none cursor-pointer text-left',
                activeFilter === 'archived' && selectedLabelIds.length === 0
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-foreground hover:bg-muted font-normal'
              )}
            >
              <Archive className="size-4 shrink-0 text-foreground" strokeWidth={1.5} />
              <span className="min-w-0 truncate flex-1 tracking-tight">Archived</span>
            </button>
          </nav>
        </div>

        {/* ── SECTION 2: Labels Organization (Scoped to current userId / projectId space) ── */}
        <Collapsible
          open={tagsExpanded}
          onOpenChange={setTagsExpanded}
          className="select-none shrink-0"
        >
          <div className="group/labels-header flex items-center justify-between h-7 px-2.5 text-11 font-medium text-muted-foreground select-none">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex-1 text-left text-11 font-medium text-muted-foreground hover:text-foreground cursor-pointer outline-none"
              >
                Labels
              </button>
            </CollapsibleTrigger>

            <div className="flex items-center gap-0.5">
              {selectedLabelIds.length > 0 && onClearLabels && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClearLabels();
                      }}
                      aria-label="Clear label filter"
                      className="size-5 flex items-center justify-center rounded-sm cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted outline-none"
                    >
                      <X className="size-3 shrink-0" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6}>
                    Clear label filter
                  </TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      aria-label={tagsExpanded ? 'Collapse labels' : 'Expand labels'}
                      className="size-5 flex items-center justify-center rounded-sm cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted outline-none"
                    >
                      <ChevronDown
                        className={cn(
                          'size-3 text-inherit transition-transform duration-150',
                          !tagsExpanded && '-rotate-90'
                        )}
                      />
                    </button>
                  </CollapsibleTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6}>
                  {tagsExpanded ? 'Collapse' : 'Expand'}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <CollapsibleContent className="overflow-hidden mt-0.5">
            <div className="flex flex-col gap-0.5">
              {/* "+ New label" inline popover button */}
              {onCreateLabel && (
                <Popover open={isNewTagOpen} onOpenChange={setIsNewTagOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        'group flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 text-muted-foreground hover:text-foreground hover:bg-muted font-normal outline-none cursor-pointer transition-colors text-left',
                        isNewTagOpen && 'bg-muted text-foreground'
                      )}
                    >
                      <Plus className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" strokeWidth={1.5} />
                      <span className="truncate tracking-tight">New label</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="right"
                    align="start"
                    sideOffset={8}
                    className="w-60 p-3 rounded-md border border-border bg-popover text-popover-foreground shadow-overlay select-none"
                  >
                    <form onSubmit={handleCreateNewTag} className="flex flex-col gap-2.5">
                      <span className="text-12 font-semibold text-foreground">
                        Create new label
                      </span>
                      <input
                        type="text"
                        placeholder="Label name..."
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        autoFocus
                        className="h-8 w-full px-2.5 text-13 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                      />
                      <div className="flex items-center gap-1.5 py-0.5">
                        {LABEL_COLOR_PRESETS.map((color) => {
                          const isSelected = newTagColor === color;
                          return (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setNewTagColor(color)}
                              aria-label={`Select color ${color}`}
                              className={cn(
                                'size-5 rounded-full flex items-center justify-center cursor-pointer transition-transform',
                                isSelected && 'scale-110 ring-2 ring-ring ring-offset-1 ring-offset-popover'
                              )}
                              style={{ backgroundColor: color }}
                            >
                              {isSelected && <Check className="size-3 text-white stroke-[2.5]" />}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsNewTagOpen(false)}
                          className="h-7 px-2.5 rounded-md text-12 font-medium text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={!newTagName.trim() || isCreatingLabel}
                          className="h-7 px-3 rounded-md text-12 font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer transition-colors flex items-center gap-1"
                        >
                          {isCreatingLabel && <Loader2 className="size-3 animate-spin" />}
                          <span>Create</span>
                        </button>
                      </div>
                    </form>
                  </PopoverContent>
                </Popover>
              )}

              {/* Label Items */}
              {labels.map((label) => {
                const isSelected = selectedLabelIds.includes(label.id);
                const dotColor = label.color || '#0969DA';
                return (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => {
                      if (activeFilter === 'uncategorized') {
                        onSelectFilter('all');
                      }
                      onToggleLabel?.(label.id);
                    }}
                    className={cn(
                      'group flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 outline-none cursor-pointer transition-colors text-left',
                      isSelected
                        ? 'bg-muted text-foreground font-medium'
                        : 'text-foreground hover:bg-muted font-normal'
                    )}
                  >
                    <Tag
                      className="size-3.5 shrink-0"
                      style={{ color: dotColor, fill: `${dotColor}25` }}
                      strokeWidth={1.75}
                    />
                    <span className="min-w-0 truncate tracking-tight">{label.name}</span>
                  </button>
                );
              })}

              {/* "Uncategorized" filter (pages with 0 labels) */}
              <button
                type="button"
                onClick={() => {
                  if (selectedLabelIds.length > 0) onClearLabels?.();
                  onSelectFilter(activeFilter === 'uncategorized' ? 'all' : 'uncategorized');
                }}
                className={cn(
                  'group flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-13 leading-5 outline-none cursor-pointer transition-colors text-left italic',
                  activeFilter === 'uncategorized'
                    ? 'bg-muted text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted font-normal'
                )}
              >
                <span className="min-w-0 truncate tracking-tight pl-6">Uncategorized</span>
              </button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </aside>
  );
}

export default PagesSidebar;
