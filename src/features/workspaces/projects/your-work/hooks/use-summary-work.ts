'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { useProjects } from '@/features/workspaces/projects/shell/hooks/use-project';
import { getYourWork, getWorkspaceTasks } from '../services/your-work.service';
import { yourWorkSummaryResponseSchema, type YourWorkSummaryResponse } from '../schemas/your-work.schema';
import { createProjectMap, categorizeTasks } from '../utils/your-work.util';

export function useSummaryWork() {
  const { workspaceId } = useParams() as { workspaceId: string };
  const { user } = useAuth();
  const { projects = [], isLoading: isLoadingProjects } = useProjects();

  const currentUserId = user?.id || user?._id;

  const {
    data: rawYourWork,
    isLoading: isLoadingYourWork,
    refetch: refetchYourWork,
  } = useQuery({
    queryKey: ['your-work', 'summary', workspaceId],
    queryFn: async ({ signal }) => {
      const res = await getYourWork(workspaceId, signal);
      const parsed = yourWorkSummaryResponseSchema.safeParse(res);
      return parsed.success ? parsed.data : (res as YourWorkSummaryResponse);
    },
    enabled: !!workspaceId,
    staleTime: 30_000,
  });

  const {
    data: tasksData = [],
    isLoading: isLoadingTasks,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: ['workspace-tasks', workspaceId],
    queryFn: ({ signal }) => getWorkspaceTasks(workspaceId, signal),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });

  const tasks: any[] = Array.isArray(tasksData)
    ? tasksData
    : (tasksData as any)?.tasks || (tasksData as any)?.data || [];

  const activities = (rawYourWork as any)?.activity || [];

  const categorizedTasks = useMemo(() => {
    return categorizeTasks(tasks, currentUserId);
  }, [tasks, currentUserId]);

  const taskProjectMap = useMemo(() => createProjectMap(projects), [projects]);

  return {
    state: {
      workspaceId,
      tasks,
      activities,
      categorizedTasks,
      taskProjectMap,
      isLoading: isLoadingYourWork || isLoadingTasks || isLoadingProjects,
      isLoadingYourWork,
      isLoadingTasks,
      isLoadingProjects,
    },
    actions: {
      refetch: () => {
        refetchYourWork();
        refetchTasks();
      },
    },
  };
}

export default useSummaryWork;
