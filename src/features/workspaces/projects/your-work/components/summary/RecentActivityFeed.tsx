'use client';

import React from 'react';
import { ActivityFeedList } from '../shared/ActivityFeedList';

export interface RecentActivityFeedProps {
  activities?: any[];
  isLoading?: boolean;
  limit?: number;
  onWorkItemClick?: (workItemId: string) => void;
  workItemProjectMap?: Record<string, { id: string; name: string }>;
}

export function RecentActivityFeed({
  activities = [],
  isLoading = false,
  limit = 5,
  onWorkItemClick,
  workItemProjectMap = {},
}: RecentActivityFeedProps) {
  const displayItems = Array.isArray(activities) && limit > 0 ? activities.slice(0, limit) : (Array.isArray(activities) ? activities : []);

  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground tracking-tight mb-2.5">
        Recent activity
      </h2>
      <ActivityFeedList
        items={displayItems}
        isLoading={isLoading}
        onWorkItemClick={onWorkItemClick}
        workItemProjectMap={workItemProjectMap}
        emptyPadding="py-8"
      />
    </div>
  );
}

export default RecentActivityFeed;
