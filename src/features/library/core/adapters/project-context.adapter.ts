'use client';

import { useMemo } from 'react';
import { useProjectsQuery } from '@/features/projects/shell/hooks/use-project';
import { useAuth } from '@/features/auth/hooks/use-auth';

export interface LibraryProjectScope {
  id: string;
  name: string;
  role?: string;
  permissions?: string[] | Record<string, unknown>;
  effectivePermissions?: string[];
  members?: Array<{ id?: string; userId: string; role: string }>;
  [key: string]: unknown;
}

export interface LibraryUserSession {
  id?: string;
  email?: string;
  name?: string;
}

export interface UseLibraryProjectContextReturn {
  projects: LibraryProjectScope[];
  isLoadingProjects: boolean;
  currentUser: LibraryUserSession | null;
  currentUserId?: string;
  isAuthenticated: boolean;
}

/**
 * Anti-Corruption Layer (ACL) / Adapter for Library Feature.
 * Decouples library internals from external project and authentication module implementations.
 */
export function useLibraryProjectContext(): UseLibraryProjectContextReturn {
  const { projects = [], isLoading } = useProjectsQuery();
  const { user, isAuthenticated } = useAuth();

  const mappedProjects = useMemo(
    () =>
      projects.map(
        (p): LibraryProjectScope => ({
          ...p,
          id: p.id,
          name: p.name,
          role: typeof p.role === 'string' ? p.role : undefined,
          permissions: p.permissions,
        }),
      ),
    [projects],
  );

  const currentUser = useMemo(
    () => (user ? { id: user.id, email: user.email, name: user.name } : null),
    [user],
  );

  return {
    projects: mappedProjects,
    isLoadingProjects: isLoading,
    currentUser,
    currentUserId: user?.id,
    isAuthenticated,
  };
}
