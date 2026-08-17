export interface ProjectMemberUser {
  id?: string;
  _id?: string;
  name: string;
  email?: string;
  avatar?: string;
}

export interface ProjectMember {
  id?: string;
  _id?: string;
  user?: ProjectMemberUser;
  userId?: string | ProjectMemberUser;
  role: string;
  joinedAt: string;
}

export interface Workspace {
  id?: string;
  _id?: string;
  name: string;
  slug?: string;
}

export interface ProjectSettings {
  parallelCycles?: boolean;
  isPrivate?: boolean;
  [key: string]: any;
}

export interface Project {
  id?: string;
  _id: string;
  name: string;
  description: string;
  identifier?: string;
  key?: string;
  avatar?: string | null;
  cover?: string | null;
  isActive?: boolean;
  isArchived?: boolean;
  isFavorite?: boolean;
  favoritedBy?: string[];
  isPrivate?: boolean;
  timezone?: string;
  modules: string[];
  workspace?: string;
  workspaceId?: string | Workspace;
  members: ProjectMember[];
  createdBy?: {
    id?: string;
    _id?: string;
    name: string;
    email?: string;
    avatar?: string;
  };
  settings?: ProjectSettings;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  avatar?: string;
  cover?: string | null;
  description?: string;
  identifier?: string;
  isPrivate?: boolean;
  timezone?: string;
  modules?: string[];
}

export interface UpdateProjectInput {
  projectId: string;
  name?: string;
  description?: string;
  avatar?: string | null;
  cover?: string | null;
  identifier?: string;
  isPrivate?: boolean;
  timezone?: string;
  isArchived?: boolean;
  isFavorite?: boolean;
  modules?: string[];
  subscriberIds?: string[];
}

export type { ProjectRole } from '@/shared/types/iam.types';
