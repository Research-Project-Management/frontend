'use client';

import { useYourWorkBase } from './use-your-work-base';
import { useOptionalYourWorkContext } from '../context/your-work.context';

export function useSubscribedWork() {
  const context = useOptionalYourWorkContext();
  const base = useYourWorkBase();
  const source = context || base;

  const subscribedWorkItems = source.subscribed;

  return {
    state: {
      workspaceId: source.workspaceId,
      allWorkItems: source.allWorkItems,
      subscribedWorkItems,
      count: subscribedWorkItems.length,
      workItemProjectMap: source.workItemProjectMap,
      selectedProjectId: context?.selectedProjectId || null,
      selectedProject: context?.selectedProject || null,
      isLoading: source.isLoading,
      isLoadingWorkItems: source.isLoadingWorkItems,
      isLoadingProjects: source.isLoadingProjects,
    },
    actions: {
      refetch: source.refetch,
      selectProject: (id: string | null) => context?.setSelectedProjectId(id),
    },
  };
}

export default useSubscribedWork;
