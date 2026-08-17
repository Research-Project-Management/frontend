'use client';

import React from 'react';
import { ActivityFeedItem } from '../shared/ActivityFeedItem';
import type { ProjectMap } from '../../utils/your-work.util';
import type { YourWorkActivityEvent } from '../../schemas/your-work.schema';

export interface RecentActivityFeedProps {
  activities?: YourWorkActivityEvent[] | any[];
  isLoading?: boolean;
  limit?: number;
  onTaskClick: (taskId: string) => void;
  taskProjectMap?: ProjectMap;
}

export function RecentActivityFeed({
  activities = [],
  isLoading = false,
  limit = 5,
  onTaskClick,
  taskProjectMap = {},
}: RecentActivityFeedProps) {
  const displayItems = limit > 0 ? activities.slice(0, limit) : activities;

  return (
    <div>
      <h2 className="text-foreground font-semibold mb-3 text-sm tracking-tight">
        Recent activity
      </h2>

      <div className="rounded-lg border border-border/80 bg-card overflow-hidden divide-y divide-border/60 shadow-2xs">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Loading recent activities...
          </div>
        ) : displayItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-xs font-medium italic">
            No activity yet.
          </div>
        ) : (
          displayItems.map((activity, idx) => (
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

export default RecentActivityFeed;
