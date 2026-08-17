'use client';

import React from 'react';
import { Skeleton } from '@/shared/components/ui';
import { useCreatedWork } from '../hooks/use-created-work';
import { useTaskModal } from '../hooks/use-task-modal';
import { CreatedTaskList } from '../components/created/CreatedTaskList';
import { TaskDialogModal } from '../components/shared/TaskDialogModal';

export function CreatedPage() {
  const { state } = useCreatedWork();
  const { allTasks, createdTasks, taskProjectMap, isLoading } = state;
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
      <CreatedTaskList
        tasks={createdTasks}
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

export default CreatedPage;
