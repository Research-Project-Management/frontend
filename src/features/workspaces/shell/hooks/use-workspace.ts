'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { queryKeys } from '@/shared/constants';
import {
  fetchWorkspaceById,
  fetchProjectsByWorkspaceId,
  fetchAllWorkspaces,
} from '../services/workspace.service';

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

  const res = data as any;
  return {
    workspace: res?.workspace ?? res,
    yourRole: res?.yourRole,
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
    select: (data: any) => {
      const workspaces = (data?.workspaces ?? []) as any[];
      const unique = Array.from(
        new Map(workspaces.map((w) => [w._id, w])).values(),
      ) as any[];
      return { workspaces: unique };
    },
  });

  return {
    workspaces: (data?.workspaces ?? []) as any[],
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

  const res = data as any;
  return {
    workspace: res?.workspace ?? res,
    yourRole: res?.yourRole,
    isLoading,
    isError,
  };
};

// ── useProjects ───────────────────────────────────────────────────────────────

export const useProjects = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.projects.list(workspaceId!),
    queryFn: ({ signal }) => fetchProjectsByWorkspaceId(workspaceId!, signal),
    enabled: !!workspaceId,
  });

  const pData = data as any;
  return {
    projects: pData?.projects ?? (Array.isArray(pData) ? pData : []),
    isLoading,
    isError,
  };
};

// ── useWorkspaceProjects (explicit ID) ────────────────────────────────────────

export const useWorkspaceProjects = (workspaceId: string) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.projects.list(workspaceId),
    queryFn: ({ signal }) => fetchProjectsByWorkspaceId(workspaceId, signal),
    enabled: !!workspaceId,
  });

  const res = data as any;
  return {
    projects: (res?.projects ?? (Array.isArray(res) ? res : [])) as any[],
    isLoading,
    isError,
  };
};
