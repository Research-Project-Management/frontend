'use client';

import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/use-auth';
import {
  workspaceKeys,
  DEFAULT_WORKSPACE,
  createWorkspace,
  updateWorkspaceById,
  deleteWorkspaceById,
} from '../services/workspace.service';
import type {
  CreateWorkspaceBody,
  WorkspacePatch,
} from '../services/workspace.service';
import type { Workspace } from '../types/workspace.types';

// ── useWorkspaces ─────────────────────────────────────────────────────────────
// Returns the active user's personal laboratory workspace context.

export const useWorkspaces = () => {
  const { user, isLoading } = useAuth();

  const activeWorkspace: Workspace = useMemo(() => {
    if (!user) return DEFAULT_WORKSPACE;
    return {
      id: user.id || 'flux',
      name: user.name || 'Flux',
      slug: 'flux',
      url: 'flux',
      avatar: user.avatar || '',
      plan: 'free',
      createdAt: (user as any)?.createdAt || new Date().toISOString(),
      updatedAt: (user as any)?.updatedAt || new Date().toISOString(),
    };
  }, [user]);

  const workspaces = useMemo(() => [activeWorkspace], [activeWorkspace]);
  const data = useMemo(() => ({ workspaces }), [workspaces]);

  return {
    workspaces,
    data,
    isLoading: isLoading && !user,
    isError: false,
  };
};

// ── useWorkspace ──────────────────────────────────────────────────────────────
// Decoupled from URL params; seamlessly resolves the user's workspace context.

export const useWorkspace = (_explicitWorkspaceId?: string) => {
  const { workspaces, isLoading } = useWorkspaces();
  const workspace = workspaces[0] || DEFAULT_WORKSPACE;

  return {
    workspace,
    yourRole: 'owner',
    isLoading,
    isError: false,
  };
};

// ── useWorkspaceById (explicit ID — for backward compatibility) ───────────────

export const useWorkspaceById = (_workspaceUrl?: string) => {
  return useWorkspace(_workspaceUrl);
};

// ── Mutations ─────────────────────────────────────────────────────────────────

export const useCreateWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWorkspaceBody) => createWorkspace(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'session'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'session'] });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
};

export const useDeleteWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workspaceId: string) => deleteWorkspaceById(workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
  });
};
