export type ProjectMemberRole = 'owner' | 'contributor' | 'commenter' | 'viewer';

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';

export interface ProjectInvitation {
  id: string;
  projectId: string;
  email: string;
  role: ProjectMemberRole;
  tokenHash: string;
  status: InvitationStatus;
  invitedById: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  project: {
    id: string;
    name: string;
    identifier: string;
    avatar: string | null;
    description: string | null;
  };
  inviter?: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  } | null;
}

export interface JoinByCodeInput {
  code: string;
}

export interface CreateInvitationInput {
  email: string;
  role?: ProjectMemberRole;
}
