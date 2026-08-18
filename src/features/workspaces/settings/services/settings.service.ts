import { apiGet, apiPost, apiPut, apiDelete } from '@/shared/lib/api';
import type {
  AddMemberBody,
  UpdateMemberRoleBody,
  GeneralSettingsFormValues,
} from '../types/settings.types';
import type { WorkspaceMemberResponse } from '../types/member.types';

export const getWorkspace = async (workspaceId: string) => {
  return apiGet<{ workspace: any; yourRole?: string }>(`/api/workspace/${workspaceId}`);
};

export const updateWorkspace = async (
  workspaceId: string,
  payload: Partial<GeneralSettingsFormValues> & { companySize?: string },
) => {
  return apiPut<{ workspace: any }>(`/api/workspace/${workspaceId}`, payload);
};

export const deleteWorkspace = async (workspaceId: string) => {
  return apiDelete<{ message: string }>(`/api/workspace/${workspaceId}`);
};

export const getWorkspaceMembers = async (workspaceId: string) => {
  const res = await apiGet<{ members: WorkspaceMemberResponse[] }>(
    `/api/workspace/${workspaceId}/members`,
  );
  return res.members || [];
};

export const addWorkspaceMember = async (
  workspaceId: string,
  payload: AddMemberBody,
) => {
  return apiPost<{ message: string; member: WorkspaceMemberResponse }>(
    `/api/workspace/${workspaceId}/members`,
    payload,
  );
};

export const updateWorkspaceMemberRole = async (
  workspaceId: string,
  userId: string,
  payload: UpdateMemberRoleBody,
) => {
  return apiPut<{ message: string; member: WorkspaceMemberResponse }>(
    `/api/workspace/${workspaceId}/members/${userId}`,
    payload,
  );
};

export const removeWorkspaceMember = async (
  workspaceId: string,
  userId: string,
) => {
  return apiDelete<{ message: string }>(
    `/api/workspace/${workspaceId}/members/${userId}`,
  );
};

export const leaveWorkspace = async (workspaceId: string) => {
  return apiPost<{ message: string }>(`/api/workspace/${workspaceId}/leave`);
};

export const joinWorkspaceByCode = async (inviteCode: string) => {
  return apiPost<{ workspace: any; yourRole?: string }>(
    `/api/workspace/join/code`,
    { inviteCode },
  );
};
