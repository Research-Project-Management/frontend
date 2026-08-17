'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useProjects } from '@/features/workspaces/projects/shell';
import { getActivityFeed, getWorkspaceTasks } from '../services/your-work.service';
import { z } from 'zod';
import { yourWorkActivityEventSchema, type YourWorkActivityEvent } from '../schemas/your-work.schema';
import { createProjectMap } from '../utils/your-work.util';

export function useActivityFeed() {
  const { workspaceId } = useParams() as { workspaceId: string };
  const { projects = [], isLoading: isLoadingProjects } = useProjects();

  const {
    data: rawActivity,
    isLoading: isLoadingActivity,
    refetch: refetchActivity,
  } = useQuery({
    queryKey: ['workspace-activity', workspaceId],
    queryFn: async ({ signal }) => {
      const res = await getActivityFeed(workspaceId, signal);
      const items = Array.isArray(res) ? res : (res as any)?.items || (res as any)?.data || [];
      const parsed = z.array(yourWorkActivityEventSchema).safeParse(items);
      return parsed.success ? parsed.data : (items as YourWorkActivityEvent[]);
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

  const allTasks: any[] = Array.isArray(tasksData)
    ? tasksData
    : (tasksData as any)?.tasks || (tasksData as any)?.data || [];

  const activities: YourWorkActivityEvent[] = Array.isArray(rawActivity)
    ? rawActivity
    : (rawActivity as any)?.items || [];

  const taskProjectMap = useMemo(() => createProjectMap(projects), [projects]);

  return {
    state: {
      workspaceId,
      allTasks,
      activities,
      count: activities.length,
      taskProjectMap,
      isLoading: isLoadingActivity || isLoadingTasks || isLoadingProjects,
      isLoadingActivity,
      isLoadingTasks,
      isLoadingProjects,
    },
    actions: {
      refetch: () => {
        refetchActivity();
        refetchTasks();
      },
    },
  };
}

export default useActivityFeed;
