import { apiDelete, apiGet, apiPost, apiPut } from '@/shared/lib/api';
import type {
  AddMemberBodyInput,
  UpdateMemberRoleBodyInput,
} from '@/features/workspaces/settings/schemas/settings.schema';

export const getWorkspaceMembers = async (workspaceId: string) => {
  return apiGet<any[]>(`/api/workspace/${workspaceId}/members`);
};

export const addWorkspaceMember = async (
  workspaceId: string,
  payload: AddMemberBodyInput,
) => {
  return apiPost<any>(`/api/workspace/${workspaceId}/members`, payload);
};

export const updateWorkspaceMemberRole = async (
  workspaceId: string,
  userId: string,
  payload: UpdateMemberRoleBodyInput,
) => {
  return apiPut<any>(`/api/workspace/${workspaceId}/members/${userId}`, payload);
};

export const removeWorkspaceMember = async (
  workspaceId: string,
  userId: string,
) => {
  return apiDelete<any>(`/api/workspace/${workspaceId}/members/${userId}`);
};

export const generateInviteCode = async (workspaceId: string) => {
  return apiPost<{ inviteCode: string }>(
    `/api/workspace/${workspaceId}/invite-code`,
  );
};

export const disableInviteCode = async (workspaceId: string) => {
  return apiDelete<{ message: string }>(
    `/api/workspace/${workspaceId}/invite-code`,
  );
};

export const joinWorkspaceByCode = async (inviteCode: string) => {
  return apiPost<{ workspace: any; yourRole?: string }>(
    `/api/workspace/join/code`,
    { inviteCode },
  );
};

export const leaveWorkspace = async (workspaceId: string) => {
  return apiPost<{ message: string }>(`/api/workspace/${workspaceId}/leave`);
};

export const inviteWorkspaceMembers = async (
  workspaceId: string,
  payload: { emails: string[]; role: string },
) => {
  return apiPost<{
    message: string;
    invitations: any[];
    skipped: { email: string; reason: string }[];
  }>(`/api/workspace/${workspaceId}/invitations`, payload);
};

export const getWorkspacePendingInvites = async (workspaceId: string) => {
  const res = await apiGet<{ invitations: any[] }>(
    `/api/workspace/${workspaceId}/invitations`,
  );
  return res.invitations || [];
};

export const getWorkspaceInvitations = getWorkspacePendingInvites;

export const createWorkspaceInvitation = async (
  workspaceId: string,
  payload: { email: string; role?: string; expiresInDays?: number },
) => {
  return apiPost<{ message: string; invitation: any }>(
    `/api/workspace/${workspaceId}/invitations`,
    payload,
  );
};

export const revokeWorkspaceInvite = async (
  workspaceId: string,
  invitationId: string,
) => {
  return apiDelete<{ message: string }>(
    `/api/workspace/${workspaceId}/invitations/${invitationId}`,
  );
};

export const revokeWorkspaceInvitation = revokeWorkspaceInvite;

export const getInvitationByToken = async (token: string) => {
  return apiGet<{
    invitation: any;
    workspace: any;
    invitedBy?: any;
  }>(`/api/workspace/invitations/token/${token}`);
};

export const acceptInvitationByToken = async (token: string) => {
  return apiPost<{
    message: string;
    workspace: { id: string; name: string; url: string };
  }>(`/api/workspace/invitations/token/${token}/accept`);
};

export const declineInvitationByToken = async (token: string) => {
  return apiPost<{ message: string }>(
    `/api/workspace/invitations/token/${token}/decline`,
  );
};
