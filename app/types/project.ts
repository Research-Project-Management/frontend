export interface ProjectMember {
  user: string | {
    _id: string;
    name: string;
    email: string | null;
    avatar: string | null;
  };
  role: "manager" | "member" | "viewer";
  joinedAt: string;
}

export interface Workspace {
  _id: string;
  name: string;
}

export interface Project {
  _id: string;
  name: string;
  avatar: string | null;
  description: string;
  modules: string[];
  workspace: string | Workspace;
  members: ProjectMember[];
  settings?: {
    parallelCycles?: boolean;
    [key: string]: any;
  };
  createdAt: string;
  updatedAt: string;
}

export type ProjectRole = "manager" | "member" | "viewer";
