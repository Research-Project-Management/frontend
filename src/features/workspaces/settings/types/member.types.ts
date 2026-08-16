export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer' | 'guest';

export interface WorkspaceMemberUser {
  id: string;
  _id?: string;
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
