'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  Columns3,
  AlignJustify,
  CalendarDays,
  ListFilter,
  KanbanSquare,
  Check,
  RotateCcw,
  ArrowRightLeft,
  ChevronDown,
  FolderKanban,
  type LucideIcon,
} from 'lucide-react';
import type { Column } from '../../types/task.types';
import { resolveTaskColumnColor, resolveTaskColumnId } from '../../types/task.types';
import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import { useTopbar, type AssigneeFilterOption, type ViewMode } from '../../hooks/use-topbar';

export type { AssigneeFilterOption, ViewMode };

export interface TopbarProps {
  project?: {
    name: string;
    avatar?: string;
  };
  title?: string;
  icon?: LucideIcon;
  Icon?: LucideIcon;
  count?: number;
  // Cycle support
  cycleId?: string;
  currentCycle?: {
    _id: string;
    name: string;
  };
  cycles?: Array<{ _id: string; name: string }>;
  // View controls
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  // Filters
  columns: Column[];
  selectedColumnIds: string[];
  onColumnFilterChange: (colIds: string[]) => void;
  assignees: AssigneeFilterOption[];
  selectedAssigneeIds: string[];
  onAssigneeFilterChange: (userIds: string[]) => void;
  // Search
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  // Actions
  onAddTask: () => void;
  onAddExistingTask?: () => void;
  isLoading?: boolean;
  isReadOnly?: boolean;
  className?: string;
}

export function Topbar({
  project,
  title = 'Tasks',
  icon,
  Icon: PropIcon,
  count,
  cycleId,
  currentCycle,
  cycles = [],
  viewMode,
  onViewChange,
  columns,
  selectedColumnIds,
  onColumnFilterChange,
  assignees,
  selectedAssigneeIds,
  onAssigneeFilterChange,
  searchQuery = '',
  onSearchChange,
  onAddTask,
  onAddExistingTask,
  isLoading = false,
  isReadOnly = false,
  className,
}: TopbarProps) {
  const HeaderIcon = icon || PropIcon || KanbanSquare;

  const { state, actions, inputRef } = useTopbar({
    columns,
    selectedColumnIds,
    onColumnFilterChange,
    assignees,
    selectedAssigneeIds,
    onAssigneeFilterChange,
    cycleId,
    cycles: cycles as any,
    searchQuery,
    onSearchChange,
  });

  const {
    isSearchExpanded,
    filterOpen,
    totalActiveFilters,
    hasActiveFilters,
    filteredProjects,
    filteredCycles,
    projectSearch,
    cycleSearch,
  } = state;

  const {
    expandSearch,
    collapseSearch,
    handleSearchChange,
    handleClearSearch,
    toggleColumnFilter,
    toggleAssigneeFilter,
    clearAllFilters,
    setFilterOpen,
    setProjectSearch,
    setCycleSearch,
    handleProjectClick,
    handleCycleSelect,
  } = actions;

  const viewOptions: Array<{ id: ViewMode; label: string; icon: LucideIcon }> = [
    { id: 'board', label: 'Board view', icon: Columns3 },
    { id: 'list', label: 'List view', icon: AlignJustify },
    { id: 'calendar', label: 'Calendar view', icon: CalendarDays },
  ];

  return (
    <header
      className={cn(
        'flex items-center justify-between border-b border-border/50 bg-background/80 px-6 h-14 backdrop-blur-md sticky top-0 z-10 shrink-0',
        className,
      )}
    >
      {/* Left: Title & Project/Cycle Context */}
      <div className="flex items-center gap-2.5 min-w-0">
        <HeaderIcon className="size-4.5 text-foreground shrink-0" />
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-[1.05rem] font-semibold tracking-tight text-foreground truncate">
            {currentCycle ? currentCycle.name : (project?.name || title)}
          </h1>
          {count !== undefined && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-muted text-muted-foreground">
              {count}
            </span>
          )}

          {/* Cycle / Project Selector if applicable */}
          {cycles.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-1.5 py-1 rounded-sm hover:bg-muted transition-colors cursor-pointer"
                >
                  <span>Switch Cycle</span>
                  <ChevronDown className="size-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <div className="p-2">
                  <Input
                    placeholder="Search cycles..."
                    value={cycleSearch}
                    onChange={(e) => setCycleSearch(e.target.value)}
                    className="h-8 text-xs mb-1"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredCycles.map((c) => (
                    <DropdownMenuItem
                      key={c._id}
                      onClick={() => handleCycleSelect(c._id)}
                      className={cn(
                        'text-xs cursor-pointer',
                        c._id === cycleId && 'bg-primary/10 text-primary font-medium',
                      )}
                    >
                      {c.name}
                    </DropdownMenuItem>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Right: Search, View Switcher, Filter & Primary Actions */}
      <div className="flex items-center gap-3 shrink-0">
        {/* 1. Expandable Search Bar (Storage Standard) */}
        <div
          className={cn(
            'relative flex items-center transition-all duration-300 ease-in-out h-8 rounded-lg overflow-hidden group',
            isSearchExpanded || searchQuery
              ? 'w-64 border border-border/50 bg-background'
              : 'w-8 hover:bg-secondary/80 cursor-pointer',
          )}
          onClick={expandSearch}
        >
          <Search
            className={cn(
              'absolute top-1/2 -translate-y-1/2 size-3.5 transition-all duration-300 ease-in-out z-10 text-foreground',
              isSearchExpanded || searchQuery ? 'left-2.5 translate-x-0' : 'left-1/2 -translate-x-1/2',
            )}
          />
          <Input
            ref={inputRef}
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onBlur={() => collapseSearch(searchQuery)}
            className={cn(
              'h-full text-[13px] py-0 leading-none border-none bg-transparent focus-visible:ring-0 shadow-none w-full placeholder:text-muted-foreground/50 transition-opacity duration-200 pl-8 pr-8',
              isSearchExpanded || searchQuery ? 'opacity-100' : 'opacity-0 pointer-events-none',
            )}
            autoFocus={isSearchExpanded}
          />
          {(isSearchExpanded || searchQuery) && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClearSearch}
              className="absolute right-2.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label="Clear search"
            >
              <Plus className="size-3.5 rotate-45" />
            </button>
          )}
        </div>

        {/* 2. View Toggle Segmented Control (Storage Standard with Framer Motion) */}
        <TooltipProvider delayDuration={150}>
          <div className="flex items-center bg-muted p-1 rounded-lg">
            {viewOptions.map((v) => {
              const IconComp = v.icon;
              const isSelected = viewMode === v.id;
              return (
                <Tooltip key={v.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onViewChange(v.id)}
                      className={cn(
                        'relative p-1.5 rounded-md transition-colors cursor-pointer outline-none',
                        isSelected ? 'text-foreground font-semibold' : 'text-foreground/70 hover:text-foreground hover:bg-muted/50',
                      )}
                      aria-label={v.label}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="task-view-toggle"
                          className="absolute inset-0 bg-black/10 dark:bg-white/10 rounded-md shadow-xs"
                          transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                        />
                      )}
                      <span className="relative z-10 flex">
                        <IconComp className="size-4 text-foreground" strokeWidth={2.2} />
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6}>
                    {v.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          {/* 3. Filter Popover (Storage Standard) */}
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                      'relative size-8 rounded-lg bg-transparent border-border/60 cursor-pointer outline-none transition-colors',
                      hasActiveFilters && 'border-primary/50 bg-primary/5 text-primary',
                    )}
                    aria-label="Filter tasks"
                  >
                    <ListFilter className="size-4 text-foreground" strokeWidth={2.2} />
                    {hasActiveFilters && (
                      <span className="absolute -top-1 -right-1 size-4 flex items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {totalActiveFilters}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                Filter
              </TooltipContent>
            </Tooltip>

            <PopoverContent align="end" className="w-72 p-3 space-y-4 rounded-lg shadow-xl">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Filters {hasActiveFilters && `(${totalActiveFilters})`}
                </span>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="size-3" />
                    Clear all
                  </button>
                )}
              </div>

              {/* Columns Section */}
              {columns.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Columns
                  </span>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {columns.map((col) => {
                      const colId = resolveTaskColumnId(col);
                      const isSelected = selectedColumnIds.includes(colId);
                      const color = resolveTaskColumnColor(colId, col.accentColor);
                      return (
                        <button
                          key={colId}
                          type="button"
                          onClick={() => toggleColumnFilter(colId)}
                          className={cn(
                            'w-full flex items-center justify-between px-2 py-1.5 rounded-sm text-xs transition-colors text-left cursor-pointer',
                            isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground',
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="size-2 rounded-full shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="truncate">{col.title}</span>
                          </div>
                          {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Assignees Section */}
              {assignees.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Assignees
                  </span>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {assignees.map((user) => {
                      const isSelected = selectedAssigneeIds.includes(user.id);
                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => toggleAssigneeFilter(user.id)}
                          className={cn(
                            'w-full flex items-center justify-between px-2 py-1.5 rounded-sm text-xs transition-colors text-left cursor-pointer',
                            isSelected ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground',
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {user.avatar ? (
                              <Avatar className="size-4.5 shrink-0">
                                <AvatarImage src={user.avatar} />
                                <AvatarFallback className="text-[9px]">
                                  {user.name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              <div className="size-4.5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold shrink-0">
                                {user.name.slice(0, 1)}
                              </div>
                            )}
                            <span className="truncate">{user.name}</span>
                          </div>
                          {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </TooltipProvider>

        {/* 4. Primary Actions (+ Add Task & + Add Existing) */}
        {!isReadOnly && (
          <div className="flex items-center gap-1.5">
            {cycleId && onAddExistingTask && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAddExistingTask}
                className="h-8 gap-1.5 px-3 text-[13px] font-medium border-border/80 hover:bg-muted rounded-lg shadow-2xs cursor-pointer"
              >
                <ArrowRightLeft className="size-3.5" />
                <span className="hidden sm:inline">Add Existing</span>
              </Button>
            )}

            <Button
              size="sm"
              onClick={onAddTask}
              className="h-8 gap-1.5 px-3 text-[13px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-xs cursor-pointer transition-all active:scale-[0.98]"
            >
              <Plus className="size-3.5" strokeWidth={2.5} />
              <span>Add Task</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Topbar;
