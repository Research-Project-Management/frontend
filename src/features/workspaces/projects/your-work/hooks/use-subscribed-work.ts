'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { useProjects } from '@/features/workspaces/projects/shell/hooks/use-project';
import { getWorkspaceTasks } from '../services/your-work.service';
import { createProjectMap, categorizeTasks } from '../utils/your-work.util';

export function useSubscribedWork() {
  const { workspaceId } = useParams() as { workspaceId: string };
  const { user } = useAuth();
  const { projects = [], isLoading: isLoadingProjects } = useProjects();

  const currentUserId = user?.id || user?._id;

  const {
    data: tasksData = [],
    isLoading: isLoadingTasks,
    refetch,
  } = useQuery({
    queryKey: ['workspace-tasks', workspaceId],
    queryFn: ({ signal }) => getWorkspaceTasks(workspaceId, signal),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });

  const allTasks: any[] = Array.isArray(tasksData)
    ? tasksData
    : (tasksData as any)?.tasks || (tasksData as any)?.data || [];

  const subscribedTasks = useMemo(() => {
    return categorizeTasks(allTasks, currentUserId).subscribed;
  }, [allTasks, currentUserId]);

  const taskProjectMap = useMemo(() => createProjectMap(projects), [projects]);

  return {
    state: {
      workspaceId,
      allTasks,
      subscribedTasks,
      count: subscribedTasks.length,
      taskProjectMap,
      isLoading: isLoadingTasks || isLoadingProjects,
      isLoadingTasks,
      isLoadingProjects,
    },
    actions: {
      refetch,
    },
  };
}

export default useSubscribedWork;
