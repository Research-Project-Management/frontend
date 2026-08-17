'use client';

import React from 'react';
import { Skeleton } from '@/shared/components/ui';
import { useSubscribedWork } from '../hooks/use-subscribed-work';
import { useTaskModal } from '../hooks/use-task-modal';
import { SubscribedTaskList } from '../components/subscribed/SubscribedTaskList';
import { TaskDialogModal } from '../components/shared/TaskDialogModal';

export function SubscribedPage() {
  const { state } = useSubscribedWork();
  const { allTasks, subscribedTasks, taskProjectMap, isLoading } = state;
  const { selectedTask, handleOpenTask, handleCloseTask } = useTaskModal(allTasks);

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
          onOpenChange={(open) => !open && handleCloseTask()}
        />
      )}
    </div>
  );
}

export default SubscribedPage;
