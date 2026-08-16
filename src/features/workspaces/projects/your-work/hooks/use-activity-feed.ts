'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useProjects } from '@/features/workspaces/projects/shell';
import { getActivityFeed, getWorkspaceTasks } from '../services/your-work.service';
import { z } from 'zod';
import { yourWorkActivityEventSchema } from '../schemas/your-work.schema';

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
      const parsed = z.array(yourWorkActivityEventSchema).safeParse(res);
      return parsed.success ? parsed.data : res;
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

  const allTasks = (tasksData as any[]) || [];
  const activities = (rawActivity as any[]) || [];

  const taskProjectMap = useMemo(() => {
    const map: Record<string, { id: string; name: string }> = {};
    projects.forEach((p: any) => {
      const pid = p.id || p._id;
      map[pid] = { id: pid, name: p.name };
    });
    return map;
  }, [projects]);

  return {
    workspaceId,
    allTasks,
    activities,
    count: activities.length,
    taskProjectMap,
    isLoading: isLoadingActivity || isLoadingTasks || isLoadingProjects,
    isLoadingActivity,
    isLoadingTasks,
    isLoadingProjects,
    refetch: () => {
      refetchActivity();
      refetchTasks();
    },
  };
}
