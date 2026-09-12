export type LabelType = 'sticky' | 'cycle' | 'task';

export interface Label {
  id: string;
  name: string;
  color: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  type?: LabelType;
  projectId?: string | null;
  workspaceId?: string;
  createdById?: string;
  createdAt?: string;
  updatedAt?: string;
  children?: Label[];
  parent?: Label | null;
}

export interface CreateLabelInput {
  name: string;
  color?: string;
  description?: string;
  parentId?: string | null;
  sortOrder?: number;
  type?: LabelType;
}

export interface UpdateLabelInput {
  name?: string;
  color?: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  type?: LabelType;
}

export interface CreateProjectLabelInput {
  name: string;
  color?: string;
  description?: string;
  parentId?: string | null;
  sortOrder?: number;
}

export interface UpdateProjectLabelInput {
  name?: string;
  color?: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder?: number;
}

export interface ReorderLabelItem {
  id: string;
  sortOrder: number;
}

export interface ImportLabelRow {
  name: string;
  color?: string;
  description?: string;
}

export interface ImportLabelResult {
  created: number;
  skipped: number;
  failed: number;
  labels: Label[];
}
