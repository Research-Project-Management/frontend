export interface WorkspaceMember {
  userId: string | {
    _id: string;
    name: string;
    email: string | null;
    avatar: string | null;
  };
  role: "owner" | "admin" | "member";
  joinedAt: string;
}

export interface Workspace {
  _id: string;
  name: string;
  url: string;
  avatar: string;
  members: WorkspaceMember[];
  createdAt: string;
  updatedAt: string;
}

export type WorkspaceRole = "owner" | "admin" | "member";
