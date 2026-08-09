/**
 * setup/services/workspace-service.ts
 *
 * Onboarding-specific workspace operations.
 *
 * NOTE:
 * - `createWorkspace` → defined in @/features/workspaces (shell), import from there.
 * - `updateWorkspace` / `deleteWorkspace` → use hooks `useUpdateWorkspace` / `useDeleteWorkspace`
 *    from @/features/workspaces — they include optimistic update + cache sync.
 */

import { apiPatch } from '@/shared/lib/api';
import type { UpdateWorkspaceSchema } from '../schemas/workspace-schemas';
import type { Workspace } from '../types/workspace-types';

// ─── updateWorkspace ──────────────────────────────────────────────────────────

/**
 * Partially updates a workspace by ID.
 * Prefer `useUpdateWorkspace` hook from @/features/workspaces for cache-aware mutations.
 * Use this only for one-off non-reactive updates (e.g., onboarding step).
 */
export async function updateWorkspace(id: string, data: UpdateWorkspaceSchema): Promise<Workspace> {
  const json = await apiPatch<{ workspace: Workspace }>(`/api/workspace/${id}`, data);
  return json.workspace;
}
