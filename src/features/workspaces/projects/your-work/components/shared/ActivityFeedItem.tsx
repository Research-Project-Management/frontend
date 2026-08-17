'use client';

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import { getTaskProject, type ProjectMap } from '../../utils/your-work.util';
import type { YourWorkActivityEvent } from '../../schemas/your-work.schema';

export interface ActivityFeedItemProps {
  activity: YourWorkActivityEvent | any;
  onTaskClick: (taskId: string) => void;
  taskProjectMap?: ProjectMap;
  className?: string;
}

export function ActivityFeedItem({
  activity,
  onTaskClick,
  taskProjectMap = {},
  className,
}: ActivityFeedItemProps) {
  const isTaskRelated =
    activity.itemId &&
    (activity.type?.startsWith('task') ||
      activity.type?.includes('task') ||
      !activity.type);

  const timeDate = activity.time ? new Date(activity.time) : new Date();

  // Resolve project metadata
  let projectName: string | null = null;
  if (activity.project) {
    projectName =
      typeof activity.project === 'object'
        ? activity.project.name || null
        : activity.project;
  } else if (activity.itemId) {
    const proj = getTaskProject(activity, taskProjectMap);
    if (proj) projectName = proj.name;
  }

  const actorName =
    activity.actorName || activity.user?.name || activity.actor?.name || 'You';
  const actionVerb = activity.actionVerb || activity.verb || 'updated';

  const handleClick = () => {
    if (isTaskRelated && activity.itemId) {
      onTaskClick(activity.itemId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isTaskRelated && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      role={isTaskRelated ? 'button' : undefined}
      tabIndex={isTaskRelated ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex items-start gap-3.5 px-5 py-4 transition-colors text-left select-none',
        isTaskRelated
          ? 'hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group'
          : '',
        className,
      )}
    >
      <Avatar className="size-9 rounded-lg shrink-0 mt-0.5 border border-border/80">
        <AvatarImage
          src={activity.user?.avatar || undefined}
          alt={actorName}
        />
        <AvatarFallback className="rounded-lg text-[11px] font-bold bg-muted">
          {actorName.substring(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-foreground leading-snug">
          <span className="font-semibold text-foreground mr-1.5">
            {actorName}
          </span>
          <span className="text-muted-foreground mr-1.5">{actionVerb}</span>
          {activity.targetIdentifier && (
            <span className="font-bold text-foreground mr-1.5">
              {activity.targetIdentifier}
            </span>
          )}
          {activity.targetTitle && (
            <span
              className={cn(
                'font-normal text-foreground transition-colors',
                isTaskRelated && 'group-hover:text-primary',
              )}
            >
              {activity.targetTitle}
            </span>
          )}
        </p>

        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground font-normal">
            {formatDistanceToNow(timeDate, { addSuffix: true })}
          </span>
          {projectName && (
            <>
              <span className="text-muted-foreground/40 text-[10px]">•</span>
              <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[200px]">
                {projectName}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ActivityFeedItem;
