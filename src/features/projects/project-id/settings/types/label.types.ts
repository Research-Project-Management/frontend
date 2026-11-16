export type LabelType = 'work_item' | 'library' | 'page';

export interface Label {
  id: string;
  name: string;
  color: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  type?: LabelType | string;
  projectId?: string | null;
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
  type?: LabelType | string;
}

export interface UpdateLabelInput {
  name?: string;
  color?: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  type?: LabelType | string;
}

export interface CreateProjectLabelInput {
  name: string;
  color?: string;
  description?: string;
  parentId?: string | null;
  sortOrder?: number;
  type?: LabelType | string;
}

export interface UpdateProjectLabelInput {
  name?: string;
  color?: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder?: number;
  type?: LabelType | string;
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
