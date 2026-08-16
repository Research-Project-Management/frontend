'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { useProjects } from '@/features/workspaces/projects/shell';
import { getWorkspaceTasks } from '../services/your-work.service';

export function useCreatedWork() {
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

  const allTasks = (tasksData as any[]) || [];

  const createdTasks = useMemo(() => {
    if (!currentUserId) return [];
    return allTasks.filter((t: any) => {
      const authorId =
        typeof t.author === 'object'
          ? t.author?.id || t.author?._id
          : t.authorId || t.author;
      return authorId === currentUserId;
    });
  }, [allTasks, currentUserId]);

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
    createdTasks,
    count: createdTasks.length,
    taskProjectMap,
    isLoading: isLoadingTasks || isLoadingProjects,
    isLoadingTasks,
    isLoadingProjects,
    refetch,
  };
}
