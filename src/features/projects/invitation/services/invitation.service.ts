import { apiGet, apiPost, apiDelete } from '@/shared/lib/api';
import type {
  ProjectInvitation,
  CreateInvitationInput,
  JoinByCodeInput,
} from '../types/invitation.types';

// ── Query Keys Factory ────────────────────────────────────────────────────────

export const invitationKeys = {
  myInvitations: ['project-invitations', 'me'] as const,
  projectInvitations: (projectId: string) =>
    ['project-invitations', projectId] as const,
};

// ── HTTP API Methods ──────────────────────────────────────────────────────────

/**
 * Fetch all pending incoming invitations for the current user.
 */
export const fetchMyInvitations = async (signal?: AbortSignal) => {
  return apiGet<ProjectInvitation[]>('/api/projects/invitations/me', { signal });
};

/**
 * Accept an incoming project invitation.
 */
export const acceptProjectInvitation = async (invitationId: string) => {
  return apiPost<{ message: string; projectId: string }>(
    `/api/projects/invitations/${invitationId}/accept`,
    {},
  );
};

/**
 * Decline an incoming project invitation.
 */
export const declineProjectInvitation = async (invitationId: string) => {
  return apiPost<{ message: string }>(
    `/api/projects/invitations/${invitationId}/decline`,
    {},
  );
};

/**
 * Join a project via invite code, token, or project identifier.
 */
export const joinProjectByCode = async (data: JoinByCodeInput) => {
  return apiPost<{ message: string; projectId: string }>(
    '/api/projects/invitations/join',
    data,
  );
};

/**
 * Fetch invitations for a specific project (owner view).
 */
export const fetchProjectInvitations = async (
  projectId: string,
  signal?: AbortSignal,
) => {
  return apiGet<ProjectInvitation[]>(`/api/projects/${projectId}/invitations`, {
    signal,
  });
};

/**
 * Invite someone to a project.
 */
export const createProjectInvitation = async (
  projectId: string,
  data: CreateInvitationInput,
) => {
  return apiPost<{ message: string; invitation: ProjectInvitation; token: string }>(
    `/api/projects/${projectId}/invitations`,
    data,
  );
};

/**
 * Revoke an outgoing invitation.
 */
export const revokeProjectInvitation = async (
  projectId: string,
  invitationId: string,
) => {
  return apiDelete<{ message: string }>(
    `/api/projects/${projectId}/invitations/${invitationId}`,
  );
};
