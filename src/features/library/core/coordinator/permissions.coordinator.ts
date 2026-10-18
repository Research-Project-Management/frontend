import { useMemo } from 'react';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { resolveEffectiveLibraryPermissions } from '@/features/library/domain/library-permissions.policy';
import { useLibraryCountsQuery } from '@/features/library/sdk/queries/catalog.queries';
import type { LibraryPermissions } from '@/features/library/domain/types/core.types';

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
