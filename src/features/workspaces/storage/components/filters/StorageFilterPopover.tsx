'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
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
  Files,
  Briefcase,
  ArrowUpDown,
  ChevronDown,
  Search,
} from 'lucide-react';
import {
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Checkbox,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import {
  useStorageFilterStore,
  type StorageTypeFilter,
  type StorageSortBy,
} from '../../store/use-filter-store';
import { useProjects } from '@/features/workspaces/projects/shell/hooks/use-project';

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
  const [projectSearch, setProjectSearch] = useState('');
  const [isTypesOpen, setIsTypesOpen] = useState(true);
  const [isProjectsOpen, setIsProjectsOpen] = useState(true);
  const [isSortOpen, setIsSortOpen] = useState(false);

  const params = useParams() as { workspaceId?: string; projectId?: string };
  const workspaceId = params.workspaceId;
  const { projects = [] } = useProjects(workspaceId);

  const {
    selectedTypes,
    selectedProjects,
    sortBy,
    toggleType,
    toggleProject,
    setSortBy,
    resetFilters,
    isFilterActive,
    getActiveFilterCount,
  } = useStorageFilterStore();

  const isActive = isFilterActive();
  const activeCount = getActiveFilterCount();
  const showProjectFilter = !params.projectId;

  const filteredProjects = projects.filter((p) =>
    (p?.name || '').toLowerCase().includes(projectSearch.trim().toLowerCase())
  );

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
                  'relative size-8 rounded-lg bg-transparent border-border/60 hover:bg-muted/80 cursor-pointer outline-none transition-colors',
                  isActive &&
                    'bg-accent/80 border-primary/50 text-primary hover:bg-accent hover:text-primary'
                )}
                aria-label="Filter & sort"
              >
                <ListFilter className="size-4" strokeWidth={2} />
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
        className="w-80 p-3.5 rounded-xl shadow-xl border border-border/70 bg-popover text-popover-foreground z-50 select-none animate-in fade-in-0 zoom-in-95"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-border/50">
          <div className="flex items-center gap-1.5">
            <ListFilter className="size-3.5 text-primary shrink-0" />
            <span className="text-xs font-semibold text-foreground">Filter & Sort</span>
            {activeCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-primary/15 text-primary">
                {activeCount}
              </span>
            )}
          </div>
          {isActive && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none"
            >
              <RotateCcw className="size-3" />
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
              className="flex items-center justify-between w-full py-1 text-xs font-semibold text-foreground/90 hover:text-foreground cursor-pointer outline-none"
            >
              <div className="flex items-center gap-1.5">
                <span>File type</span>
                {selectedTypes.length > 0 && (
                  <span className="text-[10px] text-primary font-medium">
                    ({selectedTypes.length})
                  </span>
                )}
              </div>
              <ChevronDown
                className={cn(
                  'size-3.5 text-muted-foreground transition-transform duration-200',
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
                        'flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors',
                        isChecked
                          ? 'bg-accent/70 text-foreground font-medium'
                          : 'hover:bg-muted/60 text-foreground/80'
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

          {/* 2. Project Section (only in workspace level) */}
          {showProjectFilter && (
            <div className="border-t border-border/50 pt-2.5">
              <button
                type="button"
                onClick={() => setIsProjectsOpen(!isProjectsOpen)}
                className="flex items-center justify-between w-full py-1 text-xs font-semibold text-foreground/90 hover:text-foreground cursor-pointer outline-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>Project</span>
                  {selectedProjects.length > 0 && (
                    <span className="text-[10px] text-primary font-medium">
                      ({selectedProjects.length})
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={cn(
                    'size-3.5 text-muted-foreground transition-transform duration-200',
                    isProjectsOpen ? '' : '-rotate-90'
                  )}
                />
              </button>

              {isProjectsOpen && (
                <div className="mt-1.5 space-y-1.5">
                  {projects.length > 5 && (
                    <div className="relative flex items-center mb-1">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                      <input
                        value={projectSearch}
                        onChange={(e) => setProjectSearch(e.target.value)}
                        placeholder="Search projects..."
                        className="h-7 w-full pl-7 pr-2 text-[11px] bg-muted/40 hover:bg-muted/60 focus:bg-background border border-border/60 rounded-md outline-none focus:ring-1 focus:ring-ring transition-colors placeholder:text-muted-foreground/60 text-foreground"
                      />
                    </div>
                  )}

                  {/* Workspace only */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleProject('workspace-only')}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        toggleProject('workspace-only');
                      }
                    }}
                    className={cn(
                      'flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors',
                      selectedProjects.includes('workspace-only')
                        ? 'bg-accent/70 text-foreground font-medium'
                        : 'hover:bg-muted/60 text-foreground/80'
                    )}
                  >
                    <Checkbox
                      checked={selectedProjects.includes('workspace-only')}
                      tabIndex={-1}
                      className="pointer-events-none"
                    />
                    <Files className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">Workspace only (no project)</span>
                  </div>

                  {/* Projects List */}
                  <div className="max-h-36 overflow-y-auto space-y-0.5">
                    {filteredProjects.map((proj) => {
                      const isChecked = selectedProjects.includes(proj.id);
                      return (
                        <div
                          key={proj.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleProject(proj.id)}
                          onKeyDown={(e) => {
                            if (e.key === ' ' || e.key === 'Enter') {
                              e.preventDefault();
                              toggleProject(proj.id);
                            }
                          }}
                          className={cn(
                            'flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors',
                            isChecked
                              ? 'bg-accent/70 text-foreground font-medium'
                              : 'hover:bg-muted/60 text-foreground/80'
                          )}
                        >
                          <Checkbox
                            checked={isChecked}
                            tabIndex={-1}
                            className="pointer-events-none"
                          />
                          <span className="size-2 rounded-full bg-primary/70 shrink-0" />
                          <span className="flex-1 truncate">{proj.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Sort By Section */}
          <div className="border-t border-border/50 pt-2.5">
            <button
              type="button"
              onClick={() => setIsSortOpen(!isSortOpen)}
              className="flex items-center justify-between w-full py-1 text-xs font-semibold text-foreground/90 hover:text-foreground cursor-pointer outline-none"
            >
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="size-3 text-muted-foreground" />
                <span>Sort by</span>
              </div>
              <ChevronDown
                className={cn(
                  'size-3.5 text-muted-foreground transition-transform duration-200',
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
                        'flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-xs text-left cursor-pointer transition-colors',
                        isSelected
                          ? 'bg-accent/70 text-foreground font-medium'
                          : 'hover:bg-muted/60 text-foreground/80'
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
