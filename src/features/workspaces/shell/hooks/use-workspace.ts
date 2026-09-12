'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import {
  workspaceKeys,
  fetchWorkspaceById,
  fetchAllWorkspaces,
  createWorkspace,
  updateWorkspaceById,
  deleteWorkspaceById,
} from '../services/workspace.service';
import type {
  WorkspaceListResponse,
  WorkspaceDetailResponse,
  CreateWorkspaceBody,
  WorkspacePatch,
} from '../services/workspace.service';
import type { Workspace } from '../types/workspace.types';



// ── useWorkspace ──────────────────────────────────────────────────────────────
// Reads current workspaceId from URL params or falls back to user default workspace.

export const useWorkspace = (explicitWorkspaceId?: string) => {
  const params = useParams<{ workspaceId?: string }>();
  const { data: listData } = useWorkspaces();
  const defaultWs = listData?.workspaces?.[0];
  const workspaceId = explicitWorkspaceId || params?.workspaceId || defaultWs?.url || defaultWs?.id;
  const { data, isLoading, isError } = useQuery({
    queryKey: workspaceKeys.detail(workspaceId!),
    queryFn: ({ signal }) => fetchWorkspaceById(workspaceId!, signal),
    enabled: !!workspaceId,
  });

  const pData = data as any;
  const workspace = pData?.workspace ?? pData?.data?.workspace ?? (pData?.id ? pData : defaultWs);

  return {
    workspace: workspace as Workspace | undefined,
    yourRole: pData?.yourRole ?? 'owner',
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

export const useCreateWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWorkspaceBody) => createWorkspace(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
};

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
    onError: (_err, _vars, context) => handleWorkspaceRollback(queryClient, context),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
};

const handleWorkspaceRollback = (
  queryClient: any,
  context?: { previousWorkspaces?: WorkspaceListResponse },
) => {
  if (context?.previousWorkspaces) {
    queryClient.setQueryData(workspaceKeys.all, context.previousWorkspaces);
  }
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
    onError: (_err, _id, context) => handleWorkspaceRollback(queryClient, context),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
};
