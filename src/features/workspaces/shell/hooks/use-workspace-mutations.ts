'use client';

import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet } from '@/shared/lib';
import { queryKeys } from '@/shared/constants';
import type { RecentItem, Activity } from '../types/workspace.types';
import {
  updateWorkspaceById,
  deleteWorkspaceById,
  syncWorkspaceIntoCaches,
  removeWorkspaceFromWorkspacesCache,
} from '../services/workspace.service';

// ── useRecentItems ────────────────────────────────────────────────────────────

export const useRecentItems = (workspaceId: string) =>
  useQuery({
    queryKey: [...queryKeys.workspaces.detail(workspaceId), 'recent'],
    queryFn: async () => {
      const data = await apiGet<RecentItem[]>(
        `/api/dashboard/workspaces/${workspaceId}/recent`,
      );
      return data;
    },
    enabled: !!workspaceId,
  });

// ── useActivityFeed ───────────────────────────────────────────────────────────

export const useActivityFeed = (workspaceId: string) =>
  useQuery({
    queryKey: [...queryKeys.workspaces.detail(workspaceId), 'activity'],
    queryFn: async () => {
      const data = await apiGet<Activity[]>(
        `/api/dashboard/workspaces/${workspaceId}/activity`,
      );
      return data;
    },
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });

// ── useUpdateWorkspace ────────────────────────────────────────────────────────

export const useUpdateWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{
        name: string;
        avatar: string | null;
        companySize: string;
        timezone: string;
        url: string;
      }>;
    }) => updateWorkspaceById(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.workspaces.all });
      await queryClient.cancelQueries({ queryKey: queryKeys.workspaces.all });

      const previousWorkspaceQueries = queryClient.getQueriesData({
        queryKey: queryKeys.workspaces.all,
      });
      const previousWorkspacesQueries = queryClient.getQueriesData({
        queryKey: queryKeys.workspaces.all,
      });

      syncWorkspaceIntoCaches(queryClient, { _id: id, ...data });

      return { previousWorkspaceQueries, previousWorkspacesQueries };
    },
    onSuccess: (data) => {
      const res = data as any;
      if (res?.workspace) {
        syncWorkspaceIntoCaches(queryClient, res.workspace);
      }
    },
    onError: (error: any, _variables, context) => {
      context?.previousWorkspaceQueries?.forEach(
        ([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data);
        },
      );
      context?.previousWorkspacesQueries?.forEach(
        ([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data);
        },
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all });
    },
  });
};

// ── useDeleteWorkspace ────────────────────────────────────────────────────────

export const useDeleteWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteWorkspaceById,
    onMutate: async (workspaceId: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.workspaces.all });
      const previousWorkspaces = queryClient.getQueriesData({
        queryKey: queryKeys.workspaces.all,
      });

      removeWorkspaceFromWorkspacesCache(queryClient, workspaceId);

      return { previousWorkspaces };
    },
    onError: (error: any, _workspaceId, context) => {
      context?.previousWorkspaces?.forEach(([queryKey, data]: [any, any]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all });
    },
  });
};
