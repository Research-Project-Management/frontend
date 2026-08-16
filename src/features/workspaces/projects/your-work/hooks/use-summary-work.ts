'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { useProjects } from '@/features/workspaces/projects/shell';
import { getYourWork, getWorkspaceTasks } from '../services/your-work.service';
import { yourWorkSummaryResponseSchema } from '../schemas/your-work.schema';

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

  const tasks: any[] = Array.isArray(tasksData)
    ? tasksData
    : (tasksData as any)?.tasks || [];
  const activities = (rawYourWork as any)?.activity || [];

  const categorizedTasks = useMemo(() => {
    if (!currentUserId) {
      return {
        assigned: [],
        created: [],
        subscribed: [],
        statusBreakdown: {
          backlog: 0,
          todo: 0,
          doing: 0,
          review: 0,
          done: 0,
          cancelled: 0,
        },
        priorityBreakdown: {
          urgent: 0,
          high: 0,
          medium: 0,
          low: 0,
          none: 0,
        },
      };
    }

    const assigned = tasks.filter((t: any) => {
      const assigneeId =
        typeof t.assignee === 'object'
          ? t.assignee?.id || t.assignee?._id
          : t.assigneeId || t.assignee;
      return assigneeId === currentUserId;
    });

    const created = tasks.filter((t: any) => {
      const authorId =
        typeof t.author === 'object'
          ? t.author?.id || t.author?._id
          : t.authorId || t.author;
      return authorId === currentUserId;
    });

    const subscribed = tasks.filter((t: any) => {
      const isAssignee =
        (typeof t.assignee === 'object'
          ? t.assignee?.id || t.assignee?._id
          : t.assigneeId || t.assignee) === currentUserId;
      const isAuthor =
        (typeof t.author === 'object'
          ? t.author?.id || t.author?._id
          : t.authorId || t.author) === currentUserId;
      return !isAssignee && !isAuthor && (t.commentCount || 0) > 0;
    });

    const statusBreakdown: Record<string, number> = {
      backlog: 0,
      todo: 0,
      doing: 0,
      review: 0,
      done: 0,
      cancelled: 0,
    };

    const priorityBreakdown: Record<string, number> = {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
      none: 0,
    };

    assigned.forEach((t: any) => {
      const col = t.columnId || 'todo';
      statusBreakdown[col] = (statusBreakdown[col] || 0) + 1;

      const prio = t.priority || 'none';
      priorityBreakdown[prio] = (priorityBreakdown[prio] || 0) + 1;
    });

    return {
      assigned,
      created,
      subscribed,
      statusBreakdown,
      priorityBreakdown,
    };
  }, [tasks, currentUserId]);

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
    tasks,
    activities,
    categorizedTasks,
    taskProjectMap,
    isLoading: isLoadingYourWork || isLoadingTasks || isLoadingProjects,
    isLoadingYourWork,
    isLoadingTasks,
    isLoadingProjects,
    refetch: () => {
      refetchYourWork();
      refetchTasks();
    },
  };
}
