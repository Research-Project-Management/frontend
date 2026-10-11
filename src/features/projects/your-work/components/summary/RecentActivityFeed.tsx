'use client';

import React, { useMemo } from 'react';
import { ActivityFeedList } from '../shared/ActivityFeedList';

export interface RecentActivityFeedProps {
  activities?: any[];
  isLoading?: boolean;
  limit?: number;
  onWorkItemClick?: (workItemId: string) => void;
  workItemProjectMap?: Record<string, { id: string; name: string }>;
}

export const RecentActivityFeed = React.memo<RecentActivityFeedProps>(function RecentActivityFeed({
  activities = [],
  isLoading = false,
  limit = 5,
  onWorkItemClick,
  workItemProjectMap = {},
}: RecentActivityFeedProps) {
  const displayItems = useMemo(
    () => (Array.isArray(activities) && limit > 0 ? activities.slice(0, limit) : (Array.isArray(activities) ? activities : [])),
    [activities, limit]
  );

  return (
    <div>
      <h2 className="text-13 font-semibold text-foreground tracking-tight mb-2.5">
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
});

export default RecentActivityFeed;
