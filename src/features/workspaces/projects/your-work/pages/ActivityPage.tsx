'use client';

import React, { useState } from 'react';
import { Skeleton } from '@/shared/components/ui';

import { useActivityFeed } from '../hooks/use-activity-feed';
import { ActivityTimeline } from '../components/activity/ActivityTimeline';
import { TaskDialogModal } from '../components/shared/TaskDialogModal';

export function ActivityPage() {
  const { allTasks, activities, taskProjectMap, isLoading, isLoadingActivity } = useActivityFeed();
  const [selectedTask, setSelectedTask] = useState<{ taskId: string; projectId: string } | null>(null);

  const handleOpenTask = (taskId: string) => {
    const task = allTasks.find((t) => (t.id || t._id) === taskId);
    const pId = task
      ? typeof task.projectId === 'object'
        ? task.projectId?.id || task.projectId?._id
        : task.projectId || task.project?.id || task.project?._id
      : null;
    if (task && pId) {
      setSelectedTask({ taskId, projectId: pId });
    }
  };

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
          onOpenChange={(open) => !open && setSelectedTask(null)}
        />
      )}
    </div>
  );
}

export default ActivityPage;
