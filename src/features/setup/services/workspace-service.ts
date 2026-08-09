/**
 * workspace-service.ts
 *
 * Raw network layer for the setup/workspace domain.
 * Only exposes operations that are unique to onboarding.
 *
 * NOTE: `updateWorkspace` and `deleteWorkspace` mutations with optimistic-update
 * and cache-sync logic already exist in `@/features/workspaces`.
 * Import `useUpdateWorkspace` / `useDeleteWorkspace` from there instead.
 */

import { apiPost, apiPatch } from '@/shared/lib/api';
import type { CreateWorkspaceSchema, UpdateWorkspaceSchema } from '../schemas/workspace-schemas';
import type { Workspace } from '../types/workspace-types';

// ─── createWorkspace ──────────────────────────────────────────────────────────

/** Creates a new workspace and returns the created workspace object. */
export async function createWorkspace(data: CreateWorkspaceSchema): Promise<Workspace> {
  const json = await apiPost<{ workspace: Workspace }>('/api/workspace', data);
  return json.workspace;
}

// ─── updateWorkspace ──────────────────────────────────────────────────────────

/** Partially updates a workspace by ID. Prefer `useUpdateWorkspace` hook for cache-aware mutations. */
export async function updateWorkspace(id: string, data: UpdateWorkspaceSchema): Promise<Workspace> {
  const json = await apiPatch<{ workspace: Workspace }>(`/api/workspace/${id}`, data);
  return json.workspace;
}
