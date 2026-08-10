'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { queryKeys } from '@/shared/constants';
import {
  fetchWorkspaceById,
  fetchAllWorkspaces,
  updateWorkspaceById,
  deleteWorkspaceById,
} from '../services/workspace.service';
import type { WorkspaceListResponse, WorkspaceDetailResponse, WorkspacePatch } from '../services/workspace.service';
import type { Workspace } from '@/features/setup/types/workspace-types';

// ── useWorkspace ──────────────────────────────────────────────────────────────
// Reads current workspaceId from URL params automatically.

export const useWorkspace = (explicitWorkspaceId?: string) => {
  const params = useParams<{ workspaceId?: string }>();
  const workspaceId = explicitWorkspaceId || params?.workspaceId;
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.workspaces.detail(workspaceId!),
    queryFn: ({ signal }) => fetchWorkspaceById(workspaceId!, signal),
    enabled: !!workspaceId,
  });

  return {
    workspace: data?.workspace ?? undefined,
    yourRole: data?.yourRole,
    isLoading,
    isError,
  };
};

// ── useWorkspaces ─────────────────────────────────────────────────────────────

export const useWorkspaces = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.workspaces.all,
    queryFn: ({ signal }) => fetchAllWorkspaces(signal),
    staleTime: 1000 * 60 * 5,
    select: (data: WorkspaceListResponse) => {
      const workspaces = data?.workspaces ?? [];
      const unique = Array.from(
        new Map(workspaces.map((w) => [w._id, w])).values(),
      );
      return { workspaces: unique };
    },
  });

  return {
    workspaces: data?.workspaces ?? [],
    isLoading,
    isError,
  };
};

// ── useWorkspaceById (explicit ID — for non-param contexts) ───────────────────

export const useWorkspaceById = (workspaceUrl: string) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.workspaces.detail(workspaceUrl),
    queryFn: ({ signal }) => fetchWorkspaceById(workspaceUrl, signal),
    enabled: !!workspaceUrl,
  });

  return {
    workspace: data?.workspace ?? undefined,
    yourRole: data?.yourRole,
    isLoading,
    isError,
  };
};

// ── Mutations ─────────────────────────────────────────────────────────────────

export const useUpdateWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: WorkspacePatch;
    }) => updateWorkspaceById(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.workspaces.all });
      
      const previousWorkspaces = queryClient.getQueryData<WorkspaceListResponse>(queryKeys.workspaces.all);
      
      if (previousWorkspaces) {
        queryClient.setQueryData<WorkspaceListResponse>(queryKeys.workspaces.all, {
          ...previousWorkspaces,
          workspaces: previousWorkspaces.workspaces.map((w) =>
            w._id === id ? { ...w, ...(data as any) } : w
          ),
        });
      }

      return { previousWorkspaces };
    },
    onSuccess: (data) => {
      if (data.workspace) {
        queryClient.setQueryData<WorkspaceDetailResponse>(
          queryKeys.workspaces.detail(data.workspace._id),
          data
        );
        if (data.workspace.url) {
          queryClient.setQueryData<WorkspaceDetailResponse>(
            queryKeys.workspaces.detail(data.workspace.url),
            data
          );
        }
      }
    },
    onError: (error, variables, context) => {
      if (context?.previousWorkspaces) {
        queryClient.setQueryData(queryKeys.workspaces.all, context.previousWorkspaces);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all });
    },
  });
};

export const useDeleteWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteWorkspaceById,
    onMutate: async (workspaceId: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.workspaces.all });
      const previousWorkspaces = queryClient.getQueryData<WorkspaceListResponse>(queryKeys.workspaces.all);

      if (previousWorkspaces) {
        queryClient.setQueryData<WorkspaceListResponse>(queryKeys.workspaces.all, {
          ...previousWorkspaces,
          workspaces: previousWorkspaces.workspaces.filter((w: Workspace) => w._id !== workspaceId),
        });
      }

      return { previousWorkspaces };
    },
    onError: (error, workspaceId, context) => {
      if (context?.previousWorkspaces) {
        queryClient.setQueryData(queryKeys.workspaces.all, context.previousWorkspaces);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all });
    },
  });
};
