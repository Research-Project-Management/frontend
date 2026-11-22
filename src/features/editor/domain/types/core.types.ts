/**
 * core.types.ts
 *
 * Core document & page domain models, UX validation schemas, and inferred DTOs.
 */

import { z } from 'zod';

export const createFileSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'File name is required')
    .max(255, 'File name is too long')
    .refine((name) => !name.includes('\\'), 'Backslashes are not allowed in file names'),
  content: z.string().optional(),
});

// UX prefilter allowing Unicode (e.g. Vietnamese) letters/digits; backend SafePath enforces security.
const SAFE_FOLDER_SEGMENT_REGEX = /^[\p{L}\p{N}._ -]+$/u;

export const createFolderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Folder name is required')
    .max(255, 'Folder name is too long')
    .refine((name) => !name.includes('\\'), 'Backslashes are not allowed in folder names')
    .transform((val) =>
      val
        .trim()
        .replace(/\\/g, '/')
        .replace(/^(\.\/+|\/+)/, '')
        .replace(/\/+/g, '/')
        .replace(/\/+$/, '')
        .trim(),
    )
    .refine(
      (val) => {
        if (!val) return false;
        const segments = val.split('/');
        return segments.every(
          (seg) =>
            seg.length > 0 &&
            seg !== '.' &&
            seg !== '..' &&
            SAFE_FOLDER_SEGMENT_REGEX.test(seg),
        );
      },
      'Folder name contains invalid path segments',
    ),
});

export const renameItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(255, 'Name is too long')
    .refine((name) => !name.includes('\\'), 'Backslashes are not allowed in names'),
});

declare const brand: unique symbol;
export type Brand<T, B> = T & { readonly [brand]: B };

export type SpaceId = Brand<string, 'SpaceId'>;
export type DocId = Brand<string, 'DocId'>;
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
  path?: string;
  content: DocumentContent; // LaTeX source text or JSON structure
  status: PageStatus;
  projectId: string | PageProjectContext;
  spaceId?: string;
  rev?: number;
  version?: number;
  hash?: string | null;
  sizeBytes?: number;
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
  path?: string;
  content?: string;
  pageId: string;
  projectId?: string | PageProjectContext;
  spaceId?: string;
  rev?: number;
  version?: number;
  hash?: string | null;
  sizeBytes?: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  url?: string;
}

// ── Canonical Manuscript & LaTeX Domain Models (Overleaf Parity) ────────────

export interface TextDocument {
  id: string;
  projectId: string;
  spaceId?: string;
  pageId?: string;
  path: string;
  title: string;
  content: string;
  rev?: number;
  version?: number;
  isRootDoc?: boolean;
  updatedAt?: string;
}

/**
 * Safely extracts a string spaceId/projectId from a Page, PageFile, PageProjectContext, or raw string.
 */
export function extractProjectId(
  doc?:
    | Page
    | PageFile
    | PageProjectContext
    | { id?: string; spaceId?: string; projectId?: string | PageProjectContext }
    | string
    | null,
): string | undefined {
  if (!doc) return undefined;
  if (typeof doc === 'string') return doc;
  if ('projectId' in doc && doc.projectId) {
    if (typeof doc.projectId === 'string') return doc.projectId;
    return (doc.projectId as PageProjectContext).id;
  }
  if (
    'spaceId' in doc &&
    typeof (doc as { spaceId?: unknown }).spaceId === 'string' &&
    (doc as { spaceId: string }).spaceId
  ) {
    return (doc as { spaceId: string }).spaceId;
  }
  if (
    'id' in doc &&
    typeof doc.id === 'string' &&
    !('title' in doc) &&
    !('content' in doc) &&
    !('status' in doc) &&
    !('files' in doc) &&
    !('rootDocId' in doc) &&
    !('pageId' in doc)
  ) {
    return doc.id;
  }
  return undefined;
}

/**
 * Canonical Space extractor: prefers `spaceId` and falls back to `projectId`.
 */
export function extractSpaceId(
  doc?:
    | Page
    | PageFile
    | PageProjectContext
    | { id?: string; spaceId?: string; projectId?: string | PageProjectContext }
    | string
    | null,
): string | undefined {
  if (!doc) return undefined;
  if (typeof doc === 'string') return doc;
  if ('spaceId' in doc && typeof doc.spaceId === 'string' && doc.spaceId) {
    return doc.spaceId;
  }
  return extractProjectId(doc);
}

/**
 * Safely extracts raw string LaTeX or text content from DocumentContent union or nested object.
 */
export function extractDocumentContentString(content?: DocumentContent | unknown | null): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (typeof content === 'object') {
    const c = content as { source?: string; text?: string; content?: string; lines?: string[] };
    if (typeof c.source === 'string') return c.source;
    if (typeof c.text === 'string') return c.text;
    if (typeof c.content === 'string') return c.content;
    if (Array.isArray(c.lines)) return c.lines.join('\n');
  }
  return '';
}

export {
  newFileModalSchema,
  type NewFileModalFormValues,
  urlImportModalSchema,
  type UrlImportModalFormValues,
  libraryBibtexModalSchema,
  type LibraryBibtexModalFormValues,
  figureWizardSchema,
  type FigureWizardFormValues,
  tableWizardSchema,
  type TableWizardFormValues,
  pushChangesSchema,
  type PushChangesFormValues,
  linkRepoSchema,
  type LinkRepoFormValues,
  createRepoSchema,
  type CreateRepoFormValues,
  learnedWordSchema,
  type LearnedWordFormValues,
  projectRenameSchema,
  type ProjectRenameInput,
  projectCopySchema,
  type ProjectCopyInput,
} from './forms.types';
