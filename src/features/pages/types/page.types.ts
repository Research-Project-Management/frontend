export type PageStatus = 'draft' | 'published' | 'archived';

export type PagesViewMode = 'grid' | 'list';

export interface PageLabelItem {
  id: string;
  name: string;
  color?: string;
}

export interface PageAuthor {
  id?: string;
  name?: string;
  email?: string;
  avatar?: string;
}

export interface Page {
  id: string;
  title: string;
  description?: string;
  content?: unknown;
  status?: PageStatus;
  thumbnail?: string;
  pdfThumbnail?: string;
  labels?: Array<PageLabelItem | string>;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  spaceId?: string;
  projectId?: string;
  mainFileId?: string | null;
  mainFile?: string | { id: string; title?: string };
  author?: PageAuthor;
}

export interface CreatePageInput {
  spaceId: string;
  title: string;
  content?: string;
  status?: PageStatus;
  labelIds?: string[];
  templateType?: 'blank' | 'example';
}

export interface CreatePageResponse {
  page: Page;
  mainFile?: { id: string; [key: string]: unknown } | string | null;
  rootPageId: string;
  mainFileId: string | null;
}

