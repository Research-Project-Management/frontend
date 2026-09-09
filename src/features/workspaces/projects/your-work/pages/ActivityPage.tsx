'use client';

import React from 'react';
import { useActivityFeed } from '../hooks/use-activity-feed';
import { ActivityTimeline } from '../components/activity/ActivityTimeline';
import { YourWorkPageLayout } from '../components/shared/YourWorkPageLayout';

export function ActivityPage() {
  const { state } = useActivityFeed();
  const { allTasks, activities, taskProjectMap, isLoading, isLoadingActivity } = state;

  return (
    <YourWorkPageLayout
      isLoading={isLoading}
      allTasks={allTasks}
      renderList={(handleOpenTask) => (
        <ActivityTimeline
          activities={activities}
          isLoading={isLoadingActivity}
          onTaskClick={handleOpenTask}
          taskProjectMap={taskProjectMap}
        />
      )}
    />
  );
}

export default ActivityPage;
