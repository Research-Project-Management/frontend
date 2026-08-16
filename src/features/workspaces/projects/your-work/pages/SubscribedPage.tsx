'use client';

import React, { useState } from 'react';
import { Skeleton } from '@/shared/components/ui';

import { useSubscribedWork } from '../hooks/use-subscribed-work';
import { SubscribedTaskList } from '../components/subscribed/SubscribedTaskList';
import { TaskDialogModal } from '../components/shared/TaskDialogModal';

export function SubscribedPage() {
  const { allTasks, subscribedTasks, taskProjectMap, isLoading } = useSubscribedWork();
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
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      <SubscribedTaskList
        tasks={subscribedTasks}
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

export default SubscribedPage;
