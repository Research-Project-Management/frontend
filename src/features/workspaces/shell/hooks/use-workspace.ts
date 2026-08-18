'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { workspaceKeys } from '../../constants/workspace.keys';
import {
  fetchWorkspaceById,
  fetchAllWorkspaces,
  updateWorkspaceById,
  deleteWorkspaceById,
} from '../services/workspace.service';
import type { WorkspaceListResponse, WorkspaceDetailResponse, WorkspacePatch } from '../services/workspace.service';
import type { Workspace } from '@/features/setup/types/workspace.types';



// ── useWorkspace ──────────────────────────────────────────────────────────────
// Reads current workspaceId from URL params automatically.

export const useWorkspace = (explicitWorkspaceId?: string) => {
  const params = useParams<{ workspaceId?: string }>();
  const workspaceId = explicitWorkspaceId || params?.workspaceId;
  const { data, isLoading, isError } = useQuery({
    queryKey: workspaceKeys.detail(workspaceId!),
    queryFn: ({ signal }) => fetchWorkspaceById(workspaceId!, signal),
    enabled: !!workspaceId,
  });

  const pData = data as any;
  const workspace = pData?.workspace ?? pData?.data?.workspace ?? (pData?.id ? pData : undefined);

  return {
    workspace: workspace as Workspace | undefined,
    yourRole: pData?.yourRole,
    isLoading,
    isError,
  };
};

// ── useWorkspaces ─────────────────────────────────────────────────────────────

export const useWorkspaces = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: workspaceKeys.all,
    queryFn: ({ signal }) => fetchAllWorkspaces(signal),
    staleTime: 1000 * 60 * 5,
    select: (data: WorkspaceListResponse) => {
      const workspaces = data?.workspaces ?? [];
      const unique = Array.from(
        new Map(workspaces.map((w: Workspace) => [w.id, w])).values(),
      );
      return { workspaces: unique };

    },
  });

  return {
    workspaces: data?.workspaces ?? [],
    data,
    isLoading,
    isError,
  };
};

// ── useWorkspaceById (explicit ID — for non-param contexts) ───────────────────

export const useWorkspaceById = (workspaceUrl: string) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: workspaceKeys.detail(workspaceUrl),
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
      await queryClient.cancelQueries({ queryKey: workspaceKeys.all });
      
      const previousWorkspaces = queryClient.getQueryData<WorkspaceListResponse>(workspaceKeys.all);
      
      if (previousWorkspaces) {
        queryClient.setQueryData<WorkspaceListResponse>(workspaceKeys.all, {
          ...previousWorkspaces,
          workspaces: previousWorkspaces.workspaces.map((w: Workspace) =>
            w.id === id ? { ...w, ...(data as any) } : w
          ),

        });
      }

      return { previousWorkspaces };
    },
    onSuccess: (data) => {
      if (data.workspace) {
        if (data.workspace.id) {
          queryClient.setQueryData<WorkspaceDetailResponse>(
            workspaceKeys.detail(data.workspace.id),
            data
          );
        }
        if (data.workspace.url) {
          queryClient.setQueryData<WorkspaceDetailResponse>(
            workspaceKeys.detail(data.workspace.url),
            data
          );
        }
      }
    },
    onError: (error, variables, context) => {
      if (context?.previousWorkspaces) {
        queryClient.setQueryData(workspaceKeys.all, context.previousWorkspaces);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
};

export const useDeleteWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteWorkspaceById,
    onMutate: async (workspaceId: string) => {
      await queryClient.cancelQueries({ queryKey: workspaceKeys.all });
      const previousWorkspaces = queryClient.getQueryData<WorkspaceListResponse>(workspaceKeys.all);

      if (previousWorkspaces) {
        queryClient.setQueryData<WorkspaceListResponse>(workspaceKeys.all, {
          ...previousWorkspaces,
          workspaces: previousWorkspaces.workspaces.filter((w: Workspace) => w.id !== workspaceId),
        });
      }

      return { previousWorkspaces };
    },
    onError: (error, workspaceId, context) => {
      if (context?.previousWorkspaces) {
        queryClient.setQueryData(workspaceKeys.all, context.previousWorkspaces);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
};
