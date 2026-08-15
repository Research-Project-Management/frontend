import { apiPost, apiPut, apiDelete } from '@/shared/lib/api';
import { WorkspaceDetailResponseSchema } from '@/features/workspaces/shell/schemas/workspace.schema';
import type { WorkspaceRole } from '../schemas/settings.schema';

// ── Raw fetchers — Settings management (Infrastructure layer) ───────────────────
// Settings operations.
// `syncWorkspaceIntoCaches` stays in shell (workspace data layer) and is
// accessed via the public barrel @/features/workspaces.

export const addWorkspaceMember = async (
  workspaceId: string,
  payload: { userId: string; role: WorkspaceRole }
) => {
  const data = await apiPost(`/api/workspace/${workspaceId}/members`, payload);
  return WorkspaceDetailResponseSchema.parse(data);
};

export const updateWorkspaceMemberRole = async (
  workspaceId: string,
  userId: string,
  payload: { role: WorkspaceRole }
) => {
  const data = await apiPut(`/api/workspace/${workspaceId}/members/${userId}`, payload);
  return WorkspaceDetailResponseSchema.parse(data);
};

export const removeWorkspaceMember = async (
  workspaceId: string, 
  userId: string
) => {
  const data = await apiDelete(`/api/workspace/${workspaceId}/members/${userId}`);
  return WorkspaceDetailResponseSchema.parse(data);
};
