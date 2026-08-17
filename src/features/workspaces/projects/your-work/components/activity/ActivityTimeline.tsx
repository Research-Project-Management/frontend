'use client';

import React from 'react';
import { ActivityFeedItem } from '../shared/ActivityFeedItem';
import type { ProjectMap } from '../../utils/your-work.util';
import type { YourWorkActivityEvent } from '../../schemas/your-work.schema';
import { cn } from '@/shared/lib/utils';

export interface ActivityTimelineProps {
  activities?: YourWorkActivityEvent[] | any[];
  isLoading?: boolean;
  onTaskClick: (taskId: string) => void;
  taskProjectMap?: ProjectMap;
  className?: string;
}

export function ActivityTimeline({
  activities = [],
  isLoading = false,
  onTaskClick,
  taskProjectMap = {},
  className,
}: ActivityTimelineProps) {
  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between px-1">
        <h2 className="text-foreground font-semibold text-sm tracking-tight">
          Recent activity
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({activities.length})
          </span>
        </h2>
      </div>

      <div className="rounded-lg border border-border/80 bg-card overflow-hidden divide-y divide-border/60 shadow-2xs">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Loading recent activities...
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-xs font-medium italic">
            No activity yet.
          </div>
        ) : (
          activities.map((activity: any, idx: number) => (
            <ActivityFeedItem
              key={activity.id || activity._id || idx}
              activity={activity}
              onTaskClick={onTaskClick}
              taskProjectMap={taskProjectMap}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default ActivityTimeline;
