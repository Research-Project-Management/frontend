'use client';

import React, { useState, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import { useParams } from 'next/navigation';
import {
  Check,
  CheckSquare,
  Bug,
  Sparkles,
  TrendingUp,
  Zap,
  Hash,
  X,
  Users,
  Tag,
  ChevronDown,
  Clock,
  CalendarDays,
  Search,
  Paperclip,
} from 'lucide-react';
import {
  Button,
  Input,
  Checkbox,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shared/components/ui";
import { Calendar } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import { ItemHelpers, resolveColumnId } from '../../utils/work-item.utils';
import { useLabelsQuery } from '../../hooks/use-label';
import type {
  Priority,
  Cycle,
  Item,
  Column,
  Label,
} from '../../types/work-item.types';
import {
  PRIORITY_CONFIG,
} from '../../types/work-item.types';

export { PRIORITY_CONFIG };

// ── Universal State Icons (Powered by Shared StatusIcon) ─────────────────────

import {
  StatusIcon,
  BacklogStatusIcon as BacklogStateIcon,
  TodoStatusIcon as TodoStateIcon,
  InProgressStatusIcon as InProgressStateIcon,
  DoneStatusIcon as DoneStateIcon,
  CancelledStatusIcon as CancelledStateIcon,
} from '@/shared/components/icons';

export {
  BacklogStateIcon,
  TodoStateIcon,
  InProgressStateIcon,
  DoneStateIcon,
  CancelledStateIcon,
};

export function StateItemIcon({ col, className }: { col?: Partial<Column> | null; className?: string }) {
  if (!col) return null;
  return (
    <StatusIcon
      id={col.id}
      title={col.title || col.name}
      group={col.group}
      color={col.color || col.accentColor}
      className={cn("size-3.5 shrink-0", className)}
    />
  );
}

// ── Priority Box Icons ───────────────────────────────────────────────────────

import {
  UrgentPriorityBoxIcon,
  HighPriorityBoxIcon,
  MediumPriorityBoxIcon,
  LowPriorityBoxIcon,
  NonePriorityBoxIcon,
  NonePriorityTriggerIcon,
} from "@/shared/components/icons";

export {
  UrgentPriorityBoxIcon,
  HighPriorityBoxIcon,
  MediumPriorityBoxIcon,
  LowPriorityBoxIcon,
  NonePriorityBoxIcon,
  NonePriorityTriggerIcon,
};

export const NonePriorityIcon = NonePriorityTriggerIcon;

export function AssigneeUserIcon({ className }: { className?: string }) {
  return <Users className={cn("size-3.5 shrink-0 text-muted-foreground", className)} />;
}

export function LabelTagIcon({ className }: { className?: string }) {
  return <Tag className={cn("size-3.5 shrink-0 text-muted-foreground", className)} />;
}

export function DateCalendarIcon({ className }: { className?: string }) {
  return <CalendarDays className={cn("size-3.5 shrink-0 text-muted-foreground", className)} />;
}

export function CycleHalfIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={cn("size-3.5 shrink-0 text-muted-foreground", className)}
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 3.8a4.2 4.2 0 0 1 0 8.4V3.8z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export const CycleIcon = CycleHalfIcon;

export function AttachPaperclipIcon({ className }: { className?: string }) {
  return <Paperclip className={cn("size-3.5 shrink-0 text-muted-foreground", className)} />;
}

export function ParentHierarchyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-3.5 shrink-0 text-muted-foreground", className)}
    >
      <rect x="2" y="2.5" width="12" height="4" rx="1" />
      <rect x="9.5" y="9.5" width="4.5" height="4" rx="1" />
      <path d="M4.5 6.5v4a1 1 0 0 0 1 1h2.5" />
      <path d="M6.5 10l1.5 1.5-1.5 1.5" />
    </svg>
  );
}
export const AddParentIcon = ParentHierarchyIcon;

// ── Project Selector Popover ────────────────────────────────────────────────

export interface ProjectSelectorPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: {
    id?: string;
    name?: string;
    identifier?: string;
    emoji?: string | null;
  } | null;
  projects: any[];
  onSelectProject: (project: any) => void;
  disabled?: boolean;
}

export const ProjectSelectorPopover: React.FC<ProjectSelectorPopoverProps> = ({
  open,
  onOpenChange,
  project,
  projects = [],
  onSelectProject,
  disabled = false,
}) => {
  const [search, setSearch] = useState('');

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p: any) =>
      (p.name || p.identifier || '').toLowerCase().includes(q)
    );
  }, [projects, search]);

  const currentId = project?.id;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-normal text-foreground cursor-pointer transition-colors border border-border bg-background hover:bg-background outline-none select-none',
            open && 'bg-muted border-border'
          )}
        >
          <span className="text-sm leading-none">{project?.emoji || '🐥'}</span>
          <span className="text-xs text-foreground tracking-normal font-normal">
            {project?.name || project?.identifier || 'Select Project'}
          </span>
          <ChevronDown className="size-3 text-muted-foreground ml-0.5 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="w-64 p-1.5 rounded-md border border-border bg-popover z-100 flex flex-col"
      >
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-background mb-1">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            autoFocus
          />
        </div>
        <div className="space-y-0.5 max-h-56 overflow-y-auto">
          {filteredProjects.length === 0 ? (
            <div className="py-2.5 text-center text-xs text-muted-foreground">
              No projects found
            </div>
          ) : (
            filteredProjects.map((p: any) => {
              const isSelected = p.id === currentId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onSelectProject(p);
                    onOpenChange(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors hover:bg-muted cursor-pointer text-left',
                    isSelected && 'font-medium'
                  )}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-sm leading-none shrink-0">{p.emoji || '📁'}</span>
                    <span className="truncate text-foreground text-xs">{p.name || p.identifier}</span>
                  </div>
                  {isSelected && <Check className="size-3.5 shrink-0 text-foreground" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// ── 0. State / Column Popover ────────────────────────────────────────────────

export interface StatePopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnId: string;
  setColumnId: (columnId: string) => void;
  columns: Column[];
  actionBtnClass?: string;
  isReadOnly?: boolean;
}

export const StatePopover: React.FC<StatePopoverProps> = ({
  open,
  onOpenChange,
  columnId,
  setColumnId,
  columns = [],
  actionBtnClass,
  isReadOnly = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const activeCol = columns.find(
    (c) =>
      resolveColumnId(c) === columnId ||
      c.id === columnId ||
      c.group === columnId ||
      (c.name && c.name.toLowerCase() === columnId?.toLowerCase()) ||
      (c.title && c.title.toLowerCase() === columnId?.toLowerCase())
  );

  const filteredColumns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return columns;
    return columns.filter((c) => (c.title || c.name || '').toLowerCase().includes(q));
  }, [columns, searchQuery]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild disabled={isReadOnly}>
        <Button
          variant="outline"
          size="sm"
          className={cn(actionBtnClass)}
        >
          <StateItemIcon col={activeCol} />
          <span>{activeCol?.title || activeCol?.name || columnId || 'Backlog'}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-48 p-1.5 rounded-md border border-border bg-popover z-100 flex flex-col"
      >
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background mb-1">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search states..."
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            autoFocus
          />
        </div>
        <div className="space-y-0.5 max-h-56 overflow-y-auto">
          {filteredColumns.length === 0 ? (
            <div className="py-2.5 text-center text-xs text-muted-foreground">
              No states found
            </div>
          ) : (
            filteredColumns.map((col) => {
              const cId = resolveColumnId(col);
              const isCurrent = columnId === cId;
              return (
                <button
                  key={cId}
                  type="button"
                  onClick={() => {
                    setColumnId(cId);
                    onOpenChange(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors hover:bg-muted cursor-pointer text-left',
                    isCurrent && 'bg-muted text-foreground font-medium'
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <StateItemIcon col={col} />
                    <span className="truncate">{col.title || col.name}</span>
                  </div>
                  {isCurrent && <Check className="size-4 shrink-0 text-foreground" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// ── 1. Priority Popover ──────────────────────────────────────────────────────

export interface PriorityPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priority: Priority;
  setPriority: (priority: Priority) => void;
  actionBtnClass?: string;
  isReadOnly?: boolean;
  defaultLabel?: string;
}

const PRIORITY_OPTIONS: { id: Priority; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'urgent', label: 'Urgent', icon: UrgentPriorityBoxIcon },
  { id: 'high', label: 'High', icon: HighPriorityBoxIcon },
  { id: 'medium', label: 'Medium', icon: MediumPriorityBoxIcon },
  { id: 'low', label: 'Low', icon: LowPriorityBoxIcon },
  { id: 'none', label: 'None', icon: NonePriorityBoxIcon },
];

export const PriorityPopover: React.FC<PriorityPopoverProps> = ({
  open,
  onOpenChange,
  priority,
  setPriority,
  actionBtnClass,
  isReadOnly = false,
  defaultLabel,
}) => {
  const currentKey = priority || 'none';
  const currentOption = PRIORITY_OPTIONS.find((o) => o.id === currentKey) || PRIORITY_OPTIONS[4];
  const TriggerIcon = currentKey === 'none' ? NonePriorityTriggerIcon : currentOption.icon;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild disabled={isReadOnly}>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-7 px-2.5 text-xs font-normal rounded-md border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer transition-colors shadow-none shrink-0',
            actionBtnClass
          )}
        >
          <TriggerIcon />
          <span>{priority && priority !== 'none' ? currentOption.label : (defaultLabel || 'None')}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-36 p-1 rounded-md border border-border bg-popover z-100 flex flex-col space-y-0.5"
      >
        {PRIORITY_OPTIONS.map((opt) => {
          const isSelected = currentKey === opt.id;
          const IconComponent = opt.icon;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setPriority(opt.id);
                onOpenChange(false);
              }}
              className={cn(
                'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors hover:bg-muted cursor-pointer text-left',
                isSelected && 'bg-muted text-foreground font-medium'
              )}
            >
              <div className="flex items-center gap-2 truncate">
                <IconComponent />
                <span className="truncate">{opt.label}</span>
              </div>
              {isSelected && <Check className="size-4 shrink-0 text-foreground" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
};

// ── 2. Work Item Type Popover ─────────────────────────────────────────────

// ── 4. Avatar Stack & Member Popover ──────────────────────────────────────────

export function AvatarStack({
  users,
  max = 3,
  size = 'sm',
  className,
}: {
  users: Array<{ id?: string; name?: string | null; avatar?: string | null }>;
  max?: number;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}) {
  if (!users || users.length === 0) return null;

  const sizeClass = size === 'xs' ? 'size-4 text-9' : size === 'md' ? 'size-6 text-11' : 'size-5 text-10';

  const visible = users.slice(0, max);
  const remaining = users.length - max;

  return (
    <div className={cn("flex items-center -space-x-1.5 overflow-hidden", className)}>
      {visible.map((u, i) => {
        const name = u.name || 'Member';
        const initials = ItemHelpers.getInitials(name);
        return (
          <Avatar
            key={u.id || i}
            className={cn(sizeClass, "ring-1.5 ring-background shrink-0 select-none")}
            title={name}
          >
            <AvatarImage src={u.avatar || undefined} alt={name} />
            <AvatarFallback className="bg-muted font-medium text-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        );
      })}
      {remaining > 0 && (
        <span
          className={cn(
            sizeClass,
            "flex items-center justify-center rounded-full bg-muted text-muted-foreground font-mono font-medium ring-1.5 ring-background shrink-0 select-none",
          )}
          title={`${remaining} more members`}
        >
          +{remaining}
        </span>
      )}
    </div>
  );
}

export interface MemberPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assigneeId?: string | null;
  setAssigneeId?: (id: string | null) => void;
  assigneeIds?: string[];
  setAssigneeIds?: (ids: string[]) => void;
  members: any[];
  actionBtnClass?: string;
  triggerLabel?: string;
  isMulti?: boolean;
  disabled?: boolean;
  isReadOnly?: boolean;
}

export function MemberPopover({
  open,
  onOpenChange,
  assigneeId,
  setAssigneeId,
  assigneeIds,
  setAssigneeIds,
  members,
  actionBtnClass,
  triggerLabel = 'Assignees',
  isMulti = false,
  disabled = false,
  isReadOnly = false,
}: MemberPopoverProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const activeIds = useMemo<string[]>(() => {
    if (assigneeIds && Array.isArray(assigneeIds)) return assigneeIds;
    if (assigneeId) return [assigneeId];
    return [];
  }, [assigneeIds, assigneeId]);

  const selectedMembers = useMemo(() => {
    return activeIds
      .map((id) => {
        const m = (members as any[]).find(
          (mem: any) => (mem.user?.id || mem.userId || mem.id) === id
        );
        return m
          ? {
              id,
              name: m.user?.name || m.name || 'Member',
              avatar: m.user?.avatar || m.avatar,
            }
          : null;
      })
      .filter(Boolean) as Array<{ id: string; name: string; avatar?: string | null }>;
  }, [activeIds, members]);

  const filteredMembers = useMemo(() => {
    return members.filter((member: any) => {
      const name = member.user?.name || member.name || '';
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [members, searchQuery]);

  const handleToggleMember = (memberUserId: string) => {
    const isCurrentlySelected = activeIds.includes(memberUserId);
    if (isMulti || setAssigneeIds) {
      const nextIds = isCurrentlySelected
        ? activeIds.filter((id) => id !== memberUserId)
        : [...activeIds, memberUserId];
      setAssigneeIds?.(nextIds);
      if (setAssigneeId) {
        setAssigneeId(nextIds[0] ?? null);
      }
    } else {
      setAssigneeId?.(isCurrentlySelected ? null : memberUserId);
      onOpenChange(false);
    }
  };

  const handleClearAll = () => {
    setAssigneeIds?.([]);
    setAssigneeId?.(null);
    if (!isMulti && !setAssigneeIds) {
      onOpenChange(false);
    }
  };

  const isDisabled = disabled || isReadOnly;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild disabled={isDisabled}>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-7 px-2.5 text-xs font-medium rounded-md border border-border bg-muted hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer transition-colors shadow-none shrink-0',
            actionBtnClass,
            open && 'bg-muted border-border',
            selectedMembers.length > 0 && 'font-medium'
          )}
        >
          {selectedMembers.length > 1 ? (
            <div className="flex items-center gap-1.5">
              <AvatarStack users={selectedMembers} size="xs" max={3} />
              <span className="text-11 text-muted-foreground">{selectedMembers.length} assignees</span>
            </div>
          ) : selectedMembers.length === 1 ? (
            <>
              <Avatar className="size-3.5 shrink-0">
                <AvatarImage src={selectedMembers[0].avatar || undefined} />
                <AvatarFallback className="text-9">
                  {selectedMembers[0].name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate max-w-[100px]">{selectedMembers[0].name}</span>
            </>
          ) : (
            <>
              <AssigneeUserIcon />
              <span>{triggerLabel}</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="w-64 p-1.5 rounded-md border border-border bg-popover z-100 flex flex-col"
      >
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background mb-1">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search members..."
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            autoFocus
          />
        </div>
        <div className="space-y-0.5 max-h-56 overflow-y-auto">
          {activeIds.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors hover:bg-muted cursor-pointer text-left text-muted-foreground hover:text-foreground"
            >
              <span>Unassign all</span>
            </button>
          )}
          {filteredMembers.length === 0 ? (
            <div className="py-2.5 text-center text-xs text-muted-foreground">
              No members found
            </div>
          ) : (
            filteredMembers.map((member: any) => {
              const memberUserId = member.user?.id || member.userId || member.id;
              const userName = member.user?.name || member.name || 'Member';
              const userAvatar = member.user?.avatar || member.avatar;
              const fallbackInitials = userName.charAt(0).toUpperCase();
              const isSelected = activeIds.includes(memberUserId);

              return (
                <button
                  key={memberUserId}
                  type="button"
                  onClick={() => handleToggleMember(memberUserId)}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors hover:bg-muted cursor-pointer text-left',
                    isSelected && 'bg-muted text-foreground font-medium'
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Avatar className="size-5 shrink-0">
                      <AvatarImage src={userAvatar || undefined} />
                      <AvatarFallback className="text-10 font-medium">{fallbackInitials}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{userName}</span>
                  </div>
                  {isSelected && <Check className="size-4 shrink-0 text-foreground" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── 5. Label Popover ─────────────────────────────────────────────────────────

export interface LabelPopoverProps {
  labels: string[];
  setLabels: Dispatch<SetStateAction<string[]>>;
  actionBtnClass?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  isReadOnly?: boolean;
}

export function LabelPopover({
  labels,
  setLabels,
  actionBtnClass,
  open,
  onOpenChange,
  disabled = false,
  isReadOnly = false,
}: LabelPopoverProps) {
  const { projectId } = useParams() as { projectId?: string };
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalOpen;
  const setIsOpen = onOpenChange !== undefined ? onOpenChange : setInternalOpen;
  const [labelSearch, setLabelSearch] = useState('');

  const { data: rawLabels } = useLabelsQuery(projectId, 'work-item');

  const labelList: Label[] = useMemo(() => {
    if (Array.isArray(rawLabels)) return rawLabels;
    if (Array.isArray((rawLabels as any)?.labels)) return (rawLabels as any).labels;
    return [];
  }, [rawLabels]);

  const filteredLabels = useMemo(() => {
    const q = labelSearch.trim().toLowerCase();
    if (!q) return labelList;
    return labelList.filter((l) => (l.name || '').toLowerCase().includes(q));
  }, [labelList, labelSearch]);

  const toggleLabel = (labelId: string) => {
    setLabels((prev) =>
      prev.includes(labelId) ? prev.filter((id) => id !== labelId) : [...prev, labelId]
    );
  };

  const isDisabled = disabled || isReadOnly;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild disabled={isDisabled}>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-7 px-2.5 text-xs font-normal rounded-md border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer transition-colors shadow-none shrink-0',
            actionBtnClass,
            isOpen && 'bg-muted border-border',
            labels.length > 0 && 'font-medium'
          )}
        >
          <LabelTagIcon />
          <span>{labels.length > 0 ? `Labels (${labels.length})` : 'Labels'}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="w-56 p-1.5 rounded-md border border-border bg-popover z-100 flex flex-col"
      >
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background mb-1">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input
            placeholder="Search labels..."
            value={labelSearch}
            onChange={(e) => setLabelSearch(e.target.value)}
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            autoFocus
          />
        </div>
        <div className="space-y-0.5 max-h-56 overflow-y-auto">
          {filteredLabels.length === 0 ? (
            <div className="py-2.5 text-center text-xs text-muted-foreground">
              No labels found
            </div>
          ) : (
            filteredLabels.map((label) => {
              const isSelected = labels.includes(label.id);
              return (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => toggleLabel(label.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors hover:bg-muted cursor-pointer text-left',
                    isSelected && 'bg-muted text-foreground font-medium'
                  )}
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: label.color || '#3B82F6' }}
                    />
                    <span className="truncate text-foreground">{label.name}</span>
                  </div>
                  {isSelected && <Check className="size-4 shrink-0 text-foreground" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── 6. Date Popover ──────────────────────────────────────────────────────────

export interface DatePopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startDate: string | null;
  dueDate: string | null;
  onApplyDates: (payload: {
    startDate: string | null;
    dueDate: string | null;
  }) => void;
  actionBtnClass?: string;
}

export function DatePopover({
  open,
  onOpenChange,
  startDate,
  dueDate,
  onApplyDates,
  actionBtnClass,
}: DatePopoverProps) {
  const [selectedRange, setSelectedRange] = useState<{
    from: Date | undefined;
    to?: Date | undefined;
  }>({
    from: startDate ? new Date(startDate) : undefined,
    to: dueDate ? new Date(dueDate) : undefined,
  });

  const [hasStartDate, setHasStartDate] = useState(Boolean(startDate));
  const [hasDueDate, setHasDueDate] = useState(Boolean(dueDate));

  useEffect(() => {
    if (open) {
      setSelectedRange({
        from: startDate ? new Date(startDate) : undefined,
        to: dueDate ? new Date(dueDate) : undefined,
      });
      setHasStartDate(Boolean(startDate));
      setHasDueDate(Boolean(dueDate));
    }
  }, [open, startDate, dueDate]);

  const setQuickDue = (daysFromNow: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysFromNow);
    setSelectedRange((prev) => ({
      from: prev.from || new Date(),
      to: target,
    }));
    setHasDueDate(true);
  };

  const handleSave = () => {
    let finalStart: string | null = null;
    let finalDue: string | null = null;

    if (hasStartDate && selectedRange.from) {
      finalStart = selectedRange.from.toISOString();
    }
    if (hasDueDate && (selectedRange.to || selectedRange.from)) {
      const targetDate = selectedRange.to || selectedRange.from;
      finalDue = targetDate ? targetDate.toISOString() : null;
    }

    onApplyDates({
      startDate: finalStart,
      dueDate: finalDue,
    });
    onOpenChange(false);
  };

  const handleRemove = () => {
    onApplyDates({
      startDate: null,
      dueDate: null,
    });
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-7 px-2.5 text-xs font-medium rounded-md border border-border bg-muted hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer transition-colors shadow-none shrink-0',
            actionBtnClass,
            open && 'bg-muted border-border'
          )}
        >
          <Clock className="size-3.5 shrink-0 text-muted-foreground" />
          <span>Dates</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        collisionPadding={16}
        className="w-[520px] p-0 rounded-md border border-border overflow-hidden flex flex-col z-100 bg-popover"
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0 bg-popover">
          <div className="flex items-center gap-2">
            <Clock className="size-3.5 shrink-0 text-primary" />
            <span className="text-xs font-semibold text-foreground">Dates & Deadlines</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-foreground hover:bg-muted cursor-pointer rounded-md"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-3.5 shrink-0" />
          </Button>
        </div>

        <div className="flex divide-x divide-border min-h-0 bg-background">
          <div className="p-3 flex items-center justify-center shrink-0">
            <Calendar
              mode="range"
              selected={selectedRange as any}
              onSelect={(range: any) => {
                setSelectedRange(range || { from: undefined });
                if (range?.from) setHasStartDate(true);
                if (range?.to) setHasDueDate(true);
              }}
              className="p-0 text-xs shrink-0"
            />
          </div>

          <div className="flex-1 p-3.5 space-y-3 flex flex-col justify-between overflow-y-auto max-h-[300px]">
            <div className="space-y-1.5">
              <span className="text-10 font-medium text-muted-foreground tracking-normal">Quick Select</span>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickDue(0)}
                  className="h-7 text-11 font-medium justify-start px-2 bg-muted hover:bg-muted cursor-pointer rounded-md shadow-none"
                >
                  Today
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickDue(1)}
                  className="h-7 text-11 font-medium justify-start px-2 bg-muted hover:bg-muted cursor-pointer rounded-md shadow-none"
                >
                  Tomorrow
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickDue(7)}
                  className="h-7 text-11 font-medium justify-start px-2 bg-muted hover:bg-muted cursor-pointer rounded-md shadow-none"
                >
                  Next week
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickDue(14)}
                  className="h-7 text-11 font-medium justify-start px-2 bg-muted hover:bg-muted cursor-pointer rounded-md shadow-none"
                >
                  In 2 weeks
                </Button>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={hasStartDate}
                  onCheckedChange={(checked) => setHasStartDate(Boolean(checked))}
                  id="start-date-cb"
                />
                <label htmlFor="start-date-cb" className="text-xs font-medium text-foreground flex-1 cursor-pointer">
                  Start date
                </label>
                <Input
                  readOnly
                  value={selectedRange.from ? selectedRange.from.toLocaleDateString() : 'M/D/YYYY'}
                  className="h-7 w-24 text-11 text-center px-1 font-mono rounded-md border-border"
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={hasDueDate}
                  onCheckedChange={(checked) => setHasDueDate(Boolean(checked))}
                  id="due-date-cb"
                />
                <label htmlFor="due-date-cb" className="text-xs font-medium text-foreground flex-1 cursor-pointer">
                  Due date
                </label>
                <Input
                  readOnly
                  value={
                    selectedRange.to
                      ? selectedRange.to.toLocaleDateString()
                      : selectedRange.from
                      ? selectedRange.from.toLocaleDateString()
                      : 'M/D/YYYY'
                  }
                  className="h-7 w-24 text-11 text-center px-1 font-mono rounded-md border-border"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="px-3.5 py-2.5 border-t border-border shrink-0 flex items-center justify-between gap-2 bg-popover">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRemove}
            className="h-7 text-xs text-muted-foreground hover:text-destructive cursor-pointer px-2.5 rounded-md"
          >
            Clear
          </Button>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-7 text-xs px-3 cursor-pointer rounded-md shadow-none"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="h-7 text-xs font-semibold px-4 cursor-pointer rounded-md shadow-none"
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── 7. Single Date Popover ───────────────────────────────────────────────────

export interface SingleDatePopoverProps {
  label: string;
  date: string;
  onSelectDate: (dateString: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionBtnClass?: string;
  variant?: 'outline' | 'ghost' | 'default' | 'secondary';
  disabled?: boolean;
  isReadOnly?: boolean;
}

export function SingleDatePopover({
  label,
  date,
  onSelectDate,
  open,
  onOpenChange,
  actionBtnClass,
  variant = 'outline',
  disabled = false,
  isReadOnly = false,
}: SingleDatePopoverProps) {
  const selectedDate = date ? new Date(date) : undefined;

  const formattedLabel =
    selectedDate && !Number.isNaN(selectedDate.getTime())
      ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(selectedDate)
      : label;

  const isDisabled = disabled || isReadOnly;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild disabled={isDisabled}>
        <Button
          variant={variant}
          size="sm"
          className={cn(
            variant === 'ghost'
              ? 'h-7 px-2 text-xs font-normal rounded-md bg-transparent hover:bg-muted/50 text-foreground flex items-center gap-1.5 cursor-pointer transition-colors shadow-none shrink-0 border-0'
              : 'h-7 px-2.5 text-xs font-medium rounded-md border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer transition-colors shadow-none shrink-0',
            actionBtnClass,
            open && (variant === 'ghost' ? 'bg-muted/60' : 'bg-muted border-border'),
            date && 'text-foreground font-semibold'
          )}
        >
          <DateCalendarIcon />
          <span className={cn(date && 'font-mono tabular-nums')}>{formattedLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-auto p-0 rounded-md border border-border flex flex-col z-100 bg-popover"
      >
        <div className="p-2 bg-background">
          <Calendar className="shrink-0"
            mode="single"
            selected={selectedDate}
            onSelect={(selectedDay) => {
              if (selectedDay) {
                const year = selectedDay.getFullYear();
                const month = String(selectedDay.getMonth() + 1).padStart(2, '0');
                const day = String(selectedDay.getDate()).padStart(2, '0');
                onSelectDate(`${year}-${month}-${day}`);
              } else {
                onSelectDate('');
              }
              onOpenChange(false);
            }}
          />
        </div>
        {date && (
          <div className="px-2 py-1.5 border-t border-border flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-11 text-muted-foreground hover:text-destructive cursor-pointer rounded-sm"
              onClick={() => {
                onSelectDate('');
                onOpenChange(false);
              }}
            >
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── 8. Cycle Popover ─────────────────────────────────────────────────────────

export interface CyclePopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycleId?: string | null;
  setCycleId: (cycleId: string | null) => void;
  cycles?: Cycle[];
  actionBtnClass?: string;
  isReadOnly?: boolean;
}

export const CyclePopover: React.FC<CyclePopoverProps> = ({
  open,
  onOpenChange,
  cycleId,
  setCycleId,
  cycles = [],
  actionBtnClass,
  isReadOnly = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const selectedCycle = useMemo(() => {
    if (!cycleId) return null;
    return cycles.find((c) => c.id === cycleId) || null;
  }, [cycleId, cycles]);

  const filteredCycles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return cycles;
    return cycles.filter((c) => (c.name || '').toLowerCase().includes(q));
  }, [cycles, searchQuery]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild disabled={isReadOnly}>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-7 px-2.5 text-xs font-normal rounded-md border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer transition-colors shadow-none shrink-0',
            actionBtnClass,
            open && 'bg-muted border-border',
            selectedCycle && 'font-medium'
          )}
        >
          <CycleHalfIcon className={selectedCycle ? "text-emerald-500" : undefined} />
          <span className="truncate max-w-[110px]">
            {selectedCycle ? selectedCycle.name : 'Cycle'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-52 p-1.5 rounded-md border border-border flex flex-col z-100 bg-popover max-h-64"
      >
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background mb-1">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cycles..."
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            autoFocus
          />
        </div>
        <div className="space-y-0.5 overflow-y-auto max-h-48">
          {/* No cycle option */}
          <button
            type="button"
            onClick={() => {
              setCycleId(null);
              onOpenChange(false);
            }}
            className={cn(
              'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors hover:bg-muted cursor-pointer text-left',
              !cycleId && 'bg-muted text-foreground font-medium'
            )}
          >
            <div className="flex items-center gap-2">
              <CycleHalfIcon />
              <span>No cycle</span>
            </div>
            {!cycleId && <Check className="size-4 shrink-0 text-foreground" />}
          </button>

          {filteredCycles.map((c) => {
            const isSelected = cycleId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCycleId(c.id);
                  onOpenChange(false);
                }}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors hover:bg-muted cursor-pointer text-left',
                  isSelected && 'bg-muted text-foreground font-medium'
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <CycleHalfIcon />
                  <span className="truncate">{c.name}</span>
                  {c.status === 'active' && (
                    <span className="text-10 px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-normal">
                      Active
                    </span>
                  )}
                </div>
                {isSelected && <Check className="size-4 shrink-0 text-foreground" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// ── 9. Parent Item Popover ───────────────────────────────────────────────────

export interface ParentItemPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId?: string | null;
  setParentId: (parentId: string | null) => void;
  items?: Item[];
  actionBtnClass?: string;
  isReadOnly?: boolean;
}

export const ParentItemPopover: React.FC<ParentItemPopoverProps> = ({
  open,
  onOpenChange,
  parentId,
  setParentId,
  items = [],
  actionBtnClass,
  isReadOnly = false,
}) => {
  const [query, setQuery] = useState('');

  const selectedParent = useMemo(() => {
    if (!parentId) return null;
    return items.find((item) => item.id === parentId) || null;
  }, [parentId, items]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 30);
    return items
      .filter((item) => {
        const titleMatch = item.title?.toLowerCase().includes(q);
        const identMatch = item.identifier?.toLowerCase().includes(q);
        return Boolean(titleMatch || identMatch);
      })
      .slice(0, 30);
  }, [items, query]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild disabled={isReadOnly}>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-7 px-2.5 text-xs font-normal rounded-md border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer transition-colors shadow-none shrink-0',
            actionBtnClass,
            open && 'bg-muted border-border',
            selectedParent && 'font-medium'
          )}
        >
          <ParentHierarchyIcon />
          <span className="truncate max-w-[120px]">
            {selectedParent ? selectedParent.identifier || selectedParent.title : 'Add parent'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="w-64 p-1.5 rounded-md border border-border bg-popover z-100 flex flex-col"
      >
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-background mb-1">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search work items..."
            className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            autoFocus
          />
        </div>
        <div className="space-y-0.5 max-h-56 overflow-y-auto">
          {parentId && (
            <button
              type="button"
              onClick={() => {
                setParentId(null);
                onOpenChange(false);
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors hover:bg-muted cursor-pointer text-left text-muted-foreground hover:text-foreground"
            >
              <span>Remove parent</span>
            </button>
          )}
          {filteredItems.length === 0 ? (
            <div className="py-2.5 text-center text-xs text-muted-foreground">
              No work items found
            </div>
          ) : (
            filteredItems.map((item) => {
              const isSelected = parentId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setParentId(isSelected ? null : item.id);
                    onOpenChange(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors hover:bg-muted cursor-pointer text-left gap-2',
                    isSelected && 'bg-muted text-foreground font-medium'
                  )}
                >
                  <div className="flex items-center gap-1.5 truncate min-w-0">
                    {item.identifier && (
                      <span className="text-10 font-mono text-muted-foreground shrink-0">
                        {item.identifier}
                      </span>
                    )}
                    <span className="truncate text-foreground">{item.title}</span>
                  </div>
                  {isSelected && <Check className="size-4 shrink-0 text-foreground" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

