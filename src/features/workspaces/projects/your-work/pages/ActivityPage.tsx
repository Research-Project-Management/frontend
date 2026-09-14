'use client';

import React from 'react';
import { useActivityFeed } from '../hooks/use-activity-feed';
import { ActivityTimeline } from '../components/activity/ActivityTimeline';
import { YourWorkPageLayout } from '../components/shared/YourWorkPageLayout';

export function ActivityPage() {
  const { state } = useActivityFeed();
  const { allWorkItems, activities, workItemProjectMap, isLoading, isLoadingActivity } = state;

  return (
    <YourWorkPageLayout
      isLoading={isLoading}
      allWorkItems={allWorkItems}
      renderList={(handleOpenItem) => (
        <ActivityTimeline
          activities={activities}
          isLoading={isLoadingActivity}
          onWorkItemClick={handleOpenItem}
          workItemProjectMap={workItemProjectMap}
        />
      )}
    />
  );
}

export default ActivityPage;
