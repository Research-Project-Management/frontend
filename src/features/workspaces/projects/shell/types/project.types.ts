export interface ProjectMemberUser {
  _id: string;
  name: string;
  email?: string;
  avatar?: string;
}

export interface ProjectMember {
  user?: ProjectMemberUser;
  userId?: string | ProjectMemberUser;
  role: string;
  joinedAt: string;
}

export interface Workspace {
  _id: string;
  name: string;
}

export interface Project {
  _id: string;
  name: string;
  description: string;
  avatar?: string;
  isActive?: boolean;
  modules: string[];
  workspace?: string;
  workspaceId?: string | Workspace;
  members: ProjectMember[];
  createdBy?: {
    _id: string;
    name: string;
    email?: string;
    avatar?: string;
  };
  settings?: {
    parallelCycles?: boolean;
    isPrivate?: boolean;
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
  key?: string;
}

export type ProjectRole = "owner" | "manager" | "lead" | "member" | "viewer";
