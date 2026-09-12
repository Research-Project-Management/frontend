'use client';

import React from 'react';
import { cn } from "@/shared/lib/utils";
import { ActivityFeedList } from '../shared/ActivityFeedList';

export interface ActivityTimelineProps {
  activities?: any[];
  isLoading?: boolean;
  onTaskClick?: (taskId: string) => void;
  taskProjectMap?: Record<string, { id: string; name: string }>;
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
      <ActivityFeedList
        items={activities}
        isLoading={isLoading}
        onTaskClick={onTaskClick}
        taskProjectMap={taskProjectMap}
        emptyPadding="py-12"
      />
    </div>
  );
}

export default ActivityTimeline;
