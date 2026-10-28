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
  AlertCircle,
  CircleSlash,
  FileText,
  BookOpen,
  Link2,
  Layers,
} from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/shared/components/ui/dropdown-menu';
import { Button } from '@/shared/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/components/ui/tooltip';
import { cn } from "@/shared/lib/utils";
import type {
  Column,
  Item,
  Priority,
  StateGroup,
  DueDateFilterOption,
  Filters,
  ProjectMember,
} from '@/features/projects/project-id/work-items/types/work-item.types';
import {
  resolveStateId,
} from '@/features/projects/project-id/work-items/utils/work-item.utils';
import type { AssigneeFilterOption } from '@/features/projects/project-id/work-items/hooks/use-topbar';

import {
  StatusIcon,
  BacklogStatusIcon as StateBacklogIcon,
  TodoStatusIcon as StateTodoIcon,
  InProgressStatusIcon as StateInProgressIcon,
  DoneStatusIcon as StateDoneIcon,
  CancelledStatusIcon as StateCancelledIcon,
  FilterFunnelIcon,
  TextLinesIcon,
  ItemsIcon,
  ParentBranchIcon,
  ConcentricCirclesIcon,
  PrioritySignalBarsIcon,
  WorkItemsIcon,
} from '@/shared/components/icons';

export {
  FilterFunnelIcon,
  TextLinesIcon,
  ItemsIcon,
  ParentBranchIcon,
  ConcentricCirclesIcon,
  PrioritySignalBarsIcon,
  WorkItemsIcon,
  StateBacklogIcon,
  StateTodoIcon,
  StateInProgressIcon,
  StateDoneIcon,
  StateCancelledIcon,
};

// ── Submenu State Icons ─────────────────────────────────────────────────────

export function StateGroupCancelledIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('size-3.5 text-state-cancelled shrink-0', className)} viewBox="0 0 24 24" fill="currentColor">
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
  return <AlertCircle className={cn('size-3.5 text-foreground shrink-0 stroke-[1.75]', className)} />;
}

export function PriorityHighIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('size-3.5 text-foreground shrink-0', className)} viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="14" width="3.5" height="6" rx="1" />
      <rect x="10.25" y="9" width="3.5" height="11" rx="1" />
      <rect x="16.5" y="4" width="3.5" height="16" rx="1" />
    </svg>
  );
}

export function PriorityMediumIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('size-3.5 text-foreground shrink-0', className)} viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="14" width="3.5" height="6" rx="1" />
      <rect x="10.25" y="9" width="3.5" height="11" rx="1" />
      <rect x="16.5" y="4" width="3.5" height="16" rx="1" className="opacity-20" />
    </svg>
  );
}

export function PriorityLowIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('size-3.5 text-foreground shrink-0', className)} viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="14" width="3.5" height="6" rx="1" />
      <rect x="10.25" y="9" width="3.5" height="11" rx="1" className="opacity-20" />
      <rect x="16.5" y="4" width="3.5" height="16" rx="1" className="opacity-20" />
    </svg>
  );
}

export function PriorityNoneIcon({ className }: { className?: string }) {
  return <CircleSlash className={cn('size-3.5 text-foreground shrink-0 stroke-[1.5]', className)} />;
}

// ── Submenu Search Input Component ──────────────────────────────────────────

function SubmenuSearchBar({
  value,
  onChange,
  placeholder = 'Search...',
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="p-1 pb-1.5 border-b border-border mb-1" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-background border border-border text-12 text-foreground">
        <Search className="size-3.5 text-foreground shrink-0" />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="w-full bg-transparent text-12 text-foreground placeholder:text-foreground/70 outline-none"
        />
      </div>
    </div>
  );
}

function MemberFilterSubmenu({
  icon: Icon,
  label,
  hasActive,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  users,
  isSelected,
  onSelectUser,
  showUnassigned = false,
  isUnassignedSelected = false,
  onSelectUnassigned,
  showEmptyMessage = false,
}: {
  icon: React.ElementType;
  label: string;
  hasActive: boolean;
  searchValue: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder?: string;
  users: AssigneeFilterOption[];
  isSelected: (userId: string) => boolean;
  onSelectUser: (userId: string) => void;
  showUnassigned?: boolean;
  isUnassignedSelected?: boolean;
  onSelectUnassigned?: () => void;
  showEmptyMessage?: boolean;
}) {
  const q = searchValue.toLowerCase().trim();
  const filteredUsers = users.filter((u) => !q || (u.name || '').toLowerCase().includes(q));

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="flex items-center gap-2 px-2 py-1.5 text-12 rounded-md cursor-pointer text-foreground hover:bg-muted focus:bg-muted">
        <Icon className="size-4 shrink-0 text-foreground" />
        <span>{label}</span>
        {hasActive && (
          <span className="size-1.5 rounded-full bg-foreground shrink-0 ml-auto mr-1" />
        )}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-56 p-1 rounded-md border-border bg-popover text-12 shadow-overlay max-h-60 overflow-y-auto">
        <SubmenuSearchBar
          value={searchValue}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
        />
        {showUnassigned && onSelectUnassigned && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              onSelectUnassigned();
            }}
            className="flex items-center justify-between px-2 py-1.5 text-12 rounded-md cursor-pointer text-foreground hover:bg-muted focus:bg-muted"
          >
            <div className="flex items-center gap-2 min-w-0">
              <User className="size-4 text-foreground shrink-0" />
              <span>Unassigned</span>
            </div>
            {isUnassignedSelected && <Check className="size-3.5 text-foreground shrink-0" />}
          </DropdownMenuItem>
        )}
        {showEmptyMessage && filteredUsers.length === 0 ? (
          <div className="px-3 py-2 text-12 text-foreground/60 text-center">
            No members found
          </div>
        ) : (
          filteredUsers.map((user) => {
            const active = isSelected(user.id);
            return (
              <DropdownMenuItem
                key={user.id}
                onSelect={(e) => {
                  e.preventDefault();
                  onSelectUser(user.id);
                }}
                className="flex items-center justify-between px-2 py-1.5 text-12 rounded-md cursor-pointer text-foreground hover:bg-muted focus:bg-muted"
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
                {active && <Check className="size-3.5 text-foreground shrink-0" />}
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function DateFilterSubmenu({
  icon: Icon,
  label,
  hasActive,
  searchValue,
  onSearchChange,
  options,
  isSelected,
  onSelectOption,
  widthClass = 'w-48',
}: {
  icon: React.ElementType;
  label: string;
  hasActive: boolean;
  searchValue: string;
  onSearchChange: (val: string) => void;
  options: ReadonlyArray<{ id: string; label: string }>;
  isSelected: (id: string) => boolean;
  onSelectOption: (id: string) => void;
  widthClass?: string;
}) {
  const q = searchValue.toLowerCase().trim();
  const filteredOptions = options.filter((opt) => !q || opt.label.toLowerCase().includes(q));

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="flex items-center gap-2 px-2 py-1.5 text-12 rounded-md cursor-pointer text-foreground hover:bg-muted focus:bg-muted [&>svg:last-child]:hidden">
        <Icon className="size-4 shrink-0 text-foreground" />
        <span>{label}</span>
        {hasActive && (
          <span className="size-1.5 rounded-full bg-foreground shrink-0 ml-auto mr-1" />
        )}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className={`${widthClass} p-1 rounded-md border-border bg-popover text-12 shadow-overlay`}>
        <SubmenuSearchBar
          value={searchValue}
          onChange={onSearchChange}
          placeholder="Search..."
        />
        {filteredOptions.map((opt) => {
          const active = isSelected(opt.id);
          return (
            <DropdownMenuItem
              key={opt.id}
              onSelect={(e) => {
                e.preventDefault();
                onSelectOption(opt.id);
              }}
              className="flex items-center justify-between px-2 py-1.5 text-12 rounded-md cursor-pointer text-foreground hover:bg-muted focus:bg-muted"
            >
              <span>{opt.label}</span>
              {active && <Check className="size-3.5 text-foreground shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

const CREATED_UPDATED_DATE_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: 'this_week', label: 'This week' },
  { id: 'this_month', label: 'This month' },
  { id: 'this_year', label: 'This year' },
] as const;

// ── Filter Dropdown Props & Configuration ───────────────────────────────────

import type { FilterDropdownProps } from '@/features/projects/project-id/work-items/types/layout.types';
import type { FilterItemConfig } from '@/features/projects/project-id/work-items/types/filter.types';

export type { FilterDropdownProps, FilterItemConfig };

const FILTER_ITEMS: FilterItemConfig[] = [
  { id: 'work-items', label: 'Work items', icon: ItemsIcon },
  { id: 'parent', label: 'Parent', icon: ParentBranchIcon },
  { id: 'state', label: 'State', icon: ConcentricCirclesIcon },
  { id: 'state-group', label: 'State Group', icon: ConcentricCirclesIcon },
  { id: 'assignees', label: 'Assignees', icon: Users },
  { id: 'subscribers', label: 'Subscribers', icon: User },
  { id: 'priority', label: 'Priority', icon: PrioritySignalBarsIcon },
  { id: 'mentions', label: 'Mentions', icon: AtSign },
  { id: 'label', label: 'Label', icon: Tag },
  { id: 'attach', label: 'Attachment type', icon: Paperclip },
  { id: 'start-date', label: 'Start date', icon: CalendarClock },
  { id: 'due-date', label: 'Due date', icon: Calendar },
  { id: 'created-at', label: 'Created at', icon: Calendar },
  { id: 'updated-at', label: 'Updated at', icon: Calendar },
  { id: 'created-by', label: 'Created by', icon: UserCircle },
];

export function FilterDropdown({
  items = [],
  columns = [],
  selectedColumnIds = [],
  onToggleColumn,
  assignees = [],
  members,
  selectedAssigneeIds = [],
  onToggleAssignee,
  selectedPriorities = [],
  onTogglePriority,
  dueDateFilter,
  onDueDateFilterChange,
  totalActiveFilters = 0,
  filters,
  onToggleFilter,
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
        const memberObj = m as { userId?: string; user?: { id?: string; name?: string; avatar?: string | null }; id?: string; name?: string; avatar?: string | null };
        const id = memberObj.userId || memberObj.user?.id || memberObj.id;
        if (!id) continue;
        const name = memberObj.name || memberObj.user?.name || 'Member';
        const avatar = memberObj.avatar || memberObj.user?.avatar || undefined;
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
  const handleToggle = <K extends keyof Filters>(key: K, item: Filters[K] extends (infer E)[] ? E : string) => {
    if (onToggleFilter) {
      onToggleFilter(key, item);
    } else {
      if (key === 'state' && onToggleColumn) onToggleColumn(item as string);
      if (key === 'assignees' && onToggleAssignee) onToggleAssignee(item as string);
      if (key === 'priority' && onTogglePriority) onTogglePriority(item as Priority);
      if (key === 'due_date' && onDueDateFilterChange) onDueDateFilterChange((item || 'all') as DueDateFilterOption);
    }
  };

  // Central active state checker
  const isItemActive = <K extends keyof Filters>(key: K, item: unknown): boolean => {
    if (filters && Array.isArray(filters[key])) {
      return (filters[key] as unknown[]).includes(item);
    }
    if (key === 'state') return selectedColumnIds.includes(item as string);
    if (key === 'assignees') return selectedAssigneeIds.includes(item as string);
    if (key === 'priority') return selectedPriorities.includes(item as Priority);
    if (key === 'due_date') return dueDateFilter === item;
    return false;
  };

  // Extract unique labels from items
  const availableLabels = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color?: string }>();
    for (const t of items) {
      if (Array.isArray(t.labels)) {
        for (const l of t.labels) {
          if (!l) continue;
          if (typeof l === 'string') {
            if (!map.has(l)) map.set(l, { id: l, name: l, color: '#3b82f6' });
          } else if (typeof l === 'object' && l !== null) {
            const lbl = l as { id?: string; name?: string; title?: string; color?: string };
            const id = lbl.id || lbl.name;
            const name = lbl.name || lbl.title || id || 'Label';
            if (id && !map.has(id)) {
              map.set(id, { id, name, color: lbl.color || '#0969DA' });
            }
          }
        }
      }
    }
    if (map.size === 0) {
      return [
        { id: 'Bug', name: 'Bug', color: '#CF222E' },
        { id: 'Feature', name: 'Feature', color: '#0969DA' },
        { id: 'Frontend', name: 'Frontend', color: '#1A7F37' },
        { id: 'Backend', name: 'Backend', color: '#D97706' },
        { id: 'Documentation', name: 'Documentation', color: '#8250DF' },
      ];
    }
    return Array.from(map.values());
  }, [items]);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              className={cn(
                'size-8 rounded-md border border-border bg-background text-foreground hover:bg-muted cursor-pointer transition-colors relative shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring before:absolute before:-inset-1 md:before:hidden',
                isOpen && 'bg-muted',
              )}
              aria-label="Filters"
            >
              <FilterFunnelIcon className="size-4 text-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          Filters
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent
        align="start"
        className="w-56 p-1 rounded-md border-border bg-popover text-12 shadow-overlay max-h-[85vh] overflow-y-auto"
      >
        {/* Main Search Header */}
        <div className="p-1 pb-1.5 border-b border-border mb-1" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-background border border-border text-12 text-foreground">
            <Search className="size-3.5 text-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search filters..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full bg-transparent text-12 text-foreground placeholder:text-foreground/70 outline-none"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        {/* Active filters count */}
        {hasActiveFilters && (
          <div className="px-2 py-1 border-b border-border mb-1 flex items-center">
            <span className="text-11 font-medium text-foreground">
              <span className="font-mono tabular-nums">{totalActiveFilters}</span> active filter{totalActiveFilters > 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* 1. Work items (Submenu with Search) */}
        {filteredItems.some((i) => i.id === 'work-items') && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2 px-2 py-1.5 text-12 rounded-md cursor-pointer text-foreground hover:bg-muted focus:bg-muted">
              <ItemsIcon className="size-4 shrink-0 text-foreground" />
              <span>Work items</span>
              {(filters?.work_items.length ?? 0) > 0 && (
                <span className="size-1.5 rounded-full bg-foreground shrink-0 ml-auto mr-1" />
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-60 p-1 rounded-md border-border bg-popover text-12 shadow-overlay max-h-64 overflow-y-auto">
              <SubmenuSearchBar
                value={getSubSearch('work-items')}
                onChange={(v) => setSubSearchVal('work-items', v)}
                placeholder="Search..."
              />
              {items
                .filter((t: Item) => {
                  const q = getSubSearch('work-items').toLowerCase().trim();
                  if (!q) return true;
                  return (
                    (t.identifier || '').toLowerCase().includes(q) ||
                    (t.title || '').toLowerCase().includes(q)
                  );
                })
                .slice(0, 30)
                .map((item: Item) => {
                  const val = item.identifier || item.id;
                  const isSelected = isItemActive('work_items', val);
                  return (
                    <DropdownMenuItem
                      key={item.id}
                      onSelect={(e) => {
                        e.preventDefault();
                        handleToggle('work_items', val);
                      }}
                      className="flex items-center justify-between px-2 py-1.5 text-12 rounded-md cursor-pointer text-foreground hover:bg-muted focus:bg-muted"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <WorkItemsIcon className="size-3.5 shrink-0 text-foreground" />
                        {item.identifier && (
                          <span className="font-mono text-11 text-foreground/75 shrink-0">
                            {item.identifier}
                          </span>
                        )}
                        <span className="truncate">{item.title}</span>
                      </div>
                      {isSelected && <Check className="size-3.5 text-foreground shrink-0 ml-2" />}
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* 4. Parent (Submenu with Search) */}
        {filteredItems.some((i) => i.id === 'parent') && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2 px-2 py-1.5 text-12 rounded-md cursor-pointer text-foreground hover:bg-muted focus:bg-muted">
              <ParentBranchIcon className="size-4 shrink-0 text-foreground" />
              <span>Parent</span>
              {(filters?.parent.length ?? 0) > 0 && (
                <span className="size-1.5 rounded-full bg-foreground shrink-0 ml-auto mr-1" />
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-60 p-1 rounded-md border-border bg-popover text-12 shadow-overlay max-h-64 overflow-y-auto">
              <SubmenuSearchBar
                value={getSubSearch('parent')}
                onChange={(v) => setSubSearchVal('parent', v)}
                placeholder="Search..."
              />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  handleToggle('parent', '__none__');
                }}
                className="flex items-center justify-between px-2 py-1.5 text-12 rounded-md cursor-pointer text-foreground hover:bg-muted focus:bg-muted"
              >
                <div className="flex items-center gap-2">
                  <ParentBranchIcon className="size-3.5 shrink-0 text-foreground" />
                  <span>None (Root items)</span>
                </div>
                {isItemActive('parent', '__none__') && (
                  <Check className="size-3.5 text-foreground shrink-0 ml-2" />
                )}
              </DropdownMenuItem>
              {items
                .filter((t: Item) => {
                  const q = getSubSearch('parent').toLowerCase().trim();
                  if (!q) return true;
                  return (
                    (t.identifier || '').toLowerCase().includes(q) ||
                    (t.title || '').toLowerCase().includes(q)
                  );
                })
                .slice(0, 30)
                .map((item: Item) => {
                  const isSelected = isItemActive('parent', item.id);
                  return (
                    <DropdownMenuItem
                      key={item.id}
                      onSelect={(e) => {
                        e.preventDefault();
                        handleToggle('parent', item.id);
                      }}
                      className="flex items-center justify-between px-2 py-1.5 text-12 rounded-md cursor-pointer text-foreground hover:bg-muted focus:bg-muted"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <ParentBranchIcon className="size-3.5 shrink-0 text-foreground" />
                        {item.identifier && (
                          <span className="font-mono text-11 text-foreground/75 shrink-0">
                            {item.identifier}
                          </span>
                        )}
                        <span className="truncate">{item.title}</span>
                      </div>
                      {isSelected && <Check className="size-3.5 text-foreground shrink-0 ml-2" />}
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* 5. State (Submenu with Search & Icons) */}
        {filteredItems.some((i) => i.id === 'state') && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2 px-2 py-1.5 text-12 rounded-md cursor-pointer text-foreground hover:bg-muted focus:bg-muted">
              <ConcentricCirclesIcon className="size-4 shrink-0 text-foreground" />
              <span>State</span>
              {(filters?.state.length ?? selectedColumnIds.length) > 0 && (
                <span className="size-1.5 rounded-full bg-foreground shrink-0 ml-auto mr-1" />
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56 p-1 rounded-md border-border bg-popover text-12 shadow-overlay max-h-64 overflow-y-auto">
              <SubmenuSearchBar
                value={getSubSearch('state')}
                onChange={(v) => setSubSearchVal('state', v)}
                placeholder="Search..."
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
                  return (
                    <DropdownMenuItem
                      key={columnId}
                      onSelect={(e) => {
                        e.preventDefault();
                        handleToggle('state', columnId);
                      }}
                      className="flex items-center justify-between px-2 py-1.5 text-12 rounded-md cursor-pointer text-foreground hover:bg-muted focus:bg-muted"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <StatusIcon
                          id={columnId}
                          title={col.title}
                          group={col.group}
                          color={col.color || col.accentColor}
                          className="size-3.5 shrink-0"
                        />
                        <span className="truncate">{col.title}</span>
                      </div>
                      {isSelected && <Check className="size-3.5 text-foreground shrink-0" />}
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* 6. State Group (Submenu with Search & Icons) */}
        {filteredItems.some((i) => i.id === 'state-group') && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2 px-2 py-1.5 text-12 rounded-md cursor-pointer text-foreground hover:bg-muted focus:bg-muted">
              <ConcentricCirclesIcon className="size-4 shrink-0 text-foreground" />
              <span>State Group</span>
              {(filters?.state_group.length ?? 0) > 0 && (
                <span className="size-1.5 rounded-full bg-foreground shrink-0 ml-auto mr-1" />
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56 p-1 rounded-md border-border bg-popover text-12 shadow-overlay">
              <SubmenuSearchBar
                value={getSubSearch('state-group')}
                onChange={(v) => setSubSearchVal('state-group', v)}
                placeholder="Search..."
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
                      onSelect={(e) => {
                        e.preventDefault();
                        handleToggle('state_group', item.id as StateGroup);
                      }}
                      className="flex items-center justify-between px-2 py-1.5 text-12 rounded-md cursor-pointer text-foreground hover:bg-muted focus:bg-muted"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <IconComp className="size-3.5 shrink-0" />
                        <span>{item.label}</span>
                      </div>
                      {active && <Check className="size-3.5 text-foreground shrink-0" />}
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* 7. Assignees (Submenu with Search & Avatars) */}
        {filteredItems.some((i) => i.id === 'assignees') && (
          <MemberFilterSubmenu
            icon={Users}
            label="Assignees"
            hasActive={(filters?.assignees.length ?? selectedAssigneeIds.length) > 0}
            searchValue={getSubSearch('assignees')}
            onSearchChange={(v) => setSubSearchVal('assignees', v)}
            users={assignees}
            isSelected={(id) => isItemActive('assignees', id)}
            onSelectUser={(id) => handleToggle('assignees', id)}
            showUnassigned
            isUnassignedSelected={
              isItemActive('assignees', '__unassigned__') || isItemActive('assignees', 'unassigned')
            }
            onSelectUnassigned={() => handleToggle('assignees', '__unassigned__')}
          />
        )}

        {/* 7b. Subscribers (Submenu — same member pool as Assignees) */}
        {filteredItems.some((i) => i.id === 'subscribers') && (
          <MemberFilterSubmenu
            icon={User}
            label="Subscribers"
            hasActive={(filters?.subscribers?.length ?? 0) > 0}
            searchValue={getSubSearch('subscribers')}
            onSearchChange={(v) => setSubSearchVal('subscribers', v)}
            searchPlaceholder="Search members..."
            users={assignees}
            isSelected={(id) => isItemActive('subscribers', id)}
            onSelectUser={(id) => handleToggle('subscribers', id)}
          />
        )}

        {/* 8. Priority (Submenu with Search & Signal Bar Icons) */}
        {filteredItems.some((i) => i.id === 'priority') && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2 px-2 py-1.5 text-12 rounded-md cursor-pointer text-foreground hover:bg-muted focus:bg-muted">
              <PrioritySignalBarsIcon className="size-4 shrink-0 text-foreground" />
              <span>Priority</span>
              {(filters?.priority.length ?? selectedPriorities.length) > 0 && (
                <span className="size-1.5 rounded-full bg-foreground shrink-0 ml-auto mr-1" />
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52 p-1 rounded-md border-border bg-popover text-12 shadow-overlay">
              <SubmenuSearchBar
                value={getSubSearch('priority')}
                onChange={(v) => setSubSearchVal('priority', v)}
                placeholder="Search..."
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
                  const isSelected = isItemActive('priority', p.id as Priority);
                  const IconComp = p.icon;
                  return (
                    <DropdownMenuItem
                      key={p.id}
                      onSelect={(e) => {
                        e.preventDefault();
                        handleToggle('priority', p.id as Priority);
                      }}
                      className="flex items-center justify-between px-2 py-1.5 text-12 rounded-md cursor-pointer text-foreground hover:bg-muted focus:bg-muted"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <IconComp className="size-3.5 shrink-0" />
                        <span>{p.label}</span>
                      </div>
                      {isSelected && <Check className="size-3.5 text-foreground shrink-0" />}
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* 9. Mentions (Submenu with Search & Avatars) */}
        {filteredItems.some((i) => i.id === 'mentions') && (
          <MemberFilterSubmenu
            icon={AtSign}
            label="Mentions"
            hasActive={(filters?.mentions.length ?? 0) > 0}
            searchValue={getSubSearch('mentions')}
            onSearchChange={(v) => setSubSearchVal('mentions', v)}
            users={membersList}
            isSelected={(id) => isItemActive('mentions', id)}
            onSelectUser={(id) => handleToggle('mentions', id)}
            showEmptyMessage
          />
        )}

        {/* 10. Label (Submenu with Search) */}
        {filteredItems.some((i) => i.id === 'label') && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2 px-2 py-1.5 text-12 rounded-md cursor-pointer text-foreground hover:bg-muted focus:bg-muted">
              <Tag className="size-4 shrink-0 text-foreground" />
              <span>Label</span>
              {(filters?.labels.length ?? 0) > 0 && (
                <span className="size-1.5 rounded-full bg-foreground shrink-0 ml-auto mr-1" />
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52 p-1 rounded-md border-border bg-popover text-12 shadow-overlay max-h-56 overflow-y-auto">
              <SubmenuSearchBar
                value={getSubSearch('label')}
                onChange={(v) => setSubSearchVal('label', v)}
                placeholder="Search..."
              />
              {availableLabels
                .filter((l) => {
                  const q = getSubSearch('label').toLowerCase().trim();
                  if (!q) return true;
                  return l.name.toLowerCase().includes(q) || l.id.toLowerCase().includes(q);
                })
                .map((label) => {
                  const isSelected = isItemActive('labels', label.id) || isItemActive('labels', label.name);
                  return (
                    <DropdownMenuItem
                      key={label.id}
                      onSelect={(e) => {
                        e.preventDefault();
                        handleToggle('labels', label.id);
                      }}
                      className="flex items-center justify-between px-2 py-1.5 text-12 rounded-md cursor-pointer text-foreground hover:bg-muted focus:bg-muted"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: label.color || '#0969DA' }}
                        />
                        <span className="truncate">{label.name}</span>
                      </div>
                      {isSelected && <Check className="size-3.5 text-foreground shrink-0" />}
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* 12. Attach (Submenu with Search) */}
        {filteredItems.some((i) => i.id === 'attach') && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2 px-2 py-1.5 text-12 rounded-md cursor-pointer text-foreground hover:bg-muted focus:bg-muted">
              <Paperclip className="size-4 shrink-0 text-foreground" />
              <span>Attach</span>
              {(filters?.attach.length ?? 0) > 0 && (
                <span className="size-1.5 rounded-full bg-foreground shrink-0 ml-auto mr-1" />
              )}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56 p-1 rounded-md border-border bg-popover text-12 shadow-overlay">
              <SubmenuSearchBar
                value={getSubSearch('attach')}
                onChange={(v) => setSubSearchVal('attach', v)}
                placeholder="Search..."
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
                      onSelect={(e) => {
                        e.preventDefault();
                        handleToggle('attach', item.id);
                      }}
                      className="flex items-center justify-between px-2 py-1.5 text-12 rounded-md cursor-pointer text-foreground hover:bg-muted focus:bg-muted"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <IconComp className="size-3.5 shrink-0 text-foreground" />
                        <span>{item.label}</span>
                      </div>
                      {isSelected && <Check className="size-3.5 text-foreground shrink-0" />}
                    </DropdownMenuItem>
                  );
                })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        {/* 13. Start date (Submenu with Search) */}
        {filteredItems.some((i) => i.id === 'start-date') && (
          <DateFilterSubmenu
            icon={CalendarClock}
            label="Start date"
            hasActive={(filters?.start_date.length ?? 0) > 0}
            searchValue={getSubSearch('start-date')}
            onSearchChange={(v) => setSubSearchVal('start-date', v)}
            options={[
              { id: 'today', label: 'Today' },
              { id: 'this_week', label: 'This week' },
              { id: 'this_month', label: 'This month' },
              { id: 'next_week', label: 'Next week' },
              { id: 'no_date', label: 'No start date' },
            ]}
            isSelected={(id) => isItemActive('start_date', id)}
            onSelectOption={(id) => handleToggle('start_date', id)}
          />
        )}

        {/* 14. Due date (Submenu with Search) */}
        {filteredItems.some((i) => i.id === 'due-date') && (
          <DateFilterSubmenu
            icon={Calendar}
            label="Due date"
            hasActive={(filters?.due_date.length ?? (dueDateFilter && dueDateFilter !== 'all' ? 1 : 0)) > 0}
            searchValue={getSubSearch('due-date')}
            onSearchChange={(v) => setSubSearchVal('due-date', v)}
            widthClass="w-52"
            options={[
              { id: 'all', label: 'All Due Dates' },
              { id: 'overdue', label: 'Overdue' },
              { id: 'this_week', label: 'Due this week' },
              { id: 'today', label: 'Due today' },
              { id: 'this_month', label: 'Due this month' },
              { id: 'no_date', label: 'No due date' },
            ]}
            isSelected={(id) => isItemActive('due_date', id)}
            onSelectOption={(id) => handleToggle('due_date', id as DueDateFilterOption)}
          />
        )}

        {/* 15. Created at (Submenu with Search) */}
        {filteredItems.some((i) => i.id === 'created-at') && (
          <DateFilterSubmenu
            icon={Calendar}
            label="Created at"
            hasActive={(filters?.created_at.length ?? 0) > 0}
            searchValue={getSubSearch('created-at')}
            onSearchChange={(v) => setSubSearchVal('created-at', v)}
            options={CREATED_UPDATED_DATE_OPTIONS}
            isSelected={(id) => isItemActive('created_at', id)}
            onSelectOption={(id) => handleToggle('created_at', id)}
          />
        )}

        {/* 16. Updated at (Submenu with Search) */}
        {filteredItems.some((i) => i.id === 'updated-at') && (
          <DateFilterSubmenu
            icon={Calendar}
            label="Updated at"
            hasActive={(filters?.updated_at.length ?? 0) > 0}
            searchValue={getSubSearch('updated-at')}
            onSearchChange={(v) => setSubSearchVal('updated-at', v)}
            options={CREATED_UPDATED_DATE_OPTIONS}
            isSelected={(id) => isItemActive('updated_at', id)}
            onSelectOption={(id) => handleToggle('updated_at', id)}
          />
        )}

        {/* 17. Created by (Submenu with Search & Avatars) */}
        {filteredItems.some((i) => i.id === 'created-by') && (
          <MemberFilterSubmenu
            icon={UserCircle}
            label="Created by"
            hasActive={(filters?.created_by.length ?? 0) > 0}
            searchValue={getSubSearch('created-by')}
            onSearchChange={(v) => setSubSearchVal('created-by', v)}
            users={membersList}
            isSelected={(id) => isItemActive('created_by', id)}
            onSelectUser={(id) => handleToggle('created_by', id)}
            showEmptyMessage
          />
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default FilterDropdown;
