'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useProjects } from '@/features/projects/shell/hooks/use-project';
import { getYourWork } from '../services/your-work.service';
import {
  yourWorkSummaryResponseSchema,
  type YourWorkItem,
  type YourWorkActivityEvent,
} from '../schemas/your-work.schema';
import {
  createProjectMap,
  calculateStatusBreakdown,
  calculatePriorityBreakdown,
  type ProjectMap,
} from '../utils/your-work.util';

export function useYourWork() {
  const { workspaceId } = useParams() as { workspaceId: string };
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { projects = [], isLoading: isLoadingProjects } = useProjects();

  const currentUserId = user?.id;

  const {
    data: rawData,
    isLoading: isLoadingYourWork,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['your-work', workspaceId || 'me'],
    queryFn: async ({ signal }) => {
      const res = await getYourWork(workspaceId, signal);
      const unwrapped = (res as any)?.data ?? res;
      const parsed = yourWorkSummaryResponseSchema.safeParse(unwrapped);
      return parsed.success ? parsed.data : unwrapped;
    },
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  // Transparently normalize rawData whether directly returned or enveloped
  const payload = useMemo(() => {
    if (!rawData) return null;
    return (rawData as any)?.data ? (rawData as any).data : rawData;
  }, [rawData]);

  const assigned: YourWorkItem[] = useMemo(
    () => payload?.assigned || [],
    [payload],
  );

  const created: YourWorkItem[] = useMemo(
    () => payload?.created || [],
    [payload],
  );

  const subscribed: YourWorkItem[] = useMemo(
    () => payload?.subscribed || [],
    [payload],
  );

  const activities: YourWorkActivityEvent[] = useMemo(
    () => payload?.activity || [],
    [payload],
  );

  const recent: any[] = useMemo(
    () => payload?.recent || [],
    [payload],
  );

  const allWorkItems: YourWorkItem[] = useMemo(() => {
    const map = new Map<string, YourWorkItem>();
    [...assigned, ...created, ...subscribed].forEach((item) => {
      if (item.id && !map.has(item.id)) {
        map.set(item.id, item);
      }
    });
    return Array.from(map.values());
  }, [assigned, created, subscribed]);

  const statusBreakdown = useMemo(
    () => payload?.stateGroupBreakdown || calculateStatusBreakdown(assigned),
    [payload, assigned],
  );

  const subscribedStatusBreakdown = useMemo(
    () =>
      payload?.subscribedStateGroupBreakdown ||
      calculateStatusBreakdown(subscribed),
    [payload, subscribed],
  );

  const priorityBreakdown = useMemo(
    () => payload?.priorityBreakdown || calculatePriorityBreakdown(assigned),
    [payload, assigned],
  );

  const projectBreakdown = useMemo(() => {
    const backendBreakdown = payload?.projectBreakdown;
    if (Array.isArray(backendBreakdown) && backendBreakdown.length > 0) {
      return backendBreakdown;
    }
    // Fallback: If backend projectBreakdown is empty but workspace has projects, map them!
    if (Array.isArray(projects) && projects.length > 0) {
      return projects.map((p) => ({
        projectId: p.id,
        projectName: p.name,
        projectIdentifier: (p as any).identifier || null,
        projectAvatar: p.avatar || null,
        assignedCount: 0,
        createdCount: 0,
        subscribedCount: 0,
        totalCount: 0,
        completionRate: 0,
        stateGroupBreakdown: {
          backlog: 0,
          unstarted: 0,
          started: 0,
          completed: 0,
          cancelled: 0,
        },
        subscribedStateGroupBreakdown: {
          backlog: 0,
          unstarted: 0,
          started: 0,
          completed: 0,
          cancelled: 0,
        },
      }));
    }
    return [];
  }, [payload, projects]);

  const workItemProjectMap: ProjectMap = useMemo(
    () => createProjectMap(projects),
    [projects],
  );

  const userData = useMemo(
    () =>
      payload?.userData ||
      (user
        ? {
            id: user.id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            createdAt: (user as any).createdAt,
          }
        : undefined),
    [payload, user],
  );

  const categories = useMemo(
    () => ({
      assigned,
      created,
      subscribed,
      statusBreakdown,
      priorityBreakdown,
    }),
    [assigned, created, subscribed, statusBreakdown, priorityBreakdown],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['your-work', workspaceId] });
  };

  return {
    workspaceId,
    currentUserId,
    assigned,
    created,
    subscribed,
    activities,
    recent,
    allWorkItems,
    categories,
    statusBreakdown,
    subscribedStatusBreakdown,
    priorityBreakdown,
    projectBreakdown,
    workItemProjectMap,
    userData,
    isLoading: isLoadingYourWork || isLoadingProjects,
    isLoadingYourWork,
    isLoadingWorkItems: isLoadingYourWork,
    isLoadingProjects,
    isRefetching,
    refetch,
    invalidate,
  };
}

export const useYourWorkBase = useYourWork;
export default useYourWork;
