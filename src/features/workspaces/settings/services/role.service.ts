import { apiGet, apiPost, apiPut, apiDelete } from '@/shared/lib/api';
import type { Role, Permission } from '@/features/workspaces';

// ── Raw fetchers (Infrastructure layer — no React hooks) ──────────────────────

export const fetchRoles = (workspaceId: string, signal?: AbortSignal) =>
  apiGet<{ roles: Role[] } | Role[]>(`/api/roles/${workspaceId}`, { signal });

export const fetchRoleById = (workspaceId: string, roleId: string, signal?: AbortSignal) =>
  apiGet<{ role: Role }>(`/api/roles/${workspaceId}/${roleId}`, { signal });

export const createRoleRequest = (
  workspaceId: string,
  roleData: { name: string; description: string; permissions: Permission[]; color?: string },
) => apiPost(`/api/roles/${workspaceId}`, roleData);

export const updateRoleRequest = (
  workspaceId: string,
  roleId: string,
  roleData: { name?: string; description?: string; permissions?: Permission[]; color?: string },
) => apiPut(`/api/roles/${workspaceId}/${roleId}`, roleData);

export const duplicateRoleRequest = (workspaceId: string, roleId: string) =>
  apiPost(`/api/roles/${workspaceId}/${roleId}/duplicate`);

export const deleteRoleRequest = (workspaceId: string, roleId: string) =>
  apiDelete(`/api/roles/${workspaceId}/${roleId}`);
