'use client';

import React, { useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ChevronRight,
} from 'lucide-react';
import {
  WorkItemsIcon,
  ListIcon,
  BoardIcon,
  CalendarIcon,
  TableIcon,
  TimelineIcon,
} from "@/shared/components/icons";
import type {
  Item,
  Column,
  Cycle,
  Priority,
  DisplayOptions,
  DueDateFilterOption,
  DisplayPropertyKey,
  Filters,
  ProjectMember,
} from '../../types/work-item.types';
import { Button } from "@/shared/components/ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import type { AssigneeFilterOption, ViewMode } from '../../hooks/use-topbar';
import type { SavedViewRecord } from '../../services/view.service';
import { DisplayPopover } from './DisplayPopover';
import { FilterDropdown } from '../filters/FilterDropdown';
import { Switcher } from '@/features/projects/project-id/components/layout/Switcher';

export type { AssigneeFilterOption, ViewMode };

export interface TopbarProps {
  projectId?: string;
  project?: {
    id?: string;
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
  items?: Item[];
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
  selectedPriorities?: Priority[];
  onTogglePriority?: (priority: Priority) => void;
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
  onAddItem?: () => void;
  onAddExistingItem?: () => void;
  showArchived?: boolean;
  onToggleArchived?: () => void;
  isLoading?: boolean;
  isReadOnly?: boolean;
  className?: string;
}

export function Topbar({
  projectId,
  project,
  projectModules: propProjectModules,
  savedViews,
  activeViewId,
  onSelectSavedView,
  onSaveCurrentView,
  showArchived = false,
  onToggleArchived,
  title = 'Work Items',
  icon,
  Icon: PropIcon,
  count,
  cycleId,
  currentCycle,
  cycles = [],
  items = [],

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
  onAddItem,
  onAddExistingItem,
  isLoading = false,
  isReadOnly = false,
  className,
}: TopbarProps) {

  const HeaderIcon = icon || PropIcon || WorkItemsIcon;

  const handleAdd = onAddItem || (() => {});
  const handleAddExisting = onAddExistingItem;
  const effectiveModules = propProjectModules || project?.modules || ['work-items', 'cycles', 'views', 'pages'];
  const isCyclesEnabled = effectiveModules.includes('cycles');

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
        'h-11 border-b border-border px-3 sm:px-4 flex items-center justify-between gap-2.5 sm:gap-3 bg-background shrink-0 text-13 w-full min-w-0 overflow-x-auto scrollbar-none sticky top-0 z-20',
        className,
      )}
      style={{ paddingLeft: 'max(0.75rem, var(--header-offset, 0px))' }}
    >
      {/* Left: Project Switcher, Module Title & Scope Switcher */}
      <Switcher
        project={project}
        moduleTitle={title}
        moduleIcon={HeaderIcon}
        count={count}
      >
        {/* Cycle Context Selector (if in cycle mode and cycles module enabled) */}
        {isCyclesEnabled && cycleId && currentCycle && cycles.length > 0 && (
          <>
            <ChevronRight className="size-3.5 text-muted-foreground/40 shrink-0 mx-0.5" strokeWidth={1.75} />
            <span className="text-13 font-medium text-foreground truncate max-w-[100px] sm:max-w-[120px]">
              {currentCycle.name}
            </span>
          </>
        )}

        {showArchived && (
          <>
            <ChevronRight className="size-3.5 text-muted-foreground/40 shrink-0 mx-0.5" strokeWidth={1.75} />
            <span className="text-13 font-medium text-amber-600 dark:text-amber-400 shrink-0">
              Archived
            </span>
          </>
        )}
      </Switcher>

      {/* Right: View Switcher, Filter, Display, Analytics & Primary CTA */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
        {/* 1. View Toggle Segmented Control */}
        <TooltipProvider delayDuration={150}>
          <div
            role="tablist"
            aria-label="View modes"
            className="flex items-center bg-muted/70 p-0.5 rounded-md shrink-0 gap-0.5 h-8 border border-border/40 shadow-2xs"
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
                        'relative size-7 flex items-center justify-center rounded-md transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                        isSelected ? 'text-foreground' : 'text-foreground/70 hover:text-foreground hover:bg-background/40',
                      )}
                      aria-label={v.label}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId="work-items-view-toggle"
                          className="absolute inset-0 bg-background rounded-md shadow-2xs border border-border/50"
                          transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                        />
                      )}
                      <span className="relative z-10 flex items-center justify-center">
                        <IconComp className="size-4 shrink-0" />
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
            items={items}
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
                  propFilters.work_items.length +
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
            className="h-8 px-3 text-13 font-medium bg-background text-foreground hover:bg-muted rounded-md border border-border cursor-pointer transition-colors shadow-2xs shrink-0"
            aria-label="Analytics"
          >
            <span>Analytics</span>
          </Button>
        </TooltipProvider>

        {/* Primary Actions (+ Add Work Item & + Add Existing) */}
        {!isReadOnly && (
          <div className="flex items-center gap-1.5 shrink-0">
            {cycleId && handleAddExisting && (
              <Button
                type="button"
                size="sm"
                onClick={handleAddExisting}
                className="h-8 px-3 text-13 font-medium bg-background text-foreground hover:bg-muted rounded-md border border-border cursor-pointer transition-colors shadow-2xs shrink-0"
              >
                <span>Add existing</span>
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleAdd}
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
