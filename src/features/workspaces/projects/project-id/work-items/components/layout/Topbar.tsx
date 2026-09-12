'use client';

import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  ChevronDown,
  SlidersHorizontal,
  Star,
  Plus,
  Archive,
} from 'lucide-react';
import { WorkItemsIcon } from "@/shared/components/ui";

const ListIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <line x1="3.5" x2="16.5" y1="5.5" y2="5.5" />
    <line x1="3.5" x2="16.5" y1="10" y2="10" />
    <line x1="3.5" x2="16.5" y1="14.5" y2="14.5" />
  </svg>
);

const BoardIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="14" height="14" rx="2.5" />
    <line x1="7.6" y1="3" x2="7.6" y2="17" />
    <line x1="12.4" y1="3" x2="12.4" y2="17" />
  </svg>
);

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4.5" width="14" height="12.5" rx="2.5" />
    <line x1="3" y1="8.5" x2="17" y2="8.5" />
    <line x1="6.5" y1="2.5" x2="6.5" y2="4.5" />
    <line x1="13.5" y1="2.5" x2="13.5" y2="4.5" />
  </svg>
);

const TableIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="14" height="14" rx="2.5" />
    <line x1="3" y1="8" x2="17" y2="8" />
    <line x1="9" y1="8" x2="9" y2="17" />
  </svg>
);

const TimelineIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="7.5" height="4" rx="2" />
    <rect x="9.5" y="11" width="7.5" height="4" rx="2" />
  </svg>
);
import type {
  Task,
  Column,
  Cycle,
  TaskPriority,
  DisplayOptions,
  DueDateFilterOption,
  DisplayPropertyKey,
  Filters,
  ProjectMember,
} from '../../types/types';
import { Button } from "@/shared/components/ui";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/shared/components/ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui";
import { Separator } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import type { AssigneeFilterOption, ViewMode } from '../../hooks/use-topbar';
import type { SavedViewRecord } from '../../services/service';
import { DisplayPopover } from './DisplayPopover';
import { FilterDropdown } from '../filters/FilterDropdown';
import { ProjectTopbarSwitcher } from '@/features/workspaces/projects/project-id/components/layout';

export type { AssigneeFilterOption, ViewMode };

export interface TopbarProps {
  project?: {
    name: string;
    avatar?: string | null;
    modules?: string[];
  };
  projectModules?: string[];
  savedViews?: SavedViewRecord[];
  activeViewId?: string;
  onSelectSavedView?: (view: SavedViewRecord) => void;
  onSaveCurrentView?: () => void;
  title?: string;
  icon?: React.ComponentType<{ className?: string }>;
  Icon?: React.ComponentType<{ className?: string }>;
  count?: number;
  // Cycle support
  cycleId?: string;
  currentCycle?: {
    id: string;
    name: string;
  };
  tasks?: Task[];
  cycles?: Cycle[];
  onCycleSelect?: (cycleId: string) => void;
  // View controls
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  // Filters
  columns: Column[];
  selectedColumnIds: string[];
  onColumnFilterChange: (colIds: string[]) => void;
  onToggleColumn?: (colId: string) => void;
  assignees: AssigneeFilterOption[];
  members?: ProjectMember[];
  selectedAssigneeIds: string[];
  onAssigneeFilterChange: (userIds: string[]) => void;
  onToggleAssignee?: (userId: string) => void;
  selectedPriorities?: TaskPriority[];
  onTogglePriority?: (priority: TaskPriority) => void;
  dueDateFilter?: DueDateFilterOption;
  onDueDateFilterChange?: (opt: DueDateFilterOption) => void;
  onClearAllFilters?: () => void;
  totalActiveFilters?: number;
  filters?: Filters;
  onToggleFilter?: <K extends keyof Filters>(key: K, item: any) => void;
  onRemoveFilter?: <K extends keyof Filters>(key: K, item?: any) => void;
  // Display options
  displayOptions?: DisplayOptions;
  onDisplayOptionsChange?: (options: DisplayOptions) => void;
  onPropertyToggle?: (key: DisplayPropertyKey, value: boolean) => void;
  displayOpen?: boolean;
  onDisplayOpenChange?: (open: boolean) => void;
  // Analytics drawer
  onOpenAnalytics?: () => void;
  // Actions
  onAddTask: () => void;
  onAddExistingTask?: () => void;
  showArchived?: boolean;
  onToggleArchived?: () => void;
  isLoading?: boolean;
  isReadOnly?: boolean;
  className?: string;
}

export function Topbar({
  project,
  projectModules: propProjectModules,
  savedViews,
  activeViewId,
  onSelectSavedView,
  onSaveCurrentView,
  showArchived = false,
  onToggleArchived,
  title = 'Work items',
  icon,
  Icon: PropIcon,
  count,
  cycleId,
  currentCycle,
  cycles = [],
  tasks = [],
  onCycleSelect,
  viewMode,
  onViewChange,
  columns,
  selectedColumnIds,
  onColumnFilterChange,
  onToggleColumn,
  assignees,
  members,
  selectedAssigneeIds,
  onAssigneeFilterChange,
  onToggleAssignee,
  selectedPriorities = [],
  onTogglePriority,
  dueDateFilter = 'all',
  onDueDateFilterChange,
  onClearAllFilters,
  totalActiveFilters: propTotalActiveFilters,
  filters: propFilters,
  onToggleFilter: propOnToggleFilter,
  onRemoveFilter: propOnRemoveFilter,
  displayOptions,
  onDisplayOptionsChange,
  onPropertyToggle,
  displayOpen = false,
  onDisplayOpenChange,
  onOpenAnalytics,
  onAddTask,
  onAddExistingTask,
  isLoading = false,
  isReadOnly = false,
  className,
}: TopbarProps) {
  const HeaderIcon = icon || PropIcon || WorkItemsIcon;

  const isCyclesEnabled = true;
  const isViewsEnabled = true;
  const activeSavedView = savedViews?.find((v) => v.id === activeViewId);

  const handleToggleCol = useCallback((colId: string) => {
    if (onToggleColumn) {
      onToggleColumn(colId);
    } else if (propOnToggleFilter) {
      propOnToggleFilter('state', colId);
    } else {
      onColumnFilterChange(
        selectedColumnIds.includes(colId)
          ? selectedColumnIds.filter((id) => id !== colId)
          : [...selectedColumnIds, colId]
      );
    }
  }, [onToggleColumn, propOnToggleFilter, onColumnFilterChange, selectedColumnIds]);

  const handleToggleAssignee = useCallback((userId: string) => {
    if (onToggleAssignee) {
      onToggleAssignee(userId);
    } else if (propOnToggleFilter) {
      propOnToggleFilter('assignees', userId);
    } else {
      onAssigneeFilterChange(
        selectedAssigneeIds.includes(userId)
          ? selectedAssigneeIds.filter((id) => id !== userId)
          : [...selectedAssigneeIds, userId]
      );
    }
  }, [onToggleAssignee, propOnToggleFilter, onAssigneeFilterChange, selectedAssigneeIds]);

  const totalActiveFilters =
    propTotalActiveFilters !== undefined
      ? propTotalActiveFilters
      : selectedColumnIds.length +
        selectedAssigneeIds.length +
        selectedPriorities.length +
        (dueDateFilter !== 'all' ? 1 : 0);

  const handleClearAll = () => {
    if (onClearAllFilters) {
      onClearAllFilters();
    }
  };

  const viewOptions = [
    { id: 'list' as ViewMode, label: 'List', icon: ListIcon },
    { id: 'board' as ViewMode, label: 'Board', icon: BoardIcon },
    { id: 'calendar' as ViewMode, label: 'Calendar', icon: CalendarIcon },
    { id: 'table' as ViewMode, label: 'Table', icon: TableIcon },
    { id: 'timeline' as ViewMode, label: 'Timeline', icon: TimelineIcon },
  ];

  return (
    <header
      className={cn(
        'h-11 border-b border-border px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-3 bg-background shrink-0 text-13 w-full min-w-0 overflow-x-auto scrollbar-none',
        className,
      )}
    >
      {/* Left: Project Switcher, Module Title & Scope Switcher */}
      <ProjectTopbarSwitcher
        project={project}
        moduleTitle={title}
        moduleIcon={HeaderIcon}
        count={count}
      >

        {/* Cycle Context Selector (if in cycle mode and cycles module enabled) */}
        {isCyclesEnabled && cycleId && currentCycle && cycles.length > 0 && (
          <>
            <Separator orientation="vertical" className="h-4 bg-border mx-0.5 shrink-0" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary shrink-0"
                >
                  <span className="truncate max-w-[100px] sm:max-w-[120px]">{currentCycle.name}</span>
                  <ChevronDown className="size-3 text-muted-foreground shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 p-1 rounded-md border-border text-xs">
                {cycles.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={() => onCycleSelect?.(c.id)}
                    className={cn(
                      'flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer text-xs',
                      c.id === cycleId && 'bg-muted text-primary font-medium',
                    )}
                  >
                    <span className="truncate">{c.name}</span>
                    {c.id === cycleId && <Check className="size-3 text-primary shrink-0" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}

        {/* Saved Views Dropdown (if views module enabled) */}
        {isViewsEnabled && (savedViews || onSaveCurrentView || onToggleArchived) && (
          <>
            <Separator orientation="vertical" className="h-4 bg-border mx-0.5 shrink-0" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary shrink-0",
                    showArchived ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold" : "text-foreground"
                  )}
                >
                  {showArchived ? (
                    <Archive className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  ) : (
                    <SlidersHorizontal className="size-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span className="truncate max-w-[110px]">
                    {showArchived ? 'Archived' : activeSavedView ? activeSavedView.name : 'Views'}
                  </span>
                  <ChevronDown className="size-3 text-muted-foreground shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 p-1 rounded-md border-border text-xs">
                {savedViews && savedViews.length > 0 ? (
                  savedViews.map((sv) => (
                    <DropdownMenuItem
                      key={sv.id}
                      onClick={() => onSelectSavedView?.(sv)}
                      className={cn(
                        'flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer text-xs',
                        sv.id === activeViewId && !showArchived && 'bg-muted font-medium',
                      )}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {sv.isFavorite && <Star className="size-3 fill-amber-400 text-amber-400 shrink-0" />}
                        <span className="truncate">{sv.name}</span>
                      </div>
                      <span className="text-10 capitalize text-muted-foreground font-mono ml-2 shrink-0">
                        {sv.layout}
                      </span>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <div className="py-2 px-2 text-center text-xs text-muted-foreground italic">
                    No saved views
                  </div>
                )}
                {onSaveCurrentView && (
                  <>
                    <Separator className="my-1 bg-border" />
                    <DropdownMenuItem
                      onClick={onSaveCurrentView}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer text-xs text-primary font-medium"
                    >
                      <Plus className="size-3.5 shrink-0" />
                      <span>Save current view as...</span>
                    </DropdownMenuItem>
                  </>
                )}
                {onToggleArchived && (
                  <>
                    <Separator className="my-1 bg-border" />
                    <DropdownMenuItem
                      onClick={onToggleArchived}
                      className={cn(
                        'flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer text-xs',
                        showArchived && 'bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium',
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <Archive className="size-3.5 shrink-0" />
                        <span>{showArchived ? 'Back to active items' : 'View archived items'}</span>
                      </div>
                      {showArchived && (
                        <span className="text-10 font-mono px-1 rounded bg-amber-500/20">
                          Active
                        </span>
                      )}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </ProjectTopbarSwitcher>

      {/* Right: View Switcher, Filter, Display, Analytics & Primary CTA */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
        {/* 1. View Toggle Segmented Control */}
        <TooltipProvider delayDuration={150}>
          <div
            role="tablist"
            aria-label="View modes"
            className="flex items-center bg-muted p-0.5 rounded-md shrink-0 gap-0.5 h-8"
          >
            {viewOptions.map((v) => {
              const IconComp = v.icon;
              const isSelected = viewMode === v.id;
              return (
                <Tooltip key={v.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => onViewChange(v.id)}
                      className={cn(
                        'relative size-7 flex items-center justify-center rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary text-foreground',
                        !isSelected && 'hover:bg-background',
                      )}
                      aria-label={v.label}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="task-view-toggle"
                          className="absolute inset-0 bg-background rounded-md shadow-xs"
                          transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                        />
                      )}
                      <span className="relative z-10 flex items-center justify-center text-foreground">
                        <IconComp className="size-4 text-foreground shrink-0" />
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

          {/* 2. Filter Dropdown Menu (Exact matching official UI) */}
          <FilterDropdown
            tasks={tasks}
            columns={columns}
            selectedColumnIds={selectedColumnIds}
            onToggleColumn={handleToggleCol}
            assignees={assignees}
            members={members}
            selectedAssigneeIds={selectedAssigneeIds}
            onToggleAssignee={handleToggleAssignee}
            selectedPriorities={selectedPriorities}
            onTogglePriority={onTogglePriority || ((p) => propOnToggleFilter?.('priority', p))}
            dueDateFilter={dueDateFilter}
            onDueDateFilterChange={onDueDateFilterChange || (() => {})}
            cycles={cycles}
            selectedCycleId={cycleId}
            onCycleSelect={onCycleSelect}
            totalActiveFilters={
              propFilters
                ? (propFilters.state.length +
                  propFilters.state_group.length +
                  propFilters.priority.length +
                  propFilters.assignees.length +
                  propFilters.mentions.length +
                  propFilters.created_by.length +
                  propFilters.labels.length +
                  propFilters.cycle.length +
                  propFilters.attach.length +
                  ((propFilters.tasks?.length ?? 0) + (propFilters.work_items?.length ?? 0)) +
                  propFilters.parent.length +
                  propFilters.due_date.length +
                  propFilters.start_date.length +
                  propFilters.created_at.length +
                  propFilters.updated_at.length)
                : totalActiveFilters
            }
            onClearAll={handleClearAll}
            filters={propFilters}
            onToggleFilter={propOnToggleFilter}
            onRemoveFilter={propOnRemoveFilter}
          />

          {/* 3. Display Popover Button */}
          {displayOptions && onDisplayOptionsChange && onPropertyToggle && (
            <DisplayPopover
              displayOptions={displayOptions}
              onDisplayOptionsChange={onDisplayOptionsChange}
              onPropertyToggle={onPropertyToggle}
              open={displayOpen}
              onOpenChange={onDisplayOpenChange || (() => {})}
            />
          )}

          {/* 4. Analytics Button */}
          <Button
            type="button"
            size="sm"
            onClick={onOpenAnalytics}
            className="h-8 px-3 text-13 font-medium bg-background text-foreground hover:bg-muted rounded-md border border-border cursor-pointer transition-colors shrink-0"
            aria-label="Analytics"
          >
            <span>Analytics</span>
          </Button>
        </TooltipProvider>

        {/* 5. Primary Actions (+ Add Task & + Add Existing) */}
        {!isReadOnly && (
          <div className="flex items-center gap-1.5 shrink-0">
            {cycleId && onAddExistingTask && (
              <Button
                type="button"
                size="sm"
                onClick={onAddExistingTask}
                className="h-8 px-3 text-13 font-medium bg-background text-foreground hover:bg-muted rounded-md border border-border cursor-pointer transition-colors shrink-0"
              >
                <span>Add existing</span>
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={onAddTask}
              className="h-8 px-3 text-13 font-medium bg-primary text-primary-foreground hover:bg-primary-hover rounded-md cursor-pointer transition-colors shadow-none shrink-0"
            >
              <span>Add work item</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Topbar;
