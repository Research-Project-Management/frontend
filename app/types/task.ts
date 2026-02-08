export type Column = {
  id: string;
  title: string;
  isDefault: boolean;
  accentColor?: string;
};

export type Task = {
  _id: string;
  title: string;
  content: string;
  project: string;
  columnId: string;
  assignee?: {
    _id: string;
    name: string;
    avatar?: string;
  };
  dueDate?: string;
  labels: string[];
  rank: number;
  author: string;
  createdAt: string;
  updatedAt: string;
};
