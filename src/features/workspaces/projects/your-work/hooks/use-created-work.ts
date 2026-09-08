'use client';

import { useYourWorkBase } from './use-your-work-base';

export function useCreatedWork() {
  const base = useYourWorkBase();
  const createdTasks = base.categories.created;

  return {
    state: {
      workspaceId: base.workspaceId,
      allTasks: base.allTasks,
      createdTasks,
      count: createdTasks.length,
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

export default useCreatedWork;
