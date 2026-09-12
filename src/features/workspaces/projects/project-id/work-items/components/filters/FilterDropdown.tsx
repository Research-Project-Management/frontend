'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Users,
  AtSign,
  Tag,
  Paperclip,
  CalendarClock,
  Calendar,
  UserCircle,
  User,
  Check,
  RotateCcw,
  CircleDashed,
  Circle,
  AlertCircle,
  CircleSlash,
  FileText,
  BookOpen,
  Link2,
  Layers,
} from 'lucide-react';
import { CycleIcon } from "@/shared/components/ui";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import type {
  Column,
  Task,
  TaskPriority,
  StateGroup,
  DueDateFilterOption,
  Cycle,
  Filters,
  ProjectMember,
} from '../../types/types';
import {
  resolveStateId,
  inferStateGroup,
} from '../../types/types';
import type { AssigneeFilterOption } from '../../hooks/use-topbar';

export function FilterFunnelIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('size-4 shrink-0 text-foreground', className)}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    >
      <line x1="3.5" x2="16.5" y1="5.5" y2="5.5" />
      <line x1="6" x2="14" y1="10" y2="10" />
      <line x1="8.5" x2="11.5" y1="14.5" y2="14.5" />
    </svg>
  );
}

export function TextLinesIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('size-4 shrink-0 text-foreground', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="21" y1="6" x2="3" y2="6" />
      <line x1="15" y1="12" x2="3" y2="12" />
      <line x1="17" y1="18" x2="3" y2="18" />
    </svg>
  );
}

/** 2 stacked sheets (Tasks) */
export function TasksIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('size-4 shrink-0 text-foreground', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}
export const WorkItemsIcon = TasksIcon;

/** Connected boxes (Parent) */
export function ParentBranchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('size-4 shrink-0 text-foreground', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="8" height="6" rx="1.5" />
      <rect x="13" y="14" width="8" height="6" rx="1.5" />
      <path d="M7 10v5a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

/** Concentric circles (State & State Group) */
export function ConcentricCirclesIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('size-4 shrink-0 text-foreground', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.2" />
    </svg>
  );
}

/** 3 Ascending bars (Priority) */
export function PrioritySignalBarsIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('size-4 shrink-0 text-foreground', className)} viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="14" width="3.2" height="6" rx="1" />
      <rect x="10.4" y="9" width="3.2" height="11" rx="1" />
      <rect x="16.8" y="4" width="3.2" height="16" rx="1" />
    </svg>
  );
}

/** Cycle Icon matching sidebar */
export const CycleContrastIcon = CycleIcon;

// ── Submenu State Icons ─────────────────────────────────────────────────────

export function StateBacklogIcon({ className }: { className?: string }) {
  return <CircleDashed className={cn('size-3.5 text-muted-foreground shrink-0 stroke-[2.2]', className)} />;
}

export function StateTodoIcon({ className }: { className?: string }) {
  return <Circle className={cn('size-3.5 text-muted-foreground shrink-0 stroke-[2]', className)} />;
}

export function StateInProgressIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('size-3.5 text-amber-500 shrink-0', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" fill="currentColor" />
    </svg>
  );
}

export function StateDoneIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('size-3.5 text-emerald-500 shrink-0', className)} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="10" />
      <path
        d="M8 12.5l2.5 2.5 5.5-5.5"
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StateCancelledIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('size-3.5 text-rose-500 shrink-0', className)} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="10" />
      <path
        d="M8.5 8.5l7 7M15.5 8.5l-7 7"
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StateGroupCancelledIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('size-3.5 text-muted-foreground shrink-0', className)} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="10" />
      <path
        d="M8.5 8.5l7 7M15.5 8.5l-7 7"
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Submenu Priority Icons ──────────────────────────────────────────────────

export function PriorityUrgentIcon({ className }: { className?: string }) {
  return <AlertCircle className={cn('size-3.5 text-rose-500 shrink-0 stroke-[2.2]', className)} />;
}

export function PriorityHighIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('size-3.5 text-orange-500 shrink-0', className)} viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="14" width="3.5" height="6" rx="1" />
      <rect x="10.25" y="9" width="3.5" height="11" rx="1" />
      <rect x="16.5" y="4" width="3.5" height="16" rx="1" />
    </svg>
  );
}

export function PriorityMediumIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('size-3.5 text-amber-500 shrink-0', className)} viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="14" width="3.5" height="6" rx="1" />
      <rect x="10.25" y="9" width="3.5" height="11" rx="1" />
      <rect x="16.5" y="4" width="3.5" height="16" rx="1" className="opacity-20" />
    </svg>
  );
}

export function PriorityLowIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('size-3.5 text-blue-500 shrink-0', className)} viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="14" width="3.5" height="6" rx="1" />
      <rect x="10.25" y="9" width="3.5" height="11" rx="1" className="opacity-20" />
      <rect x="16.5" y="4" width="3.5" height="16" rx="1" className="opacity-20" />
    </svg>
  );
}

export function PriorityNoneIcon({ className }: { className?: string }) {
  return <CircleSlash className={cn('size-3.5 text-muted-foreground shrink-0 stroke-[1.5]', className)} />;
}

// ── Submenu Search Input Component ──────────────────────────────────────────

function SubmenuSearchBar({
  value,
  onChange,
  placeholder = 'Search',
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="p-1 pb-1.5 border-b border-border mb-1" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background focus-within:ring-1 focus-within:ring-primary">
        <Search className="size-3 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="w-full bg-transparent text-12 text-foreground placeholder:text-muted-foreground outline-none"
        />
      </div>
    </div>
  );
}

// ── Filter Dropdown Props & Configuration ───────────────────────────────────

export interface FilterDropdownProps {
  tasks?: Task[];
  columns: Column[];
  selectedColumnIds?: string[];
  onToggleColumn?: (columnId: string) => void;
  assignees: AssigneeFilterOption[];
  members?: ProjectMember[];
  selectedAssigneeIds?: string[];
  onToggleAssignee?: (userId: string) => void;
  selectedPriorities?: TaskPriority[];
  onTogglePriority?: (priority: TaskPriority) => void;
  dueDateFilter?: DueDateFilterOption;
  onDueDateFilterChange?: (option: DueDateFilterOption) => void;
  cycles?: Cycle[];
  selectedCycleId?: string;
  onCycleSelect?: (cycleId: string) => void;
  totalActiveFilters: number;
  onClearAll: () => void;
  // Unified Filter State
  filters?: Filters;
  onToggleFilter?: <K extends keyof Filters>(key: K, item: any) => void;
  onRemoveFilter?: <K extends keyof Filters>(key: K, item?: any) => void;
}

interface FilterItemConfig {
  id: string;
  label: string;
  icon: React.ElementType;
}

const FILTER_ITEMS: FilterItemConfig[] = [
  { id: 'work-items', label: 'Tasks', icon: TasksIcon },
  { id: 'parent', label: 'Parent', icon: ParentBranchIcon },
  { id: 'state', label: 'State', icon: ConcentricCirclesIcon },
  { id: 'state-group', label: 'State Group', icon: ConcentricCirclesIcon },
  { id: 'assignees', label: 'Assignees', icon: Users },
  { id: 'priority', label: 'Priority', icon: PrioritySignalBarsIcon },
  { id: 'mentions', label: 'Mentions', icon: AtSign },
  { id: 'label', label: 'Label', icon: Tag },
  { id: 'cycle', label: 'Cycle', icon: CycleIcon },
  { id: 'attach', label: 'Attach', icon: Paperclip },
  { id: 'start-date', label: 'Start date', icon: CalendarClock },
  { id: 'due-date', label: 'Due date', icon: Calendar },
  { id: 'created-at', label: 'Created at', icon: Calendar },
  { id: 'updated-at', label: 'Updated at', icon: Calendar },
  { id: 'created-by', label: 'Created by', icon: UserCircle },
];

export function FilterDropdown({
  tasks = [],
  columns,
  selectedColumnIds = [],
  onToggleColumn,
  assignees,
  members,
  selectedAssigneeIds = [],
  onToggleAssignee,
  selectedPriorities = [],
  onTogglePriority,
  dueDateFilter,
  onDueDateFilterChange,
  cycles = [],
  selectedCycleId,
  onCycleSelect,
  totalActiveFilters,
  onClearAll,
  filters,
  onToggleFilter,
  onRemoveFilter,
}: FilterDropdownProps) {
  const [filterQuery, setFilterQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [subSearch, setSubSearch] = useState<Record<string, string>>({});

  const getSubSearch = (key: string) => subSearch[key] || '';
  const setSubSearchVal = (key: string, val: string) =>
    setSubSearch((prev) => ({ ...prev, [key]: val }));

  // Normalize project members for Mentions and Created by
  const membersList = useMemo(() => {
    const map = new Map<string, AssigneeFilterOption>();

    if (Array.isArray(members) && members.length > 0) {
      for (const m of members) {
        const id = (m as any).userId || (m as any).user?.id || m.id;
        if (!id) continue;
        const name = m.name || (m as any).user?.name || 'Member';
        const avatar = m.avatar || (m as any).user?.avatar || undefined;
        if (!map.has(id)) {
          map.set(id, { id, name, avatar });
        }
      }
    }

    if (Array.isArray(assignees)) {
      for (const a of assignees) {
        if (a.id !== '__unassigned__' && a.id !== 'unassigned' && !map.has(a.id)) {
          map.set(a.id, a);
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
  }, [members, assignees]);

  const hasActiveFilters = totalActiveFilters > 0;

  const filteredItems = useMemo(() => {
    if (!filterQuery.trim()) return FILTER_ITEMS;
    const q = filterQuery.toLowerCase().trim();
    return FILTER_ITEMS.filter((item) => item.label.toLowerCase().includes(q));
  }, [filterQuery]);

  // Central toggle helper
  const handleToggle = <K extends keyof Filters>(key: K, item: any) => {
    if (onToggleFilter) {
      onToggleFilter(key, item);
    } else {
      if (key === 'state' && onToggleColumn) onToggleColumn(item);
      if (key === 'assignees' && onToggleAssignee) onToggleAssignee(item);
      if (key === 'priority' && onTogglePriority) onTogglePriority(item);
      if (key === 'due_date' && onDueDateFilterChange) onDueDateFilterChange(item);
      if (key === 'cycle' && onCycleSelect) onCycleSelect(item);
    }
  };

  // Central active state checker
  const isItemActive = <K extends keyof Filters>(key: K, item: any): boolean => {
    if (filters && Array.isArray(filters[key])) {
      return (filters[key] as any[]).includes(item);
    }
    if (key === 'state') return selectedColumnIds.includes(item);
    if (key === 'assignees') return selectedAssigneeIds.includes(item);
    if (key === 'priority') return selectedPriorities.includes(item);
    if (key === 'due_date') return dueDateFilter === item;
    if (key === 'cycle') return selectedCycleId === item;
    return false;
  };

  // Extract unique labels from tasks
  const availableLabels = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) {
      if (Array.isArray(t.labels)) {
        for (const l of t.labels) {
          if (l) set.add(l);
        }
      }
    }
    if (set.size === 0) {
      return ['Frontend', 'Backend', 'Bug', 'Feature', 'Research', 'Documentation'];
    }
    return Array.from(set);
  }, [tasks]);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              className={cn(
                'size-8 rounded-md border border-border bg-background text-foreground hover:bg-muted cursor-pointer transition-colors relative shrink-0',
                hasActiveFilters && 'border-primary text-primary font-semibold',
              )}
              aria-label="Filters"
            >
              <FilterFunnelIcon className="size-4 text-foreground shrink-0" />
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 size-4 rounded-full bg-primary font-mono text-9 font-semibold text-primary-foreground flex items-center justify-center tabular-nums">
                  {totalActiveFilters}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          Filters
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent
        align="start"
        className="w-60 p-1 rounded-md border-border text-xs max-h-[85vh] overflow-y-auto"
      >
        {/* Main Search Header */}
        <div className="p-1 pb-1.5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-background focus-within:ring-1 focus-within:ring-primary">
            <Search className="size-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full bg-transparent text-12 text-foreground placeholder:text-muted-foreground outline-none"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        {/* Clear All when active */}
        {hasActiveFilters && (
          <div className="px-1.5 py-1 border-b border-border mb-1 flex items-center justify-between">
            <span className="text-11 font-medium text-muted-foreground">
              <span className="font-mono tabular-nums">{totalActiveFilters}</span> active filter{totalActiveFilters > 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={onClearAll}
              className="text-11 font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="size-3 shrink-0" />
              Clear all
            </button>
          </div>
        )}

        {/* 1. Work items (Submenu with Search) */}
        {filteredItems.some((i) => i.id === 'work-items') && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2.5 px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted">
              <TasksIcon className="size-4 shrink-0 text-foreground" />
              <span>Tasks</span>
              {(filters?.work_items.length ?? 0) > 0 && (
                <span className="size-1.5 rounded-full bg-primary shrink-0 ml-auto" />
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64 p-1 rounded-md border-border max-h-64 overflow-y-auto">
              <SubmenuSearchBar
                value={getSubSearch('work-items')}
                onChange={(v) => setSubSearchVal('work-items', v)}
                placeholder="Search"
              />
              {tasks
                .filter((t) => {
                  const q = getSubSearch('work-items').toLowerCase().trim();
                  if (!q) return true;
                  return (
                    (t.identifier || '').toLowerCase().includes(q) ||
                    (t.title || '').toLowerCase().includes(q)
                  );
                })
                .slice(0, 30)
                .map((task) => {
                  const val = task.identifier || task.id;
                  const isSelected = isItemActive('work_items', val);
                  return (
                    <DropdownMenuItem
                      key={task.id}
                      onClick={(e) => {
                        e.preventDefault();
                        handleToggle('work_items', val);
                      }}
                      className="flex items-center justify-between px-2.5 py-1.5 text-12 cursor-pointer text-foreground hover:bg-muted"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <WorkItemsIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        {task.identifier && (
                          <span className="font-mono text-11 text-muted-foreground shrink-0">
                            {task.identifier}
                          </span>
                        )}
                        <span className="truncate">{task.title}</span>
                      </div>
                      {isSelected && <Check className="size-3.5 text-primary shrink-0 ml-2" />}
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* 4. Parent (Submenu with Search) */}
        {filteredItems.some((i) => i.id === 'parent') && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2.5 px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted">
              <ParentBranchIcon className="size-4 shrink-0 text-foreground" />
              <span>Parent</span>
              {(filters?.parent.length ?? 0) > 0 && (
                <span className="size-1.5 rounded-full bg-primary shrink-0 ml-auto" />
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64 p-1 rounded-md border-border max-h-64 overflow-y-auto">
              <SubmenuSearchBar
                value={getSubSearch('parent')}
                onChange={(v) => setSubSearchVal('parent', v)}
                placeholder="Search"
              />
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  handleToggle('parent', '__none__');
                }}
                className="flex items-center justify-between px-2.5 py-1.5 text-12 cursor-pointer text-foreground hover:bg-muted"
              >
                <div className="flex items-center gap-2">
                  <ParentBranchIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span>None (Root items)</span>
                </div>
                {isItemActive('parent', '__none__') && (
                  <Check className="size-3.5 text-primary shrink-0 ml-2" />
                )}
              </DropdownMenuItem>
              {tasks
                .filter((t) => {
                  const q = getSubSearch('parent').toLowerCase().trim();
                  if (!q) return true;
                  return (
                    (t.identifier || '').toLowerCase().includes(q) ||
                    (t.title || '').toLowerCase().includes(q)
                  );
                })
                .slice(0, 30)
                .map((task) => {
                  const isSelected = isItemActive('parent', task.id);
                  return (
                    <DropdownMenuItem
                      key={task.id}
                      onClick={(e) => {
                        e.preventDefault();
                        handleToggle('parent', task.id);
                      }}
                      className="flex items-center justify-between px-2.5 py-1.5 text-12 cursor-pointer text-foreground hover:bg-muted"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ParentBranchIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        {task.identifier && (
                          <span className="font-mono text-11 text-muted-foreground shrink-0">
                            {task.identifier}
                          </span>
                        )}
                        <span className="truncate">{task.title}</span>
                      </div>
                      {isSelected && <Check className="size-3.5 text-primary shrink-0 ml-2" />}
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* 5. State (Submenu with Search & Icons) */}
        {filteredItems.some((i) => i.id === 'state') && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2.5 px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted">
              <ConcentricCirclesIcon className="size-4 shrink-0 text-foreground" />
              <span>State</span>
              {(filters?.state.length ?? selectedColumnIds.length) > 0 && (
                <span className="size-1.5 rounded-full bg-primary shrink-0 ml-auto" />
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56 p-1 rounded-md border-border max-h-64 overflow-y-auto">
              <SubmenuSearchBar
                value={getSubSearch('state')}
                onChange={(v) => setSubSearchVal('state', v)}
                placeholder="Search"
              />
              {columns
                .filter((col) => {
                  const q = getSubSearch('state').toLowerCase().trim();
                  if (!q) return true;
                  return (col.title || '').toLowerCase().includes(q);
                })
                .map((col) => {
                  const columnId = resolveStateId(col);
                  const isSelected = isItemActive('state', columnId);
                  const group = (col.group || inferStateGroup(columnId, col.title)).toLowerCase();

                  let StateIconComp = StateTodoIcon;
                  if (group === 'backlog') StateIconComp = StateBacklogIcon;
                  else if (group === 'started') StateIconComp = StateInProgressIcon;
                  else if (group === 'completed') StateIconComp = StateDoneIcon;
                  else if (group === 'cancelled') StateIconComp = StateCancelledIcon;

                  return (
                    <DropdownMenuItem
                      key={columnId}
                      onClick={(e) => {
                        e.preventDefault();
                        handleToggle('state', columnId);
                      }}
                      className="flex items-center justify-between px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <StateIconComp className="size-3.5 shrink-0" />
                        <span className="truncate">{col.title}</span>
                      </div>
                      {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* 6. State Group (Submenu with Search & Icons) */}
        {filteredItems.some((i) => i.id === 'state-group') && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2.5 px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted">
              <ConcentricCirclesIcon className="size-4 shrink-0 text-foreground" />
              <span>State Group</span>
              {(filters?.state_group.length ?? 0) > 0 && (
                <span className="size-1.5 rounded-full bg-primary shrink-0 ml-auto" />
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56 p-1 rounded-md border-border">
              <SubmenuSearchBar
                value={getSubSearch('state-group')}
                onChange={(v) => setSubSearchVal('state-group', v)}
                placeholder="Search"
              />
              {(
                [
                  { id: 'backlog', label: 'Backlog', icon: StateBacklogIcon },
                  { id: 'unstarted', label: 'Unstarted', icon: StateTodoIcon },
                  { id: 'started', label: 'Started', icon: StateInProgressIcon },
                  { id: 'completed', label: 'Completed', icon: StateDoneIcon },
                  { id: 'cancelled', label: 'Cancelled', icon: StateGroupCancelledIcon },
                ] as const
              )
                .filter((item) => {
                  const q = getSubSearch('state-group').toLowerCase().trim();
                  if (!q) return true;
                  return item.label.toLowerCase().includes(q);
                })
                .map((item) => {
                  const active = isItemActive('state_group', item.id);
                  const IconComp = item.icon;
                  return (
                    <DropdownMenuItem
                      key={item.id}
                      onClick={(e) => {
                        e.preventDefault();
                        handleToggle('state_group', item.id as StateGroup);
                      }}
                      className="flex items-center justify-between px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <IconComp className="size-3.5 shrink-0" />
                        <span>{item.label}</span>
                      </div>
                      {active && <Check className="size-3.5 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* 7. Assignees (Submenu with Search & Avatars) */}
        {filteredItems.some((i) => i.id === 'assignees') && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2.5 px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted">
              <Users className="size-4 shrink-0 text-foreground" />
              <span>Assignees</span>
              {(filters?.assignees.length ?? selectedAssigneeIds.length) > 0 && (
                <span className="size-1.5 rounded-full bg-primary shrink-0 ml-auto" />
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56 p-1 rounded-md border-border max-h-60 overflow-y-auto">
              <SubmenuSearchBar
                value={getSubSearch('assignees')}
                onChange={(v) => setSubSearchVal('assignees', v)}
                placeholder="Search"
              />
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  handleToggle('assignees', '__unassigned__');
                }}
                className="flex items-center justify-between px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <User className="size-4 text-muted-foreground shrink-0" />
                  <span>Unassigned</span>
                </div>
                {(isItemActive('assignees', '__unassigned__') ||
                  isItemActive('assignees', 'unassigned')) && (
                  <Check className="size-3.5 text-primary shrink-0" />
                )}
              </DropdownMenuItem>

              {assignees
                .filter((user) => {
                  const q = getSubSearch('assignees').toLowerCase().trim();
                  if (!q) return true;
                  return user.name.toLowerCase().includes(q);
                })
                .map((user) => {
                  const isSelected = isItemActive('assignees', user.id);
                  return (
                    <DropdownMenuItem
                      key={user.id}
                      onClick={(e) => {
                        e.preventDefault();
                        handleToggle('assignees', user.id);
                      }}
                      className="flex items-center justify-between px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {user.avatar ? (
                          <Avatar className="size-4 shrink-0">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback className="text-9">
                              {(user.name || 'U').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="size-4 rounded-full bg-muted flex items-center justify-center text-9 font-medium shrink-0">
                            {(user.name || 'U').slice(0, 1)}
                          </div>
                        )}
                        <span className="truncate">{user.name}</span>
                      </div>
                      {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* 8. Priority (Submenu with Search & Signal Bar Icons) */}
        {filteredItems.some((i) => i.id === 'priority') && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2.5 px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted">
              <PrioritySignalBarsIcon className="size-4 shrink-0 text-foreground" />
              <span>Priority</span>
              {(filters?.priority.length ?? selectedPriorities.length) > 0 && (
                <span className="size-1.5 rounded-full bg-primary shrink-0 ml-auto" />
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52 p-1 rounded-md border-border">
              <SubmenuSearchBar
                value={getSubSearch('priority')}
                onChange={(v) => setSubSearchVal('priority', v)}
                placeholder="Search"
              />
              {(
                [
                  { id: 'urgent', label: 'Urgent', icon: PriorityUrgentIcon },
                  { id: 'high', label: 'High', icon: PriorityHighIcon },
                  { id: 'medium', label: 'Medium', icon: PriorityMediumIcon },
                  { id: 'low', label: 'Low', icon: PriorityLowIcon },
                  { id: 'none', label: 'None', icon: PriorityNoneIcon },
                ] as const
              )
                .filter((p) => {
                  const q = getSubSearch('priority').toLowerCase().trim();
                  if (!q) return true;
                  return p.label.toLowerCase().includes(q);
                })
                .map((p) => {
                  const isSelected = isItemActive('priority', p.id as TaskPriority);
                  const IconComp = p.icon;
                  return (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={(e) => {
                        e.preventDefault();
                        handleToggle('priority', p.id as TaskPriority);
                      }}
                      className="flex items-center justify-between px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <IconComp className="size-3.5 shrink-0" />
                        <span>{p.label}</span>
                      </div>
                      {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* 9. Mentions (Submenu with Search & Avatars) */}
        {filteredItems.some((i) => i.id === 'mentions') && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2.5 px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted">
              <AtSign className="size-4 shrink-0 text-foreground" />
              <span>Mentions</span>
              {(filters?.mentions.length ?? 0) > 0 && (
                <span className="size-1.5 rounded-full bg-primary shrink-0 ml-auto" />
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56 p-1 rounded-md border-border max-h-56 overflow-y-auto">
              <SubmenuSearchBar
                value={getSubSearch('mentions')}
                onChange={(v) => setSubSearchVal('mentions', v)}
                placeholder="Search"
              />
              {(() => {
                const q = getSubSearch('mentions').toLowerCase().trim();
                const filteredMembers = membersList.filter((user) => {
                  if (!q) return true;
                  return user.name.toLowerCase().includes(q);
                });

                if (filteredMembers.length === 0) {
                  return (
                    <div className="px-3 py-2 text-12 text-muted-foreground text-center">
                      No members found
                    </div>
                  );
                }

                return filteredMembers.map((user) => {
                  const isSelected = isItemActive('mentions', user.id);
                  return (
                    <DropdownMenuItem
                      key={user.id}
                      onClick={(e) => {
                        e.preventDefault();
                        handleToggle('mentions', user.id);
                      }}
                      className="flex items-center justify-between px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {user.avatar ? (
                          <Avatar className="size-4 shrink-0">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback className="text-9">
                              {(user.name || 'U').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="size-4 rounded-full bg-muted flex items-center justify-center text-9 font-medium shrink-0">
                            {(user.name || 'U').slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span className="truncate">{user.name}</span>
                      </div>
                      {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  );
                });
              })()}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* 10. Label (Submenu with Search) */}
        {filteredItems.some((i) => i.id === 'label') && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2.5 px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted">
              <Tag className="size-4 shrink-0 text-foreground" />
              <span>Label</span>
              {(filters?.labels.length ?? 0) > 0 && (
                <span className="size-1.5 rounded-full bg-primary shrink-0 ml-auto" />
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52 p-1 rounded-md border-border max-h-56 overflow-y-auto">
              <SubmenuSearchBar
                value={getSubSearch('label')}
                onChange={(v) => setSubSearchVal('label', v)}
                placeholder="Search"
              />
              {availableLabels
                .filter((l) => {
                  const q = getSubSearch('label').toLowerCase().trim();
                  if (!q) return true;
                  return l.toLowerCase().includes(q);
                })
                .map((label) => {
                  const isSelected = isItemActive('labels', label);
                  return (
                    <DropdownMenuItem
                      key={label}
                      onClick={(e) => {
                        e.preventDefault();
                        handleToggle('labels', label);
                      }}
                      className="flex items-center justify-between px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="size-2 rounded-full bg-primary shrink-0" />
                        <span className="truncate">{label}</span>
                      </div>
                      {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* 11. Cycle (Submenu with Search) */}
        {filteredItems.some((i) => i.id === 'cycle') && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2.5 px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted">
              <CycleIcon className="size-4 shrink-0 text-foreground" />
              <span>Cycle</span>
              {(filters?.cycle.length ?? (selectedCycleId ? 1 : 0)) > 0 && (
                <span className="size-1.5 rounded-full bg-primary shrink-0 ml-auto" />
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56 p-1 rounded-md border-border max-h-56 overflow-y-auto">
              <SubmenuSearchBar
                value={getSubSearch('cycle')}
                onChange={(v) => setSubSearchVal('cycle', v)}
                placeholder="Search"
              />
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  handleToggle('cycle', '__no_cycle__');
                }}
                className="flex items-center justify-between px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CycleIcon className="size-3.5 shrink-0 opacity-40 text-foreground" />
                  <span>No cycle</span>
                </div>
                {isItemActive('cycle', '__no_cycle__') && (
                  <Check className="size-3.5 text-primary shrink-0" />
                )}
              </DropdownMenuItem>
              {cycles.length === 0 ? (
                <div className="px-3 py-2 text-12 text-muted-foreground text-center">No cycles</div>
              ) : (
                cycles
                  .filter((c) => {
                    const q = getSubSearch('cycle').toLowerCase().trim();
                    if (!q) return true;
                    return c.name.toLowerCase().includes(q);
                  })
                  .map((c) => {
                    const isSelected = isItemActive('cycle', c.id);
                    return (
                      <DropdownMenuItem
                        key={c.id}
                        onClick={(e) => {
                          e.preventDefault();
                          handleToggle('cycle', c.id);
                        }}
                        className="flex items-center justify-between px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CycleIcon className="size-3.5 shrink-0 text-foreground" />
                          <span className="truncate">{c.name}</span>
                        </div>
                        {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                      </DropdownMenuItem>
                    );
                  })
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* 12. Attach (replacing Module, Submenu with Search) */}
        {filteredItems.some((i) => i.id === 'attach') && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2.5 px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted">
              <Paperclip className="size-4 shrink-0 text-foreground" />
              <span>Attach</span>
              {(filters?.attach.length ?? 0) > 0 && (
                <span className="size-1.5 rounded-full bg-primary shrink-0 ml-auto" />
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56 p-1 rounded-md border-border">
              <SubmenuSearchBar
                value={getSubSearch('attach')}
                onChange={(v) => setSubSearchVal('attach', v)}
                placeholder="Search"
              />
              {(
                [
                  { id: 'has:attach', label: 'Has Attachments', icon: Layers },
                  { id: 'attach:pages', label: 'Pages (Manuscripts)', icon: FileText },
                  { id: 'attach:papers', label: 'Papers (Literature)', icon: BookOpen },
                  { id: 'attach:files', label: 'Files', icon: Paperclip },
                  { id: 'attach:links', label: 'Links', icon: Link2 },
                ] as const
              )
                .filter((item) => {
                  const q = getSubSearch('attach').toLowerCase().trim();
                  if (!q) return true;
                  return item.label.toLowerCase().includes(q);
                })
                .map((item) => {
                  const IconComp = item.icon;
                  const isSelected = isItemActive('attach', item.id);
                  return (
                    <DropdownMenuItem
                      key={item.id}
                      onClick={(e) => {
                        e.preventDefault();
                        handleToggle('attach', item.id);
                      }}
                      className="flex items-center justify-between px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <IconComp className="size-3.5 shrink-0 text-muted-foreground" />
                        <span>{item.label}</span>
                      </div>
                      {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* 13. Start date (Submenu with Search) */}
        {filteredItems.some((i) => i.id === 'start-date') && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2.5 px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted">
              <CalendarClock className="size-4 shrink-0 text-foreground" />
              <span>Start date</span>
              {(filters?.start_date.length ?? 0) > 0 && (
                <span className="size-1.5 rounded-full bg-primary shrink-0 ml-auto" />
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48 p-1 rounded-md border-border">
              <SubmenuSearchBar
                value={getSubSearch('start-date')}
                onChange={(v) => setSubSearchVal('start-date', v)}
                placeholder="Search"
              />
              {(
                [
                  { id: 'today', label: 'Today' },
                  { id: 'this_week', label: 'This week' },
                  { id: 'this_month', label: 'This month' },
                  { id: 'next_week', label: 'Next week' },
                  { id: 'no_date', label: 'No start date' },
                ] as const
              )
                .filter((d) => {
                  const q = getSubSearch('start-date').toLowerCase().trim();
                  if (!q) return true;
                  return d.label.toLowerCase().includes(q);
                })
                .map((d) => {
                  const isSelected = isItemActive('start_date', d.id);
                  return (
                    <DropdownMenuItem
                      key={d.id}
                      onClick={(e) => {
                        e.preventDefault();
                        handleToggle('start_date', d.id);
                      }}
                      className="flex items-center justify-between px-2.5 py-1.5 text-13 cursor-pointer hover:bg-muted"
                    >
                      <span>{d.label}</span>
                      {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* 14. Due date (Submenu with Search) */}
        {filteredItems.some((i) => i.id === 'due-date') && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2.5 px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted">
              <Calendar className="size-4 shrink-0 text-foreground" />
              <span>Due date</span>
              {(filters?.due_date.length ?? (dueDateFilter !== 'all' ? 1 : 0)) > 0 && (
                <span className="size-1.5 rounded-full bg-primary shrink-0 ml-auto" />
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52 p-1 rounded-md border-border">
              <SubmenuSearchBar
                value={getSubSearch('due-date')}
                onChange={(v) => setSubSearchVal('due-date', v)}
                placeholder="Search"
              />
              {(
                [
                  { id: 'all', label: 'All Due Dates' },
                  { id: 'overdue', label: 'Overdue' },
                  { id: 'this_week', label: 'Due this week' },
                  { id: 'today', label: 'Due today' },
                  { id: 'this_month', label: 'Due this month' },
                  { id: 'no_date', label: 'No due date' },
                ] as Array<{ id: DueDateFilterOption | 'today' | 'this_month'; label: string }>
              )
                .filter((opt) => {
                  const q = getSubSearch('due-date').toLowerCase().trim();
                  if (!q) return true;
                  return opt.label.toLowerCase().includes(q);
                })
                .map((opt) => {
                  const isSelected = isItemActive('due_date', opt.id);
                  return (
                    <DropdownMenuItem
                      key={opt.id}
                      onClick={(e) => {
                        e.preventDefault();
                        handleToggle('due_date', opt.id);
                      }}
                      className="flex items-center justify-between px-2.5 py-1.5 text-13 cursor-pointer hover:bg-muted"
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* 15. Created at (Submenu with Search) */}
        {filteredItems.some((i) => i.id === 'created-at') && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2.5 px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted">
              <Calendar className="size-4 shrink-0 text-foreground" />
              <span>Created at</span>
              {(filters?.created_at.length ?? 0) > 0 && (
                <span className="size-1.5 rounded-full bg-primary shrink-0 ml-auto" />
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48 p-1 rounded-md border-border">
              <SubmenuSearchBar
                value={getSubSearch('created-at')}
                onChange={(v) => setSubSearchVal('created-at', v)}
                placeholder="Search"
              />
              {['Today', 'This week', 'This month', 'This year']
                .filter((d) => {
                  const q = getSubSearch('created-at').toLowerCase().trim();
                  if (!q) return true;
                  return d.toLowerCase().includes(q);
                })
                .map((d) => {
                  const val = d.toLowerCase().replace(' ', '_');
                  const isSelected = isItemActive('created_at', val);
                  return (
                    <DropdownMenuItem
                      key={d}
                      onClick={(e) => {
                        e.preventDefault();
                        handleToggle('created_at', val);
                      }}
                      className="flex items-center justify-between px-2.5 py-1.5 text-13 cursor-pointer hover:bg-muted"
                    >
                      <span>{d}</span>
                      {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* 16. Updated at (Submenu with Search) */}
        {filteredItems.some((i) => i.id === 'updated-at') && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2.5 px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted">
              <Calendar className="size-4 shrink-0 text-foreground" />
              <span>Updated at</span>
              {(filters?.updated_at.length ?? 0) > 0 && (
                <span className="size-1.5 rounded-full bg-primary shrink-0 ml-auto" />
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48 p-1 rounded-md border-border">
              <SubmenuSearchBar
                value={getSubSearch('updated-at')}
                onChange={(v) => setSubSearchVal('updated-at', v)}
                placeholder="Search"
              />
              {['Today', 'This week', 'This month', 'This year']
                .filter((d) => {
                  const q = getSubSearch('updated-at').toLowerCase().trim();
                  if (!q) return true;
                  return d.toLowerCase().includes(q);
                })
                .map((d) => {
                  const val = d.toLowerCase().replace(' ', '_');
                  const isSelected = isItemActive('updated_at', val);
                  return (
                    <DropdownMenuItem
                      key={d}
                      onClick={(e) => {
                        e.preventDefault();
                        handleToggle('updated_at', val);
                      }}
                      className="flex items-center justify-between px-2.5 py-1.5 text-13 cursor-pointer hover:bg-muted"
                    >
                      <span>{d}</span>
                      {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* 17. Created by (Submenu with Search & Avatars) */}
        {filteredItems.some((i) => i.id === 'created-by') && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2.5 px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted">
              <UserCircle className="size-4 shrink-0 text-foreground" />
              <span>Created by</span>
              {(filters?.created_by.length ?? 0) > 0 && (
                <span className="size-1.5 rounded-full bg-primary shrink-0 ml-auto" />
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56 p-1 rounded-md border-border max-h-56 overflow-y-auto">
              <SubmenuSearchBar
                value={getSubSearch('created-by')}
                onChange={(v) => setSubSearchVal('created-by', v)}
                placeholder="Search"
              />
              {(() => {
                const q = getSubSearch('created-by').toLowerCase().trim();
                const filteredMembers = membersList.filter((user) => {
                  if (!q) return true;
                  return user.name.toLowerCase().includes(q);
                });

                if (filteredMembers.length === 0) {
                  return (
                    <div className="px-3 py-2 text-12 text-muted-foreground text-center">
                      No members found
                    </div>
                  );
                }

                return filteredMembers.map((user) => {
                  const isSelected = isItemActive('created_by', user.id);
                  return (
                    <DropdownMenuItem
                      key={user.id}
                      onClick={(e) => {
                        e.preventDefault();
                        handleToggle('created_by', user.id);
                      }}
                      className="flex items-center justify-between px-2.5 py-1.5 text-13 cursor-pointer text-foreground hover:bg-muted"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {user.avatar ? (
                          <Avatar className="size-4 shrink-0">
                            <AvatarImage src={user.avatar} />
                            <AvatarFallback className="text-9">
                              {(user.name || 'U').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="size-4 rounded-full bg-muted flex items-center justify-center text-9 font-medium shrink-0">
                            {(user.name || 'U').slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span className="truncate">{user.name}</span>
                      </div>
                      {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                    </DropdownMenuItem>
                  );
                });
              })()}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default FilterDropdown;
