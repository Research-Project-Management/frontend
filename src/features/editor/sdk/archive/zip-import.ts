/**
 * zip-import.ts
 *
 * GoF Chain of Responsibility (Pre-flight Archive Validation) + Observer Pattern (`ImportProgressSubject`)
 * for authoritative server-side project ZIP import (`POST /api/v1/pages/spaces/:spaceId/import/zip`).
 */

import { exportDocs } from '../pages/export.client';
import type { ImportProjectZipResult } from '../pages/types';
import { ProjectService } from '@/features/projects/shell/services/project.service';

const MAX_CLIENT_ARCHIVE_BYTES = 500 * 1024 * 1024;

const TEXT_EXTENSIONS = new Set([
  'tex', 'ltx', 'bib', 'bst', 'cls', 'sty', 'def', 'cfg', 'clo', 'fd',
  'bbx', 'cbx', 'lbx', 'dbx', 'ist', 'glo', 'gls', 'acr', 'alg', 'rtex',
  'rnw', 'knw', 'tikz', 'pgf', 'asy', 'mp', 'txt', 'md', 'markdown',
  'rst', 'csv', 'tsv', 'dat', 'json', 'yml', 'yaml', 'toml', 'ini',
  'xml', 'html', 'htm', 'css', 'svg', 'sh', 'py', 'r', 'lua', 'pl',
  'rb', 'js', 'ts', 'c', 'cpp', 'h', 'hpp', 'java', 'sql', 'gitignore',
  'latexmkrc', 'dtx', 'ins',
]);

export interface ImportZipProgress {
  phase: 'creating_project' | 'uploading' | 'done';
  message: string;
  current: number;
  total: number;
}

export type ImportProgressObserver = (progress: ImportZipProgress) => void;

/**
 * GoF Observer Pattern: Decouples import progress emission from UI subscribers.
 */
export class ImportProgressSubject {
  private readonly observers = new Set<ImportProgressObserver>();

  public subscribe(observer?: ImportProgressObserver): () => void {
    if (!observer) return () => {};
    this.observers.add(observer);
    return () => {
      this.observers.delete(observer);
    };
  }

  public notify(
    phase: ImportZipProgress['phase'],
    message: string,
    current: number,
    total = 2,
  ): void {
    const payload: ImportZipProgress = { phase, message, current, total };
    for (const observer of this.observers) {
      observer(payload);
    }
  }
}

/**
 * GoF Chain of Responsibility: Sequential pre-flight validation before uploading ZIP payload.
 */
abstract class ZipUploadValidationHandler {
  private nextHandler: ZipUploadValidationHandler | null = null;

  public setNext(next: ZipUploadValidationHandler): ZipUploadValidationHandler {
    this.nextHandler = next;
    return next;
  }

  public validate(file: File | Blob | undefined): void {
    this.check(file);
    this.nextHandler?.validate(file);
  }

  protected abstract check(file: File | Blob | undefined): void;
}

class NonEmptyZipUploadValidator extends ZipUploadValidationHandler {
  protected check(file: File | Blob | undefined): void {
    if (!file || file.size === 0) {
      throw new Error('A non-empty ZIP archive file is required for import.');
    }
  }
}

class MaxZipUploadSizeValidator extends ZipUploadValidationHandler {
  protected check(file: File | Blob | undefined): void {
    if (file && file.size > MAX_CLIENT_ARCHIVE_BYTES) {
      throw new Error('ZIP archive exceeds maximum allowed size of 500 MB.');
    }
  }
}

const ZIP_PREFLIGHT_VALIDATOR: ZipUploadValidationHandler = (() => {
  const head = new NonEmptyZipUploadValidator();
  head.setNext(new MaxZipUploadSizeValidator());
  return head;
})();

export interface ImportZipOptions {
  zipFile: File | Blob;
  projectName?: string;
  projectId?: string;
  parentPageId?: string;
  preferredRootDoc?: string;
  onProgress?: ImportProgressObserver;
}

export function isZipFile(file: File | Blob | string): boolean {
  if (typeof file === 'string') {
    const clean = file.split('?')[0].split('#')[0].toLowerCase();
    return clean.endsWith('.zip');
  }
  if (file instanceof File && file.name.toLowerCase().endsWith('.zip')) {
    return true;
  }
  const mime = file.type ? file.type.toLowerCase() : '';
  return (
    mime === 'application/zip' ||
    mime === 'application/x-zip-compressed' ||
    mime === 'multipart/x-zip' ||
    mime === 'application/x-zip'
  );
}

export function isTextFile(path: string): boolean {
  const ext = (path.split('.').pop() || '').toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

export function inferArchiveProjectName(
  file: File | Blob,
  fallback = 'Imported Project',
): string {
  if (file instanceof File && file.name) {
    const base = file.name.replace(/\.zip$/i, '').trim();
    if (base) return base;
  }
  return fallback;
}

function extractCreatedProjectId(res: unknown): string {
  if (!res || typeof res !== 'object') return '';
  const obj = res as Record<string, unknown>;
  if (obj.project && typeof obj.project === 'object' && 'id' in obj.project) {
    return String((obj.project as { id: unknown }).id);
  }
  if (obj.data && typeof obj.data === 'object' && 'id' in obj.data) {
    return String((obj.data as { id: unknown }).id);
  }
  if ('id' in obj && obj.id) {
    return String(obj.id);
  }
  return '';
}

export async function importZipToProject({
  zipFile,
  projectName,
  projectId: existingProjectId,
  parentPageId,
  preferredRootDoc,
  onProgress,
}: ImportZipOptions): Promise<{
  projectId: string;
  rootPageId: string;
  mainFileId?: string;
  summary: ImportProjectZipResult;
}> {
  ZIP_PREFLIGHT_VALIDATOR.validate(zipFile);

  const progressSubject = new ImportProgressSubject();
  const unsubscribe = progressSubject.subscribe(onProgress);

  try {
    const finalProjectName =
      projectName?.trim() ||
      inferArchiveProjectName(zipFile, 'Imported LaTeX Project');

    let targetProjectId = existingProjectId?.trim() || '';
    if (!targetProjectId && !parentPageId) {
      progressSubject.notify(
        'creating_project',
        `Creating project "${finalProjectName}"...`,
        0,
      );
      const created = await ProjectService.create({
        name: finalProjectName,
        modules: ['pages', 'work-items'],
      });
      targetProjectId = extractCreatedProjectId(created);
      if (!targetProjectId) {
        throw new Error('Could not initialize project container.');
      }
    }

    const targetSpaceId = targetProjectId || parentPageId || '';
    if (!targetSpaceId) {
      throw new Error('Target space ID is required for ZIP import.');
    }

    progressSubject.notify(
      'uploading',
      `Importing "${finalProjectName}" on server...`,
      1,
    );
    const summary = await exportDocs.importProjectZip(targetSpaceId, zipFile, {
      ...(preferredRootDoc ? { preferredRootDoc } : {}),
      ...(parentPageId ? { pageId: parentPageId } : {}),
    });

    const rootPageId = summary.rootDocId || parentPageId || '';
    progressSubject.notify('done', 'Imported project archive successfully.', 2);

    return {
      projectId: summary.projectId || targetSpaceId,
      rootPageId,
      mainFileId: summary.rootDocId || undefined,
      summary,
    };
  } finally {
    unsubscribe();
  }
}
