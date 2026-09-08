'use client';

import { useYourWorkBase } from './use-your-work-base';

export function useAssignedWork() {
  const base = useYourWorkBase();
  const assignedTasks = base.categories.assigned;

  return {
    state: {
      workspaceId: base.workspaceId,
      allTasks: base.allTasks,
      assignedTasks,
      count: assignedTasks.length,
      taskProjectMap: base.taskProjectMap,
      isLoading: base.isLoading,
      isLoadingTasks: base.isLoadingTasks,
      isLoadingProjects: base.isLoadingProjects,
    },
    actions: {
      refetch: base.refetch,
    },
  };
}

export default useAssignedWork;
