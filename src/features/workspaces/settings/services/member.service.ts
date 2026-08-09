import { apiPost, apiPut, apiDelete } from '@/shared/lib/api';

// ── Raw fetchers — Member management (Infrastructure layer) ───────────────────
// Member operations are a Settings concern.
// `syncWorkspaceIntoCaches` stays in shell (workspace data layer) and is
// accessed via the public barrel @/features/workspaces.

export const addWorkspaceMember = (
  workspaceId: string,
  userId: string,
  role: string,
) => apiPost(`/api/workspace/${workspaceId}/members`, { userId, role });

export const updateWorkspaceMemberRole = (
  workspaceId: string,
  userId: string,
  newRole: string,
) => apiPut(`/api/workspace/${workspaceId}/members/${userId}/role`, { role: newRole });

export const removeWorkspaceMember = (workspaceId: string, userId: string) =>
  apiDelete(`/api/workspace/${workspaceId}/members/${userId}`);
