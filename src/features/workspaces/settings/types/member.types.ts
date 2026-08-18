import type { WorkspaceRole } from '../schemas/settings.schema';

export type { WorkspaceRole };

export interface WorkspaceMemberUser {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  displayName?: string | null;
  authProvider?: string;
}

export interface WorkspaceMemberItem {
  id: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: string;
  authProvider?: string;
  user: WorkspaceMemberUser;
}

export interface WorkspacePendingInvite {
  id: string;
  email: string;
  role: WorkspaceRole;
  createdAt: string;
}

export interface WorkspaceMemberResponse {
  id: string;
  userId: string;
  role: WorkspaceRole | string;
  joinedAt?: string;
  createdAt?: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    displayName?: string;
  };
}
