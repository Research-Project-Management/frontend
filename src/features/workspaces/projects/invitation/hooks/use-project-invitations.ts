import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchMyInvitations,
  acceptProjectInvitation,
  declineProjectInvitation,
  joinProjectByCode,
  fetchProjectInvitations,
  createProjectInvitation,
  revokeProjectInvitation,
  invitationKeys,
} from '../services/invitation.service';
import type {
  CreateInvitationInput,
  JoinByCodeInput,
} from '../types/invitation.types';
import { getErrorMessage } from '@/shared/lib/utils';

/**
 * Hook to retrieve incoming project invitations for the current logged-in user.
 */
export function useMyProjectInvitations() {
  return useQuery({
    queryKey: invitationKeys.myInvitations,
    queryFn: ({ signal }) => fetchMyInvitations(signal),
    staleTime: 15_000,
  });
}

/**
 * Hook to accept an invitation.
 */
export function useAcceptProjectInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => acceptProjectInvitation(invitationId),
    onSuccess: (data) => {
      toast.success(data?.message || 'Successfully joined project');
      queryClient.invalidateQueries({ queryKey: invitationKeys.myInvitations });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects-header'] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err) || 'Failed to accept invitation');
    },
  });
}

/**
 * Hook to decline an invitation.
 */
export function useDeclineProjectInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => declineProjectInvitation(invitationId),
    onSuccess: () => {
      toast.info('Invitation declined');
      queryClient.invalidateQueries({ queryKey: invitationKeys.myInvitations });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err) || 'Failed to decline invitation');
    },
  });
}

/**
 * Hook to join a project with an invite code or identifier.
 */
export function useJoinProjectByCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: JoinByCodeInput) => joinProjectByCode(data),
    onSuccess: (data) => {
      toast.success(data?.message || 'Successfully joined project');
      queryClient.invalidateQueries({ queryKey: invitationKeys.myInvitations });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects-header'] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err) || 'Failed to join project');
    },
  });
}

/**
 * Hook to get invitations of a specific project (owner view).
 */
export function useProjectInvitations(projectId?: string) {
  return useQuery({
    queryKey: projectId ? invitationKeys.projectInvitations(projectId) : ['project-invitations', 'none'],
    queryFn: ({ signal }) => fetchProjectInvitations(projectId!, signal),
    enabled: Boolean(projectId),
  });
}

/**
 * Hook to create/send a new invitation for a project.
 */
export function useCreateProjectInvitation(projectId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateInvitationInput) => {
      if (!projectId) throw new Error('Project ID is required');
      return createProjectInvitation(projectId, data);
    },
    onSuccess: () => {
      toast.success('Invitation sent successfully');
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: invitationKeys.projectInvitations(projectId),
        });
      }
    },
    onError: (err) => {
      toast.error(getErrorMessage(err) || 'Failed to send invitation');
    },
  });
}

/**
 * Hook to revoke an outgoing invitation.
 */
export function useRevokeProjectInvitation(projectId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => {
      if (!projectId) throw new Error('Project ID is required');
      return revokeProjectInvitation(projectId, invitationId);
    },
    onSuccess: () => {
      toast.success('Invitation revoked');
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: invitationKeys.projectInvitations(projectId),
        });
      }
    },
    onError: (err) => {
      toast.error(getErrorMessage(err) || 'Failed to revoke invitation');
    },
  });
}
