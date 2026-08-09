'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { queryKeys } from '@/shared/constants';
import {
  fetchProjectsByWorkspaceId,
  fetchProjectById,
} from '../services/workspace.service';
import { useWorkspaces } from './use-workspace';

// ── useTopbar ─────────────────────────────────────────────────────────────────
// Centralizes all data-fetching logic for the Topbar component.
// Keeps Topbar.tsx as a pure presentation component.

export function useTopbar() {
  const { workspaceId: paramWorkspaceId, projectId } = useParams<{
    workspaceId?: string;
    projectId?: string;
  }>();

  const rawWorkspaceId = paramWorkspaceId && paramWorkspaceId !== 'undefined' ? paramWorkspaceId : null;

  const { workspaces } = useWorkspaces();
  const currentWorkspace =
    workspaces.find((w: any) => w.url === rawWorkspaceId) ?? workspaces[0] ?? null;
  const activeWorkspaceId = rawWorkspaceId ?? currentWorkspace?.url ?? '';

  const { data: projectsData } = useQuery({
    queryKey: queryKeys.projects.list(workspaceId!),
    queryFn: ({ signal }) => fetchProjectsByWorkspaceId(workspaceId!, signal),
    enabled: !!workspaceId,
    staleTime: 60_000,
  });
  const projects = (projectsData as any)?.projects ?? projectsData ?? [];

  const { data: projectData } = useQuery({
    queryKey: queryKeys.projects.detail(projectId!),
    queryFn: ({ signal }) => fetchProjectById(projectId!, signal),
    enabled: !!projectId,
    staleTime: 60_000,
  });
  const projectName =
    (projectData as any)?.project?.name ?? (projectData as any)?.name ?? null;

  return {
    workspaceId: activeWorkspaceId,
    projectId,
    currentWorkspace,
    workspaces,
    projects,
    projectName,
  };
}
