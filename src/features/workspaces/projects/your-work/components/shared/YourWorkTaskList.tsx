'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  CheckSquare,
  Clock3,
  MessageSquare,
  AlertCircle,
  ArrowUp,
  Minus,
  ArrowDown,
  GitBranch,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui';
import { resolveTaskColumnColor } from '@/features/workspaces/projects/project-id/tasks/types/task.types';
import { cn } from '@/shared/lib/utils';
import { getTaskProject, type ProjectMap } from '../../utils/your-work.util';
import type { YourWorkTask } from '../../schemas/your-work.schema';

const COLUMN_NAMES: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  doing: 'Doing',
  review: 'Review',
  done: 'Done',
  cancelled: 'Cancelled',
};

const PRIORITY_BADGES: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  urgent: {
    label: 'Urgent',
    icon: AlertCircle,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/50',
  },
  high: {
    label: 'High',
    icon: ArrowUp,
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/50',
  },
  medium: {
    label: 'Medium',
    icon: Minus,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50',
  },
  low: {
    label: 'Low',
    icon: ArrowDown,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/50',
  },
};

export interface YourWorkTaskListProps {
  title: string;
  tasks: YourWorkTask[] | any[];
  onTaskClick: (taskId: string) => void;
  taskProjectMap?: ProjectMap;
  emptyMessage?: string;
  emptyIcon?: React.ElementType;
  className?: string;
}

export function YourWorkTaskList({
  title,
  tasks = [],
  onTaskClick,
  taskProjectMap = {},
  emptyMessage = 'No work items found.',
  emptyIcon: EmptyIcon = CheckSquare,
  className,
}: YourWorkTaskListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const groups = useMemo(() => {
    const map = new Map<string, any[]>();
    tasks.forEach((task) => {
      const colId = task.columnId || 'todo';
      if (!map.has(colId)) map.set(colId, []);
      map.get(colId)!.push(task);
    });

    const order = ['backlog', 'todo', 'doing', 'review', 'done', 'cancelled'];
    return Array.from(map.entries())
      .sort((a, b) => {
        const indexA = order.indexOf(a[0]);
        const indexB = order.indexOf(b[0]);
        if (indexA === -1 && indexB === -1) return a[0].localeCompare(b[0]);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      })
      .map(([key, items]) => ({
        key,
        label: COLUMN_NAMES[key] || key,
        color: resolveTaskColumnColor(key, '#64748b'),
        items,
      }));
  }, [tasks]);

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between px-1">
        <h2 className="text-foreground font-semibold text-sm tracking-tight">
          {title}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({tasks.length})
          </span>
        </h2>
      </div>

      <div className="space-y-4">
        {groups.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border/80 rounded-lg shadow-2xs">
            <div className="size-10 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-3">
              <EmptyIcon className="size-5 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-xs font-medium italic">
              {emptyMessage}
            </p>
          </div>
        ) : (
          groups.map((group) => {
            const isCollapsed = expandedIds.has(group.key);

            return (
              <div
                key={group.key}
                className="border border-border/80 rounded-lg overflow-hidden bg-card shadow-2xs"
              >
                {/* Group Header */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={!isCollapsed}
                  className="flex items-center gap-2.5 px-4 py-3 bg-muted/30 border-b border-border/60 transition-colors group cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset select-none"
                  onClick={() => toggleExpand(group.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleExpand(group.key);
                    }
                  }}
                >
                  <ChevronRight
                    className={cn(
                      'size-3.5 text-muted-foreground transition-transform duration-200',
                      !isCollapsed && 'rotate-90',
                    )}
                  />
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="text-xs font-bold text-foreground">
                    {group.label}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
                    {group.items.length}
                  </span>
                </div>

                <div
                  className={cn(
                    'divide-y divide-border/60',
                    isCollapsed ? 'hidden' : 'block',
                  )}
                >
                  {group.items.map((task) => {
                    const taskId = task.id || task._id;
                    const projectInfo = getTaskProject(task, taskProjectMap);
                    const isOverdue =
                      task.dueDate &&
                      new Date(task.dueDate) < new Date() &&
                      task.columnId !== 'done';
                    const priorityKey = task.priority || 'none';
                    const priorityConfig = PRIORITY_BADGES[priorityKey];
                    const PriorityIcon = priorityConfig?.icon;
                    const subCount =
                      task.subtaskCount ?? (task.subtasks?.length ?? 0);
                    const subDone =
                      task.subtaskCompletedCount ??
                      (task.subtasks?.filter(
                        (s: any) => s.completed || s.columnId === 'done',
                      ).length ?? 0);

                    const assigneeObj =
                      typeof task.assignee === 'object' ? task.assignee : null;

                    return (
                      <div
                        key={taskId}
                        role="button"
                        tabIndex={0}
                        onClick={() => onTaskClick(taskId)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onTaskClick(taskId);
                          }
                        }}
                        className="w-full flex items-center gap-3.5 px-5 py-3.5 bg-card hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors text-left group cursor-pointer"
                      >
                        <div className="flex-1 min-w-0 flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                          {task.identifier && (
                            <span className="text-[11px] font-bold text-muted-foreground px-1.5 py-0.5 rounded-md bg-muted/80 shrink-0">
                              {task.identifier}
                            </span>
                          )}

                          {priorityConfig && PriorityIcon && (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0',
                                priorityConfig.bg,
                              )}
                            >
                              <PriorityIcon
                                className={cn('size-2.5', priorityConfig.color)}
                              />
                              <span>{priorityConfig.label}</span>
                            </span>
                          )}

                          <span
                            className={cn(
                              'text-xs truncate font-medium text-foreground group-hover:text-primary transition-colors',
                              task.columnId === 'done' &&
                                'text-muted-foreground line-through font-normal',
                            )}
                          >
                            {task.title}
                          </span>

                          {projectInfo && (
                            <span className="inline-flex items-center text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                              {projectInfo.name}
                            </span>
                          )}

                          {subCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md shrink-0">
                              <GitBranch className="size-2.5" />
                              {subDone}/{subCount}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {(task.commentCount ?? 0) > 0 && (
                            <div
                              className="flex items-center gap-1 text-[11px] text-muted-foreground"
                              title="Comments"
                            >
                              <MessageSquare className="size-3" />
                              <span>{task.commentCount}</span>
                            </div>
                          )}

                          {task.dueDate && (
                            <span
                              className={cn(
                                'flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-medium',
                                isOverdue
                                  ? 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/50'
                                  : 'bg-muted text-muted-foreground',
                              )}
                            >
                              <Clock3 className="size-3" />
                              <span>
                                {new Date(task.dueDate).toLocaleDateString(
                                  'en-GB',
                                  { day: 'numeric', month: 'short' },
                                )}
                              </span>
                            </span>
                          )}

                          {assigneeObj && (
                            <Avatar className="size-5.5 rounded-full shrink-0 border border-border">
                              <AvatarImage
                                src={assigneeObj.avatar || undefined}
                                alt={assigneeObj.name || 'Assignee'}
                              />
                              <AvatarFallback className="text-[9px] font-bold bg-muted">
                                {assigneeObj.name?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default YourWorkTaskList;
