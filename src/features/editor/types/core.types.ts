/**
 * core.types.ts
 *
 * Core document & page domain models matching backend document/page module.
 */

declare const brand: unique symbol;
export type Brand<T, B> = T & { readonly [brand]: B };

export type PageId = Brand<string, 'PageId'>;
export type ProjectId = Brand<string, 'ProjectId'>;
export type FileId = Brand<string, 'FileId'>;

export type DocumentContent =
  | string
  | {
      source?: string;
      text?: string;
      content?: string;
    };

export type PageStatus = 'draft' | 'published' | 'archived';

export interface PageAuthor {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
}

export interface PageProjectContext {
  id: string;
  name: string;
}

export interface Page {
  id: string;
  title: string;
  content: DocumentContent; // LaTeX source text or JSON structure
  status: PageStatus;
  projectId: string | PageProjectContext;
  author: PageAuthor;
  views: number;
  lastAccessedAt: string;
  createdAt: string;
  updatedAt: string;
  /** Null = top-level page-project. Populated = this is a file inside a page-project. */
  parentPage?: string | null;
  /** The child page designated as the main entry point (for compilation & thumbnail). Can be a full Page object when populated. */
  mainFile?: string | Page | null;
  /** Base64 JPEG data URL of the first page of the last successful PDF build. */
  pdfThumbnail?: string | null;
}

export interface PageFile {
  id: string;
  title: string;
  content?: string;
  pageId: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface SetMainFileInput {
  mainFileId: string;
}

export interface UpdateThumbnailInput {
  pdfThumbnail: string;
}
