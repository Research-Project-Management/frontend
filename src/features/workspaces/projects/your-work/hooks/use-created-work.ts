'use client';

import { useYourWorkBase } from './use-your-work-base';
import { useOptionalYourWorkContext } from '../context/your-work.context';

export function useCreatedWork() {
  const context = useOptionalYourWorkContext();
  const base = useYourWorkBase();
  const source = context || base;

  const createdWorkItems = source.created;

  return {
    state: {
      workspaceId: source.workspaceId,
      allWorkItems: source.allWorkItems,
      createdWorkItems,
      count: createdWorkItems.length,
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

export default useCreatedWork;
