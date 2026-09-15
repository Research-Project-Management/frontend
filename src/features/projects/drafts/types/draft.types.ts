export type WorkItemPriority = 'urgent' | 'high' | 'medium' | 'low' | 'none';


export interface ProjectSummary {
  id: string;
  name: string;
  identifier: string;
  workItemColumns?: Array<{
    id: string;
    name: string;
    color?: string;
    order?: number;
  }>;
  columns?: Array<{
    id: string;
    name: string;
    color?: string;
    order?: number;
  }>;
}

export interface WorkItemDraft {
  id: string;
  title: string;
  content: string | null;
  description: string | null;
  columnId: string | null;
  priority: WorkItemPriority;
  startDate: string | null;
  dueDate: string | null;
  labels: string[];
  assigneeId: string | null;
  assigneeIds: string[];
  metadata?: Record<string, any>;
  projectId: string | null;
  project?: ProjectSummary | null;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDraftInput {
  title?: string;
  content?: string;
  description?: string;
  projectId?: string;
  columnId?: string;
  priority?: WorkItemPriority;
  startDate?: string;
  dueDate?: string;
  labels?: string[];
  assigneeId?: string;
  assigneeIds?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateDraftInput {
  title?: string;
  content?: string;
  description?: string;
  projectId?: string;
  columnId?: string;
  priority?: WorkItemPriority;
  startDate?: string;
  dueDate?: string;
  labels?: string[];
  assigneeId?: string;
  assigneeIds?: string[];
  metadata?: Record<string, any>;
}

export interface PublishDraftInput {
  projectId?: string;
  columnId?: string;
  cycleId?: string;
  title?: string;
  priority?: WorkItemPriority;
}

export interface DraftQueryFilter {
  projectId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface DraftListResponse {
  total: number;
  drafts: WorkItemDraft[];
}

export type DraftsViewMode = 'list' | 'grid';
