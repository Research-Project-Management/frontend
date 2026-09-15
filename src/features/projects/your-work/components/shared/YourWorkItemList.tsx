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
  Search,
  X,
  CheckCircle2,
  Circle,
  FolderGit2,
  Layers,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage, ProjectAvatar } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import { getWorkItemProject, type ProjectMap } from '../../utils/your-work.util';
import {
  inferStateGroup,
  STATE_GROUP_CONFIG,
  type StateGroup,
} from '../../utils/workload.util';
import type { YourWorkItem } from '../../schemas/your-work.schema';

const PRIORITY_BADGES: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  urgent: {
    label: 'Urgent',
    icon: AlertCircle,
    color: 'text-destructive',
    bg: 'bg-destructive/10 text-destructive',
  },
  high: {
    label: 'High',
    icon: ArrowUp,
    color: 'text-warning',
    bg: 'bg-warning/10 text-warning',
  },
  medium: {
    label: 'Medium',
    icon: Minus,
    color: 'text-warning',
    bg: 'bg-warning/10 text-warning',
  },
  low: {
    label: 'Low',
    icon: ArrowDown,
    color: 'text-primary',
    bg: 'bg-primary/10 text-primary',
  },
};

export interface YourWorkItemListProps {
  title: string;
  workItems?: YourWorkItem[] | any[];
  onWorkItemClick?: (workItemId: string) => void;
  workItemProjectMap?: ProjectMap;
  emptyMessage?: string;
  emptyIcon?: React.ElementType;
  className?: string;
}

export function YourWorkItemList({
  title,
  workItems = [],
  onWorkItemClick,
  workItemProjectMap = {},
  emptyMessage = 'No work items found.',
  emptyIcon: EmptyIcon = CheckSquare,
  className,
}: YourWorkItemListProps) {
  const actualOnClick = onWorkItemClick ?? (() => {});

  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<'state' | 'project'>('state');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filter items by search query
  const filteredWorkItems = useMemo(() => {
    if (!searchQuery.trim()) return workItems;
    const query = searchQuery.toLowerCase().trim();
    return workItems.filter((item) => {
      const titleMatch = (item.title || '').toLowerCase().includes(query);
      const identifierMatch = (item.identifier || '').toLowerCase().includes(query);
      const project = getWorkItemProject(item, workItemProjectMap);
      const projectMatch = project ? project.name.toLowerCase().includes(query) : false;
      return titleMatch || identifierMatch || projectMatch;
    });
  }, [workItems, searchQuery, workItemProjectMap]);

  // Grouping by State Group
  const stateGroups = useMemo(() => {
    const map = new Map<StateGroup, any[]>();
    filteredWorkItems.forEach((item) => {
      let colName = item.columnId;
      const cols = item.project?.workItemColumns;
      if (Array.isArray(cols)) {
        const matched = (cols as Array<Record<string, unknown>>).find(
          (c) => c.id === item.columnId,
        );
        if (matched?.title || matched?.name) {
          colName = String(matched.title || matched.name);
        }
      }
      const group = inferStateGroup(item.columnId, colName);
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(item);
    });

    const order: StateGroup[] = ['backlog', 'unstarted', 'started', 'completed', 'cancelled'];
    return order
      .filter((groupKey) => map.has(groupKey))
      .map((groupKey) => ({
        key: groupKey,
        label: STATE_GROUP_CONFIG[groupKey]?.label || groupKey,
        color: STATE_GROUP_CONFIG[groupKey]?.hex || '#64748b',
        items: map.get(groupKey) || [],
      }));
  }, [filteredWorkItems]);

  // Grouping by Project
  const projectGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        identifier: string | null;
        avatar?: string | null;
        items: any[];
      }
    >();

    filteredWorkItems.forEach((item) => {
      const p = getWorkItemProject(item, workItemProjectMap);
      const pId = p?.id || 'unassigned-project';
      const pName = p?.name || 'No Project';
      const pIdentifier =
        item.project?.identifier ||
        (typeof item.projectId === 'object' && item.projectId !== null
          ? (item.projectId as any).identifier
          : null) ||
        null;
      const pAvatar =
        item.project?.avatar ||
        (typeof item.projectId === 'object' && item.projectId !== null
          ? (item.projectId as any).avatar
          : null) ||
        p?.avatar ||
        null;

      if (!map.has(pId)) {
        map.set(pId, {
          id: pId,
          name: pName,
          identifier: pIdentifier,
          avatar: pAvatar,
          items: [],
        });
      }
      map.get(pId)!.items.push(item);
    });

    return Array.from(map.values()).sort((a, b) => b.items.length - a.items.length);
  }, [filteredWorkItems, workItemProjectMap]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header, Search & GroupBy Control */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-0.5">
        <div className="flex items-center gap-2">
          <h2 className="text-foreground font-semibold text-sm tracking-tight">
            {title}
          </h2>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            ({filteredWorkItems.length}
            {filteredWorkItems.length !== workItems.length && ` of ${workItems.length}`})
          </span>
        </div>

        {workItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Search */}
            <div className="relative w-full sm:w-52">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none shrink-0" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter work items..."
                className="h-8 pl-8 pr-7 text-xs rounded-md bg-muted/40 border-0 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground hover:text-foreground flex items-center justify-center rounded-sm"
                >
                  <X className="size-3 shrink-0" />
                </button>
              )}
            </div>

            {/* Group By Segmented Toggle */}
            <div className="flex items-center rounded-md p-0.5 bg-muted/40">
              <button
                type="button"
                onClick={() => setGroupBy('state')}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs font-medium transition-colors',
                  groupBy === 'state'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                title="Group by State Group"
              >
                <Layers className="size-3 shrink-0" />
                <span>State</span>
              </button>
              <button
                type="button"
                onClick={() => setGroupBy('project')}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs font-medium transition-colors',
                  groupBy === 'project'
                    ? 'bg-background text-foreground shadow-none font-semibold'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                title="Group by Project"
              >
                <FolderGit2 className="size-3 shrink-0" />
                <span>Project</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* List content */}
      <div className="space-y-3">
        {filteredWorkItems.length === 0 ? (
          <div className="text-center py-14 bg-muted/30 rounded-md shadow-none">
            <div className="size-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <EmptyIcon className="size-5 text-muted-foreground shrink-0" />
            </div>
            <p className="text-muted-foreground text-xs font-medium">
              {searchQuery
                ? 'No work items match your filter.'
                : emptyMessage}
            </p>
          </div>
        ) : groupBy === 'state' ? (
          /* Render by State Groups */
          stateGroups.map((group) => {
            const isCollapsed = expandedIds.has(group.key);

            return (
              <div
                key={group.key}
                className="rounded-md overflow-hidden bg-muted/30 shadow-none"
              >
                {/* State Group Header */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={!isCollapsed}
                  className="flex items-center gap-2 px-3.5 py-2.5 bg-muted/60 transition-colors group cursor-pointer hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring select-none"
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
                      'size-3.5 text-muted-foreground transition-transform duration-200 shrink-0',
                      !isCollapsed && 'rotate-90'
                    )}
                  />
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="text-xs font-semibold text-foreground">
                    {group.label}
                  </span>
                  <span className="text-11 px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground font-medium tabular-nums">
                    {group.items.length}
                  </span>
                </div>

                <div
                  className={cn(
                    'divide-y divide-border/60',
                    isCollapsed ? 'hidden' : 'block',
                  )}
                >
                  {group.items.map((item) => (
                    <WorkItemRow
                      key={item.id}
                      item={item}
                      onWorkItemClick={actualOnClick}
                      workItemProjectMap={workItemProjectMap}
                      showProjectBadge={true}
                      showStateBadge={false}
                    />
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          /* Render by Projects */
          projectGroups.map((group) => {
            const isCollapsed = expandedIds.has(group.id);

            return (
              <div
                key={group.id}
                className="rounded-md overflow-hidden bg-muted/30 shadow-none"
              >
                {/* Project Group Header */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={!isCollapsed}
                  className="flex items-center justify-between px-3.5 py-2.5 bg-muted/60 transition-colors group cursor-pointer hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring select-none"
                  onClick={() => toggleExpand(group.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleExpand(group.id);
                    }
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ChevronRight
                      className={cn(
                        'size-3.5 text-muted-foreground transition-transform duration-200 shrink-0',
                        !isCollapsed && 'rotate-90'
                      )}
                    />
                    <ProjectAvatar
                      avatar={group.avatar}
                      name={group.name}
                      id={group.id}
                      size="xs"
                      className="size-4.5 rounded-sm"
                    />
                    <span className="text-xs font-semibold text-foreground truncate">
                      {group.name}
                    </span>
                    {group.identifier && (
                      <span className="text-10 font-mono font-medium px-1.5 py-0.2 rounded-sm bg-muted text-muted-foreground shrink-0">
                        {group.identifier}
                      </span>
                    )}
                    <span className="text-11 px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground font-medium tabular-nums">
                      {group.items.length}
                    </span>
                  </div>
                </div>

                <div
                  className={cn(
                    'divide-y divide-border/60',
                    isCollapsed ? 'hidden' : 'block',
                  )}
                >
                  {group.items.map((item) => (
                    <WorkItemRow
                      key={item.id}
                      item={item}
                      onWorkItemClick={actualOnClick}
                      workItemProjectMap={workItemProjectMap}
                      showProjectBadge={false}
                      showStateBadge={true}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

interface WorkItemRowProps {
  item: any;
  onWorkItemClick: (workItemId: string) => void;
  workItemProjectMap: ProjectMap;
  showProjectBadge: boolean;
  showStateBadge: boolean;
}

function WorkItemRow({
  item,
  onWorkItemClick,
  workItemProjectMap,
  showProjectBadge,
  showStateBadge,
}: WorkItemRowProps) {
  const workItemId = item.id;
  const projectInfo = getWorkItemProject(item, workItemProjectMap);
  const isDone = item.columnId === 'done' || item.completed;
  const isOverdue =
    item.dueDate && new Date(item.dueDate) < new Date() && !isDone;
  const priorityKey = item.priority || 'none';
  const priorityConfig = PRIORITY_BADGES[priorityKey];
  const PriorityIcon = priorityConfig?.icon;
  const childCount = item.childWorkItemCount ?? (item.childWorkItems?.length ?? 0);
  const childDone =
    item.childWorkItemCompletedCount ??
    (item.childWorkItems?.filter((s: any) => s.completed || s.columnId === 'done').length ?? 0);

  const resolvedIdentifier =
    item.identifier ||
    (item.project?.identifier && item.sequenceNumber
      ? `${item.project.identifier}-${item.sequenceNumber}`
      : null);

  const assigneeObj = typeof item.assignee === 'object' ? item.assignee : null;

  let stateGroup = 'unstarted';
  if (showStateBadge) {
    let colName = item.columnId;
    const cols = item.project?.workItemColumns;
    if (Array.isArray(cols)) {
      const matched = (cols as Array<Record<string, unknown>>).find(
        (c) => c.id === item.columnId,
      );
      if (matched?.title || matched?.name) {
        colName = String(matched.title || matched.name);
      }
    }
    stateGroup = inferStateGroup(item.columnId, colName);
  }
  const stateConfig = STATE_GROUP_CONFIG[stateGroup as StateGroup];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onWorkItemClick(workItemId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onWorkItemClick(workItemId);
        }
      }}
      className="w-full flex items-center gap-3 px-4 py-2.5 bg-card hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors text-left group cursor-pointer"
    >
      {/* State indicator */}
      <div className="shrink-0 flex items-center justify-center">
        {isDone ? (
          <CheckCircle2 className="size-3.5 text-success shrink-0" />
        ) : (
          <Circle className="size-3.5 text-muted-foreground/60 shrink-0" />
        )}
      </div>

      {/* Identifier badge */}
      {resolvedIdentifier && (
        <span className="text-11 font-medium font-mono text-muted-foreground px-1.5 py-0.5 rounded-md bg-muted/60 shrink-0">
          {resolvedIdentifier}
        </span>
      )}

      {/* Title & optional badges */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span
          className={cn(
            'text-xs truncate font-medium text-foreground transition-colors',
            isDone && 'text-muted-foreground line-through font-normal',
          )}
        >
          {item.title}
        </span>

        {showProjectBadge && projectInfo && (
          <span className="hidden sm:inline-flex items-center gap-1.5 text-11 font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md shrink-0">
            <ProjectAvatar
              avatar={projectInfo.avatar}
              name={projectInfo.name}
              id={projectInfo.id}
              size="xs"
              className="size-3.5 text-10"
            />
            {projectInfo.name}
          </span>
        )}

        {showStateBadge && stateConfig && (
          <span className="hidden sm:inline-flex items-center gap-1 text-11 font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded-md shrink-0">
            <span
              className="size-1.5 rounded-full shrink-0"
              style={{ backgroundColor: stateConfig.hex }}
            />
            <span>{stateConfig.label}</span>
          </span>
        )}
      </div>

      {/* Metadata badges (Priority, Child Work Items, Comments, Due Date, Assignee) */}
      <div className="flex items-center gap-2.5 shrink-0">
        {priorityConfig && PriorityIcon && (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-11 font-medium px-1.5 py-0.5 rounded-md shrink-0',
              priorityConfig.bg,
            )}
          >
            <PriorityIcon className={cn('size-2.5', priorityConfig.color)} />
            <span className="hidden md:inline">{priorityConfig.label}</span>
          </span>
        )}

        {childCount > 0 && (
          <span className="inline-flex items-center gap-1 text-11 text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md shrink-0">
            <GitBranch className="size-2.5 shrink-0" />
            <span>
              {childDone}/{childCount}
            </span>
          </span>
        )}

        {(item.commentCount ?? 0) > 0 && (
          <div
            className="flex items-center gap-1 text-11 text-muted-foreground"
            title="Comments"
          >
            <MessageSquare className="size-3 shrink-0" />
            <span>{item.commentCount}</span>
          </div>
        )}

        {item.dueDate && (
          <span
            className={cn(
              'flex items-center gap-1 text-11 px-1.5 py-0.5 rounded-md font-medium',
              isOverdue
                ? 'bg-destructive/10 text-destructive'
                : 'bg-muted/60 text-muted-foreground',
            )}
          >
            <Clock3 className="size-3 shrink-0" />
            <span>
              {new Date(item.dueDate).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
              })}
            </span>
          </span>
        )}

        {assigneeObj && (
          <Avatar className="size-5 rounded-full shrink-0">
            <AvatarImage
              src={assigneeObj.avatar || undefined}
              alt={assigneeObj.name || 'Assignee'}
            />
            <AvatarFallback className="text-10 font-medium bg-muted">
              {assigneeObj.name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}

export default YourWorkItemList;

