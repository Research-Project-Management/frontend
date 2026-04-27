export interface Tag {
  id: string;
  name: string;
  color: string;
  projectId: string;
  createdBy: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt: string;
}