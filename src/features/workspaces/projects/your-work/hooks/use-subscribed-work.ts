'use client';

import { useYourWorkBase } from './use-your-work-base';
import { useOptionalYourWorkContext } from '../context/your-work.context';

export function useSubscribedWork() {
  const context = useOptionalYourWorkContext();
  const base = useYourWorkBase();
  const source = context || base;

  const subscribedTasks = source.subscribed;

  return {
    state: {
      workspaceId: source.workspaceId,
      allTasks: source.allTasks,
      subscribedTasks,
      count: subscribedTasks.length,
      taskProjectMap: source.taskProjectMap,
      selectedProjectId: context?.selectedProjectId || null,
      selectedProject: context?.selectedProject || null,
      isLoading: source.isLoading,
      isLoadingTasks: source.isLoadingTasks,
      isLoadingProjects: source.isLoadingProjects,
    },
    actions: {
      refetch: source.refetch,
      selectProject: (id: string | null) => context?.setSelectedProjectId(id),
    },
  };
}

export default useSubscribedWork;
