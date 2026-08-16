export type LabelType = 'sticky' | 'cycle' | 'task';

export interface Label {
  id: string;
  name: string;
  color: string;
  type?: LabelType;
  workspaceId?: string;
  createdById?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateLabelInput {
  name: string;
  color?: string;
  type?: LabelType;
}

export interface UpdateLabelInput {
  name?: string;
  color?: string;
  type?: LabelType;
}
