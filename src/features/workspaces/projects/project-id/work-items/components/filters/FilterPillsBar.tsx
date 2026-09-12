'use client';

import React from 'react';
import {
  X,
  RotateCcw,
  Users,
  AtSign,
  Tag,
  Paperclip,
  CalendarClock,
  Calendar,
  UserCircle,
  User,
  Check,
  FileText,
  BookOpen,
  Link2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/shared/components/ui";
import {
  resolveStateId,
  resolveStateColor,
  type Column,
  type Task,
  type TaskPriority,
  type DueDateFilterOption,
  type Cycle,
  type Filters,
  PRIORITY_CONFIG,
  STATE_GROUP_CONFIG,
} from '../../types/types';
import type { AssigneeFilterOption } from '../../hooks/use-topbar';
import {
  TextLinesIcon,
  TasksIcon,
  ParentBranchIcon,
  CycleContrastIcon,
  StateBacklogIcon,
  StateTodoIcon,
  StateInProgressIcon,
  StateDoneIcon,
  StateGroupCancelledIcon,
  PriorityUrgentIcon,
  PriorityHighIcon,
  PriorityMediumIcon,
  PriorityLowIcon,
  PriorityNoneIcon,
} from './FilterDropdown';

export interface FilterPillsBarProps {
  columns: Column[];
  assignees: AssigneeFilterOption[];
  cycles?: Cycle[];
  tasks?: Task[];
  totalFiltersCount: number;
  onClearAll: () => void;
  // Unified Filter State
  filters?: Filters;
  onRemoveFilter?: <K extends keyof Filters>(key: K, item?: any) => void;
  onToggleFilter?: <K extends keyof Filters>(key: K, item: any) => void;
  // Legacy props
  selectedColumnIds?: string[];
  onRemoveColumn?: (colId: string) => void;
  selectedAssigneeIds?: string[];
  onRemoveAssignee?: (userId: string) => void;
  selectedPriorities?: TaskPriority[];
  onRemovePriority?: (priority: TaskPriority) => void;
  dueDateFilter?: DueDateFilterOption;
  onRemoveDueDate?: () => void;
}

const DUE_DATE_LABELS: Record<string, string> = {
  all: 'All',
  overdue: 'Overdue',
  today: 'Due today',
  this_week: 'Due this week',
  this_month: 'Due this month',
  '15_days': 'Due in 15 days',
  '30_days': 'Due in 30 days',
  no_date: 'No due date',
};

const DUE_DATE_QUICK_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Due today' },
  { id: 'this_week', label: 'Due this week' },
  { id: 'this_month', label: 'Due this month' },
  { id: '15_days', label: '15 days from now' },
  { id: '30_days', label: '30 days from now' },
  { id: 'no_date', label: 'No due date' },
];

export function FilterPillsBar({
  columns,
  assignees,
  cycles = [],
  tasks = [],
  totalFiltersCount,
  onClearAll,
  filters,
  onRemoveFilter,
  onToggleFilter,
  selectedColumnIds = [],
  onRemoveColumn,
  selectedAssigneeIds = [],
  onRemoveAssignee,
  selectedPriorities = [],
  onRemovePriority,
  dueDateFilter = 'all',
  onRemoveDueDate,
}: FilterPillsBarProps) {
  if (totalFiltersCount === 0) return null;

  // Active state lists with backward compatibility
  const activeStates = filters ? filters.state : selectedColumnIds;
  const activeStateGroups = filters ? filters.state_group : [];
  const activePriorities = filters ? filters.priority : selectedPriorities;
  const activeAssignees = filters ? filters.assignees : selectedAssigneeIds;
  const activeMentions = filters ? filters.mentions : [];
  const activeCreatedBy = filters ? filters.created_by : [];
  const activeLabels = filters ? filters.labels : [];
  const activeCycles = filters ? filters.cycle : [];
  const activeAttach = filters ? filters.attach : [];
  const activeTasks = filters ? [...(filters.tasks || []), ...(filters.work_items || [])] : [];
  const activeParents = filters ? filters.parent : [];
  const activeDueDates = filters ? filters.due_date : (dueDateFilter !== 'all' ? [dueDateFilter] : []);
  const activeStartDates = filters ? filters.start_date : [];
  const activeCreatedAt = filters ? filters.created_at : [];
  const activeUpdatedAt = filters ? filters.updated_at : [];
  const activeSearch = filters?.search || '';

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border bg-background text-xs text-foreground overflow-x-auto select-none shrink-0 min-h-9">
      {/* Active Filter Chips */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto py-0.5">
        {/* 1. Search Query Pill */}
        {activeSearch && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 h-7 rounded-md bg-background border border-border text-12 text-foreground shadow-2xs shrink-0 select-none">
            <TextLinesIcon className="size-3 text-muted-foreground shrink-0" />
            <span className="truncate max-w-44 font-medium">&quot;{activeSearch}&quot;</span>
            <button
              type="button"
              onClick={() => onRemoveFilter?.('search')}
              className="text-muted-foreground hover:text-foreground cursor-pointer rounded-xs p-0.5 transition-colors"
              aria-label="Remove search filter"
            >
              <X className="size-3 shrink-0" />
            </button>
          </span>
        )}

        {activeStates.map((colId) => {
          const col = columns.find((c) => resolveStateId(c) === colId);
          const title = col?.title || colId;
          const color = col ? resolveStateColor(colId, col.accentColor) : 'currentColor';
          const lower = title.toLowerCase();

          let StateIcon = <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />;
          if (lower.includes('progress')) {
            StateIcon = <StateInProgressIcon className="size-3 shrink-0" />;
          } else if (lower.includes('done') || lower.includes('complete')) {
            StateIcon = <StateDoneIcon className="size-3 shrink-0" />;
          } else if (lower.includes('backlog')) {
            StateIcon = <StateBacklogIcon className="size-3 shrink-0" />;
          }

          return (
            <span
              key={`state-${colId}`}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 h-7 rounded-md bg-background border border-border text-12 text-foreground shadow-2xs shrink-0 select-none"
            >
              {StateIcon}
              <span className="truncate max-w-40 font-medium">{title}</span>
              <button
                type="button"
                onClick={() => {
                  if (onRemoveFilter) onRemoveFilter('state', colId);
                  else onRemoveColumn?.(colId);
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer rounded-xs p-0.5 transition-colors"
                aria-label={`Remove ${title} filter`}
              >
                <X className="size-3 shrink-0" />
              </button>
            </span>
          );
        })}

        {/* 3. State Group Pills */}
        {activeStateGroups.map((group) => {
          const config = STATE_GROUP_CONFIG[group];
          const label = config?.label || group;

          let GroupIcon = <StateTodoIcon className="size-3 shrink-0" />;
          if (group === 'backlog') GroupIcon = <StateBacklogIcon className="size-3 shrink-0" />;
          else if (group === 'started') GroupIcon = <StateInProgressIcon className="size-3 shrink-0" />;
          else if (group === 'completed') GroupIcon = <StateDoneIcon className="size-3 shrink-0" />;
          else if (group === 'cancelled') GroupIcon = <StateGroupCancelledIcon className="size-3 shrink-0" />;

          return (
            <span
              key={`group-${group}`}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 h-7 rounded-md bg-background border border-border text-12 text-foreground shadow-2xs shrink-0 select-none"
            >
              {GroupIcon}
              <span className="truncate max-w-40 font-medium">{label}</span>
              <button
                type="button"
                onClick={() => onRemoveFilter?.('state_group', group)}
                className="text-muted-foreground hover:text-foreground cursor-pointer rounded-xs p-0.5 transition-colors"
                aria-label={`Remove ${label} group filter`}
              >
                <X className="size-3 shrink-0" />
              </button>
            </span>
          );
        })}

        {/* 4. Priority Pills (Matching screenshot: [ (gray slash circle) None | x ]) */}
        {activePriorities.map((priority) => {
          const config = PRIORITY_CONFIG[priority];
          const label = config?.label || priority;

          let PriorityIcon = <PriorityNoneIcon className="size-3 shrink-0" />;
          if (priority === 'urgent') PriorityIcon = <PriorityUrgentIcon className="size-3 shrink-0" />;
          else if (priority === 'high') PriorityIcon = <PriorityHighIcon className="size-3 shrink-0" />;
          else if (priority === 'medium') PriorityIcon = <PriorityMediumIcon className="size-3 shrink-0" />;
          else if (priority === 'low') PriorityIcon = <PriorityLowIcon className="size-3 shrink-0" />;

          return (
            <span
              key={`priority-${priority}`}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 h-7 rounded-md bg-background border border-border text-12 text-foreground shadow-2xs shrink-0 select-none capitalize"
            >
              {PriorityIcon}
              <span className="truncate max-w-40 font-medium">{label}</span>
              <button
                type="button"
                onClick={() => {
                  if (onRemoveFilter) onRemoveFilter('priority', priority);
                  else onRemovePriority?.(priority);
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer rounded-xs p-0.5 transition-colors"
                aria-label={`Remove priority ${priority} filter`}
              >
                <X className="size-3 shrink-0" />
              </button>
            </span>
          );
        })}

        {/* 5. Assignee Pills */}
        {activeAssignees.map((userId) => {
          const user = assignees.find((u) => u.id === userId);
          const isUnassigned = userId === '__unassigned__' || userId === 'unassigned';
          const name = isUnassigned ? 'Unassigned' : user?.name || 'User';

          return (
            <span
              key={`user-${userId}`}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 h-7 rounded-md bg-background border border-border text-12 text-foreground shadow-2xs shrink-0 select-none"
            >
              {isUnassigned ? (
                <User className="size-3.5 text-muted-foreground shrink-0" />
              ) : user?.avatar ? (
                <Avatar className="size-3.5 shrink-0">
                  <AvatarImage src={user.avatar} />
                  <AvatarFallback className="text-9">
                    {name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="size-3.5 rounded-full bg-muted flex items-center justify-center text-9 font-medium shrink-0">
                  {name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="truncate max-w-40 font-medium">{name}</span>
              <button
                type="button"
                onClick={() => {
                  if (onRemoveFilter) onRemoveFilter('assignees', userId);
                  else onRemoveAssignee?.(userId);
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer rounded-xs p-0.5 transition-colors"
                aria-label={`Remove ${name} filter`}
              >
                <X className="size-3 shrink-0" />
              </button>
            </span>
          );
        })}

        {/* 6. Mentions Pills */}
        {activeMentions.map((m) => {
          const user = assignees.find((u) => u.id === m);
          const name = user?.name || m;
          return (
            <span
              key={`mention-${m}`}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 h-7 rounded-md bg-background border border-border text-12 text-foreground shadow-2xs shrink-0 select-none"
            >
              <AtSign className="size-3 text-muted-foreground shrink-0" />
              <span className="truncate max-w-40 font-medium">{name}</span>
              <button
                type="button"
                onClick={() => onRemoveFilter?.('mentions', m)}
                className="text-muted-foreground hover:text-foreground cursor-pointer rounded-xs p-0.5 transition-colors"
                aria-label={`Remove mention ${name} filter`}
              >
                <X className="size-3 shrink-0" />
              </button>
            </span>
          );
        })}

        {/* 7. Created By Pills */}
        {activeCreatedBy.map((cId) => {
          const user = assignees.find((u) => u.id === cId);
          const name = user?.name || cId;
          return (
            <span
              key={`created-by-${cId}`}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 h-7 rounded-md bg-background border border-border text-12 text-foreground shadow-2xs shrink-0 select-none"
            >
              <UserCircle className="size-3.5 text-muted-foreground shrink-0" />
              <span className="truncate max-w-40 font-medium">{name}</span>
              <button
                type="button"
                onClick={() => onRemoveFilter?.('created_by', cId)}
                className="text-muted-foreground hover:text-foreground cursor-pointer rounded-xs p-0.5 transition-colors"
                aria-label={`Remove creator ${name} filter`}
              >
                <X className="size-3 shrink-0" />
              </button>
            </span>
          );
        })}

        {/* 8. Labels Pills */}
        {activeLabels.map((lbl) => (
          <span
            key={`lbl-${lbl}`}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 h-7 rounded-md bg-background border border-border text-12 text-foreground shadow-2xs shrink-0 select-none"
          >
            <Tag className="size-3 text-muted-foreground shrink-0" />
            <span className="truncate max-w-40 font-medium">{lbl}</span>
            <button
              type="button"
              onClick={() => onRemoveFilter?.('labels', lbl)}
              className="text-muted-foreground hover:text-foreground cursor-pointer rounded-xs p-0.5 transition-colors"
              aria-label={`Remove label ${lbl} filter`}
            >
              <X className="size-3 shrink-0" />
            </button>
          </span>
        ))}

        {/* 9. Cycle Pills */}
        {activeCycles.map((cId) => {
          const isNoCycle = cId === '__no_cycle__';
          const cycle = cycles.find((c) => c.id === cId);
          const name = isNoCycle ? 'No cycle' : cycle?.name || 'Cycle';
          return (
            <span
              key={`cycle-${cId}`}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 h-7 rounded-md bg-background border border-border text-12 text-foreground shadow-2xs shrink-0 select-none"
            >
              <CycleContrastIcon className="size-3 text-primary shrink-0" />
              <span className="truncate max-w-44 font-medium">{name}</span>
              <button
                type="button"
                onClick={() => onRemoveFilter?.('cycle', cId)}
                className="text-muted-foreground hover:text-foreground cursor-pointer rounded-xs p-0.5 transition-colors"
                aria-label={`Remove ${name} filter`}
              >
                <X className="size-3 shrink-0" />
              </button>
            </span>
          );
        })}

        {/* 10. Attach Pills (Academic Research Attachments) */}
        {activeAttach.map((att) => {
          let AttachIcon = <Paperclip className="size-3 text-muted-foreground shrink-0" />;
          let label = 'Has attach';
          if (att === 'pages') {
            AttachIcon = <FileText className="size-3 text-muted-foreground shrink-0" />;
            label = 'Pages';
          } else if (att === 'papers') {
            AttachIcon = <BookOpen className="size-3 text-muted-foreground shrink-0" />;
            label = 'Papers';
          } else if (att === 'files') {
            AttachIcon = <Paperclip className="size-3 text-muted-foreground shrink-0" />;
            label = 'Files';
          } else if (att === 'links') {
            AttachIcon = <Link2 className="size-3 text-muted-foreground shrink-0" />;
            label = 'Links';
          }
          return (
            <span
              key={`attach-${att}`}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 h-7 rounded-md bg-background border border-border text-12 text-foreground shadow-2xs shrink-0 select-none"
            >
              {AttachIcon}
              <span className="truncate max-w-40 font-medium">{label}</span>
              <button
                type="button"
                onClick={() => onRemoveFilter?.('attach', att)}
                className="text-muted-foreground hover:text-foreground cursor-pointer rounded-xs p-0.5 transition-colors"
                aria-label={`Remove ${label} filter`}
              >
                <X className="size-3 shrink-0" />
              </button>
            </span>
          );
        })}

        {/* 11. Tasks Pills */}
        {activeTasks.map((tId) => {
          const task = tasks.find((t) => t.id === tId || t.identifier === tId);
          const label = task?.identifier ? `${task.identifier}: ${task.title}` : task?.title || tId;
          return (
            <span
              key={`task-${tId}`}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 h-7 rounded-md bg-background border border-border text-12 text-foreground shadow-2xs shrink-0 select-none"
            >
              <TasksIcon className="size-3 text-foreground shrink-0" />
              <span className="truncate max-w-44 font-medium">{label}</span>
              <button
                type="button"
                onClick={() => {
                  onRemoveFilter?.('tasks', tId);
                  onRemoveFilter?.('work_items', tId);
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer rounded-xs p-0.5 transition-colors"
                aria-label={`Remove ${label} filter`}
              >
                <X className="size-3 shrink-0" />
              </button>
            </span>
          );
        })}

        {/* 12. Parent Branch Pills */}
        {activeParents.map((pId) => {
          const isNoParent = pId === '__none__';
          const parentTask = tasks.find((t) => t.id === pId || t.identifier === pId);
          const label = isNoParent ? 'No parent' : `Parent: ${parentTask?.identifier || parentTask?.title || pId}`;
          return (
            <span
              key={`parent-${pId}`}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 h-7 rounded-md bg-background border border-border text-12 text-foreground shadow-2xs shrink-0 select-none"
            >
              <ParentBranchIcon className="size-3 text-foreground shrink-0" />
              <span className="truncate max-w-44 font-medium">{label}</span>
              <button
                type="button"
                onClick={() => onRemoveFilter?.('parent', pId)}
                className="text-muted-foreground hover:text-foreground cursor-pointer rounded-xs p-0.5 transition-colors"
                aria-label={`Remove ${label} filter`}
              >
                <X className="size-3 shrink-0" />
              </button>
            </span>
          );
        })}

        {/* 13. Due Date Pills */}
        {activeDueDates.map((d) => {
          const label = DUE_DATE_LABELS[d] || `Due: ${d.replace('_', ' ')}`;
          return (
            <span
              key={`due-${d}`}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 h-7 rounded-md bg-background border border-border text-12 text-foreground shadow-2xs shrink-0 select-none"
            >
              <Calendar className="size-3 text-muted-foreground shrink-0" />
              <span className="truncate max-w-40 font-medium">{label}</span>
              <button
                type="button"
                onClick={() => {
                  if (onRemoveFilter) onRemoveFilter('due_date', d);
                  else onRemoveDueDate?.();
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer rounded-xs p-0.5 transition-colors"
                aria-label={`Remove due date ${label} filter`}
              >
                <X className="size-3 shrink-0" />
              </button>
            </span>
          );
        })}

        {/* 14. Start Date Pills */}
        {activeStartDates.map((s) => {
          const label = `Start: ${s.replace('_', ' ')}`;
          return (
            <span
              key={`start-${s}`}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 h-7 rounded-md bg-background border border-border text-12 text-foreground shadow-2xs shrink-0 select-none"
            >
              <CalendarClock className="size-3 text-muted-foreground shrink-0" />
              <span className="truncate max-w-40 font-medium">{label}</span>
              <button
                type="button"
                onClick={() => onRemoveFilter?.('start_date', s)}
                className="text-muted-foreground hover:text-foreground cursor-pointer rounded-xs p-0.5 transition-colors"
                aria-label={`Remove start date ${label} filter`}
              >
                <X className="size-3 shrink-0" />
              </button>
            </span>
          );
        })}

        {/* 15. Created At Pills */}
        {activeCreatedAt.map((c) => {
          const label = `Created: ${c.replace('_', ' ')}`;
          return (
            <span
              key={`created-${c}`}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 h-7 rounded-md bg-background border border-border text-12 text-foreground shadow-2xs shrink-0 select-none"
            >
              <Calendar className="size-3 text-muted-foreground shrink-0" />
              <span className="truncate max-w-40 font-medium">{label}</span>
              <button
                type="button"
                onClick={() => onRemoveFilter?.('created_at', c)}
                className="text-muted-foreground hover:text-foreground cursor-pointer rounded-xs p-0.5 transition-colors"
                aria-label={`Remove created date ${label} filter`}
              >
                <X className="size-3 shrink-0" />
              </button>
            </span>
          );
        })}

        {/* 16. Updated At Pills */}
        {activeUpdatedAt.map((u) => {
          const label = `Updated: ${u.replace('_', ' ')}`;
          return (
            <span
              key={`updated-${u}`}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 h-7 rounded-md bg-background border border-border text-12 text-foreground shadow-2xs shrink-0 select-none"
            >
              <Calendar className="size-3 text-muted-foreground shrink-0" />
              <span className="truncate max-w-40 font-medium">{label}</span>
              <button
                type="button"
                onClick={() => onRemoveFilter?.('updated_at', u)}
                className="text-muted-foreground hover:text-foreground cursor-pointer rounded-xs p-0.5 transition-colors"
                aria-label={`Remove updated date ${label} filter`}
              >
                <X className="size-3 shrink-0" />
              </button>
            </span>
          );
        })}

        {/* ── Quick Filter Buttons ── */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {/* Quick Due Date Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-7 w-7 rounded-md border border-border bg-background hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
                title="Filter by due date"
                aria-label="Filter by due date"
              >
                <Calendar className="size-3.5 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <div className="px-2 py-1 text-11 font-medium text-muted-foreground">
                Due date
              </div>
              {DUE_DATE_QUICK_OPTIONS.map((opt) => {
                const active = filters?.due_date.includes(opt.id) ?? false;
                return (
                  <DropdownMenuItem
                    key={opt.id}
                    onClick={() => onToggleFilter?.('due_date', opt.id)}
                    className="flex items-center justify-between text-xs cursor-pointer"
                  >
                    <span>{opt.label}</span>
                    {active && <Check className="size-3.5 text-primary shrink-0" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Quick Assignees Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-7 w-6.5 rounded-md border border-border bg-background hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
                title="Filter by assignee"
                aria-label="Filter by assignee"
              >
                <Users className="size-3.5 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 max-h-64 overflow-y-auto">
              <div className="px-2 py-1 text-11 font-medium text-muted-foreground">
                Assignees
              </div>
              {assignees.map((u) => {
                const active = filters?.assignees.includes(u.id) ?? false;
                const isUnassigned = u.id === '__unassigned__' || u.id === 'unassigned';
                return (
                  <DropdownMenuItem
                    key={u.id}
                    onClick={() => onToggleFilter?.('assignees', u.id)}
                    className="flex items-center justify-between text-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isUnassigned ? (
                        <div className="size-4 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <User className="size-3 text-muted-foreground shrink-0" />
                        </div>
                      ) : u.avatar ? (
                        <Avatar className="size-4 shrink-0">
                          <AvatarImage src={u.avatar} />
                          <AvatarFallback className="text-9">{u.name?.slice(0, 1).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="size-4 rounded-full bg-muted flex items-center justify-center text-9 font-medium shrink-0">
                          {u.name?.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <span className="truncate">{u.name}</span>
                    </div>
                    {active && <Check className="size-3.5 text-primary shrink-0" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Clear All Action */}
      <button
        type="button"
        onClick={onClearAll}
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:underline cursor-pointer ml-auto shrink-0 px-1 py-0.5 rounded-md transition-colors"
      >
        <RotateCcw className="size-3 shrink-0" />
        <span>Clear all</span>
      </button>
    </div>
  );
}

export default FilterPillsBar;
