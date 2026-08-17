'use client';

import { useState, useCallback } from 'react';
import { getTaskProjectId } from '../utils/your-work.util';

export interface SelectedTaskState {
  taskId: string;
  projectId: string;
}

export function useTaskModal(tasks: any[] = []) {
  const [selectedTask, setSelectedTask] = useState<SelectedTaskState | null>(null);

  const handleOpenTask = useCallback(
    (taskId: string, fallbackProjectId?: string) => {
      const task = tasks.find((t) => (t.id || t._id) === taskId);
      const projectId = task ? getTaskProjectId(task) : fallbackProjectId || null;

      if (projectId) {
        setSelectedTask({ taskId, projectId });
      }
    },
    [tasks],
  );

  const handleCloseTask = useCallback(() => {
    setSelectedTask(null);
  }, []);

  return {
    selectedTask,
    setSelectedTask,
    handleOpenTask,
    handleCloseTask,
    isOpen: !!selectedTask,
  };
}

export default useTaskModal;
