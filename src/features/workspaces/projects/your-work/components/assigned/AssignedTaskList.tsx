'use client';

import React, { useState, useMemo } from 'react';
import { ChevronRight, CheckSquare, Clock3, MessageSquare, AlertCircle, ArrowUp, Minus, ArrowDown, GitBranch } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui';
import { resolveTaskColumnColor } from '@/features/workspaces/projects/project-id/tasks';
import { cn } from '@/shared/lib/utils';

const COLUMN_NAMES: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  doing: 'Doing',
  review: 'Review',
  done: 'Done',
  cancelled: 'Cancelled',
};

const PRIORITY_BADGES: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  urgent: { label: 'Urgent', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50 text-red-700 border-red-200' },
  high: { label: 'High', icon: ArrowUp, color: 'text-orange-600', bg: 'bg-orange-50 text-orange-700 border-orange-200' },
  medium: { label: 'Medium', icon: Minus, color: 'text-amber-600', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  low: { label: 'Low', icon: ArrowDown, color: 'text-blue-600', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
};

export interface AssignedTaskListProps {
  tasks: any[];
  onTaskClick: (taskId: string) => void;
  taskProjectMap?: Record<string, { id: string; name: string }>;
}

export function AssignedTaskList({
  tasks,
  onTaskClick,
  taskProjectMap = {},
}: AssignedTaskListProps) {
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
    <div className="space-y-6">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-foreground font-semibold text-sm tracking-tight">
          Work items assigned to you
          <span className="ml-2 text-xs font-normal text-muted-foreground">({tasks.length})</span>
        </h2>
      </div>

      <div className="space-y-4">
        {groups.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border/80 rounded-lg shadow-2xs">
            <div className="size-10 rounded-full bg-muted/60 flex items-center justify-center mx-auto mb-3">
              <CheckSquare className="size-5 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-xs font-medium italic">No work items assigned to you.</p>
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
                  className="flex items-center gap-2.5 px-4 py-3 bg-muted/30 border-b border-border/60 transition-colors group cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleExpand(group.key)}
                >
                  <ChevronRight
                    className={cn('size-3.5 text-muted-foreground transition-transform duration-200', !isCollapsed && 'rotate-90')}
                  />
                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                  <span className="text-xs font-bold text-foreground">{group.label}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground font-semibold">
                    {group.items.length}
                  </span>
                </div>

                <div className={cn('divide-y divide-border/60', isCollapsed ? 'hidden' : 'block')}>
                  {group.items.map((task) => {
                    const projectInfo = taskProjectMap[task.id || task._id];
                    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.columnId !== 'done';
                    const priorityConfig = PRIORITY_BADGES[task.priority];
                    const PriorityIcon = priorityConfig?.icon;
                    const subCount = task.subtaskCount ?? (task.subtasks?.length ?? 0);
                    const subDone = task.subtaskCompletedCount ?? (task.subtasks?.filter((s: any) => s.completed || s.columnId === 'done').length ?? 0);

                    return (
                      <div
                        key={task.id || task._id}
                        onClick={() => onTaskClick(task.id || task._id)}
                        className="w-full flex items-center gap-3.5 px-5 py-3.5 bg-card hover:bg-muted/30 transition-colors text-left group cursor-pointer"
                      >
                        <div className="flex-1 min-w-0 flex items-center gap-2.5">
                          {task.identifier && (
                            <span className="text-[11px] font-bold text-muted-foreground px-1.5 py-0.5 rounded-md bg-muted/80 shrink-0">
                              {task.identifier}
                            </span>
                          )}

                          {priorityConfig && PriorityIcon && (
                            <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0', priorityConfig.bg)}>
                              <PriorityIcon className={cn('size-2.5', priorityConfig.color)} />
                              <span>{priorityConfig.label}</span>
                            </span>
                          )}

                          <span className={cn(
                            'text-xs truncate font-medium text-foreground group-hover:text-primary transition-colors',
                            task.columnId === 'done' && 'text-muted-foreground line-through font-normal'
                          )}>
                            {task.title}
                          </span>

                          {projectInfo && (
                            <span className="inline-flex items-center text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.2 rounded-md uppercase shrink-0">
                              {typeof projectInfo === 'object' ? projectInfo.name : projectInfo}
                            </span>
                          )}

                          {subCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.2 rounded-md shrink-0">
                              <GitBranch className="size-2.5" />
                              {subDone}/{subCount}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {(task.commentCount ?? 0) > 0 && (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground" title="Comments">
                              <MessageSquare className="size-3" />
                              <span>{task.commentCount}</span>
                            </div>
                          )}

                          {task.dueDate && (
                            <span className={cn(
                              'flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md font-medium',
                              isOverdue ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-muted text-muted-foreground'
                            )}>
                              <Clock3 className="size-3" />
                              <span>{new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                            </span>
                          )}

                          {task.assignee && (
                            <Avatar className="size-5.5 rounded-full shrink-0 border border-border">
                              <AvatarImage src={task.assignee.avatar} />
                              <AvatarFallback className="text-[9px] font-bold bg-muted">
                                {task.assignee.name?.charAt(0) || 'U'}
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

export default AssignedTaskList;
