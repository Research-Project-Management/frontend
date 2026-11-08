export type ProjectArchiveTab = 'work-items' | 'pages';

export interface ArchivedWorkItem {
  id: string;
  identifier: string | null;
  title: string;
  priority: string | null;
  stateId: string | null;
  stateGroup: string | null;
  completed: boolean;
  archivedAt: string | null;
  updatedAt: string;
  projectId: string;
  assignee: {
    id: string;
    email: string | null;
    name: string | null;
    avatar: string | null;
  } | null;
}

export interface ArchivedPageItem {
  id: string;
  title: string;
  description: string;
  status: string;
  path: string;
  projectId: string;
  version: number;
  rev: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectScopedArchivesResponse {
  projectId: string;
  workItems: ArchivedWorkItem[];
  pages: ArchivedPageItem[];
  counts: {
    workItems: number;
    pages: number;
    total: number;
  };
}
