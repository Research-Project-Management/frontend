export type ViewLayoutMode = 'board' | 'list' | 'calendar' | 'table' | 'timeline';
export type ViewAccessType = 'public' | 'private';

export interface ViewCreator {
  id: string;
  name: string;
  avatar?: string | null;
  email?: string | null;
}

export interface WorkItemViewItem {
  id: string;
  name: string;
  description?: string | null;
  layout: ViewLayoutMode;
  filters?: Record<string, unknown>;
  displayProperties?: Record<string, unknown>;
  access: ViewAccessType;
  isFavorite?: boolean;
  projectId: string;
  createdById: string;
  createdBy?: ViewCreator;
  createdAt: string;
  updatedAt: string;
}

export interface CreateViewInput {
  name: string;
  description?: string;
  layout?: ViewLayoutMode;
  filters?: Record<string, unknown>;
  displayProperties?: Record<string, unknown>;
  access?: ViewAccessType;
}

export interface UpdateViewInput {
  name?: string;
  description?: string | null;
  layout?: ViewLayoutMode;
  filters?: Record<string, unknown>;
  displayProperties?: Record<string, unknown>;
  access?: ViewAccessType;
}

export interface QueryViewInput {
  access?: ViewAccessType;
  isFavorite?: boolean;
  search?: string;
}
