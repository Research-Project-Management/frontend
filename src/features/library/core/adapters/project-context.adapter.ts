'use client';

import { useMemo } from 'react';
import { useProjectsQuery } from '@/features/projects/shell/hooks/use-project';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { resolveEffectiveLibraryPermissions } from '@/features/library/domain/library-permissions.policy';
import { useLibraryCountsQuery } from '@/features/library/sdk/queries/catalog.queries';
import type { LibraryPermissions } from '@/features/library/domain/types/core.types';
import {
  updateLibrarySchemaRegistry,
  setSchemaPersistenceListener,
} from '@/features/library/domain/types/core.types';

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

/**
 * Permissions Coordinator Hook
 *
 * Single Source of Truth for combining Client Scope (Zustand Store),
 * Server Permissions & Capability Counts (TanStack Query), and Pure RBAC Policies.
 * Decoupled from pure Zustand Store selectors.
 */
export function useLibraryPermissions(): LibraryPermissions {
  const activeScope = useLibraryUIStore((state) => state.activeScope);
  const effectiveScopeId = activeScope.type === 'project' ? activeScope.id : 'user';
  const { data: countsData } = useLibraryCountsQuery(effectiveScopeId);

  return useMemo(
    () =>
      resolveEffectiveLibraryPermissions(
        activeScope,
        countsData
          ? {
              role: countsData.role || countsData.yourRole,
              permissions: countsData.permissions,
              effectivePermissions: countsData.effectivePermissions,
              permissionOverrides: countsData.permissionOverrides,
            }
          : null,
      ),
    [activeScope, countsData],
  );
}

/**
 * Centralized Storage Adapter for Zotero Schema v42 Client-Side Bootstrap Cache.
 * Isolates browser localStorage side effects away from pure domain/types modules.
 */
export const SCHEMA_CACHE_KEY = 'flux:library:schema-v42:cache';
export const SCHEMA_VERSION = 42;
export const SCHEMA_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

let memorySchemaSnapshot: unknown | null | undefined = undefined;

export function saveSchemaCache(data: unknown): void {
  if (!data) return;
  memorySchemaSnapshot = data;
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(
      SCHEMA_CACHE_KEY,
      JSON.stringify({
        version: SCHEMA_VERSION,
        timestamp: Date.now(),
        data,
      }),
    );
  } catch {
    // Gracefully handle storage quota or private browsing mode
  }
}

export function loadSchemaCache(): unknown | null {
  if (memorySchemaSnapshot !== undefined && memorySchemaSnapshot !== null) {
    return memorySchemaSnapshot;
  }
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(SCHEMA_CACHE_KEY);
    if (!raw) {
      memorySchemaSnapshot = null;
      return null;
    }
    const parsed = JSON.parse(raw) as {
      version?: number;
      timestamp?: number;
      data?: unknown;
    } | null;

    const isValid =
      parsed !== null &&
      typeof parsed === 'object' &&
      parsed.version === SCHEMA_VERSION &&
      Boolean(parsed.data) &&
      typeof parsed.timestamp === 'number' &&
      Date.now() - parsed.timestamp <= SCHEMA_MAX_AGE_MS;

    if (!isValid) {
      window.localStorage.removeItem(SCHEMA_CACHE_KEY);
      memorySchemaSnapshot = null;
      return null;
    }

    memorySchemaSnapshot = parsed.data;
    return memorySchemaSnapshot;
  } catch {
    try {
      window.localStorage.removeItem(SCHEMA_CACHE_KEY);
    } catch {
      // ignore
    }
    memorySchemaSnapshot = null;
    return null;
  }
}

// Register storage persistence listener with domain layer
setSchemaPersistenceListener(saveSchemaCache);

// Immediately hydrate domain registry from cached schema if available
if (isBrowser()) {
  const cached = loadSchemaCache();
  if (cached) {
    updateLibrarySchemaRegistry(cached, { persist: false });
  }
}
