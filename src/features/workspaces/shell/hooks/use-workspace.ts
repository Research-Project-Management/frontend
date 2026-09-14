'use client';

import { useMemo } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import {
  workspaceKeys,
  DEFAULT_WORKSPACE,
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
