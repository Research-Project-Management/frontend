'use client';

import React from 'react';
import { Skeleton } from '@/shared/components/ui';
import { useActivityFeed } from '../hooks/use-activity-feed';
import { useTaskModal } from '../hooks/use-task-modal';
import { ActivityTimeline } from '../components/activity/ActivityTimeline';
import { TaskDialogModal } from '../components/shared/TaskDialogModal';

export function ActivityPage() {
  const { state } = useActivityFeed();
  const { allTasks, activities, taskProjectMap, isLoading, isLoadingActivity } = state;
  const { selectedTask, handleOpenTask, handleCloseTask } = useTaskModal(allTasks);

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto p-6">
        <Skeleton className="h-10 w-48 rounded-md" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      <ActivityTimeline
        activities={activities}
        isLoading={isLoadingActivity}
        onTaskClick={handleOpenTask}
        taskProjectMap={taskProjectMap}
      />

      {selectedTask && (
        <TaskDialogModal
          taskId={selectedTask.taskId}
          projectId={selectedTask.projectId}
          open={!!selectedTask}
          onOpenChange={(open) => !open && handleCloseTask()}
        />
      )}
    </div>
  );
}

export default ActivityPage;
