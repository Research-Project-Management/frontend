'use client';

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useProjects } from '@/features/projects/shell/hooks/use-project';
import { getYourWork } from '../services/your-work.service';
import {
  yourWorkSummaryResponseSchema,
  type YourWorkItem,
  type YourWorkActivityEvent,
  type YourWorkSummaryResponse,
  type YourWorkRecentItem,
} from '../schemas/your-work.schema';
import {
  createProjectMap,
  calculateStatusBreakdown,
  calculatePriorityBreakdown,
  type ProjectMap,
} from '../utils/your-work.util';

export function useYourWork(projectId?: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const {
    projects = [],
    isLoading: isLoadingProjects,
    isError: isProjectsError,
  } = useProjects();

  const currentUserId = user?.id;

  const {
    data: rawData,
    isLoading: isLoadingYourWork,
    isRefetching,
    refetch,
    isError: isYourWorkError,
    error: yourWorkError,
  } = useQuery({
    queryKey: ['your-work', projectId || 'me'],
    queryFn: async ({ signal }): Promise<YourWorkSummaryResponse> => {
      const res = await getYourWork(projectId, signal);
      const resObj = res as Record<string, unknown>;
      const unwrapped = (typeof res === 'object' && res !== null && 'data' in resObj ? resObj.data : res);
      const parsed = yourWorkSummaryResponseSchema.safeParse(unwrapped);
      return (parsed.success ? parsed.data : (unwrapped as YourWorkSummaryResponse)) || {};
    },
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  const isError = isYourWorkError || isProjectsError;
  const error =
    yourWorkError ||
    (isProjectsError ? new Error('Failed to load projects') : null);

  // Transparently normalize rawData whether directly returned or enveloped
  const payload = useMemo<YourWorkSummaryResponse | null>(() => {
    if (!rawData) return null;
    const rawObj = rawData as Record<string, unknown>;
    return (typeof rawData === 'object' && rawData !== null && 'data' in rawObj && rawObj.data ? rawObj.data : rawData) as YourWorkSummaryResponse;
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

  const recent: YourWorkRecentItem[] = useMemo(
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
        projectIdentifier: p.identifier || null,
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
            createdAt: (user as typeof user & { createdAt?: string }).createdAt,
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

  const isEmpty = useMemo(() => {
    if (isLoadingYourWork || isLoadingProjects) return false;
    if (payload?.isEmpty !== undefined) return Boolean(payload.isEmpty);
    return allWorkItems.length === 0 && activities.length === 0;
  }, [
    isLoadingYourWork,
    isLoadingProjects,
    payload?.isEmpty,
    allWorkItems.length,
    activities.length,
  ]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['your-work'] });
  };

  return {
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
    isError,
    error,
    isEmpty,
    refetch,
    invalidate,
  };
}

export const useYourWorkBase = useYourWork;
export default useYourWork;
