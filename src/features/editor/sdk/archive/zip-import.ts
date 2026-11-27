/**
 * zip-import.ts
 *
 * O(1) 4-byte PKZIP magic-header pre-flight check + authoritative server-side project ZIP import
 * (`POST /api/v1/pages/spaces/:spaceId/import/zip`).
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

export interface ImportZipOptions {
  zipFile: File | Blob;
  projectName?: string;
  projectId?: string;
  parentPageId?: string;
  preferredRootDoc?: string;
  onProgress?: (progress: ImportZipProgress) => void;
}

export function isZipFile(file: File | Blob | string): boolean {
  if (typeof file === 'string') {
    const qIdx = file.indexOf('?');
    const hIdx = file.indexOf('#');
    const cut =
      qIdx === -1 ? hIdx : hIdx === -1 ? qIdx : Math.min(qIdx, hIdx);
    const clean = (cut === -1 ? file : file.slice(0, cut)).toLowerCase();
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
  const dotIdx = path.lastIndexOf('.');
  if (dotIdx === -1) return false;
  return TEXT_EXTENSIONS.has(path.slice(dotIdx + 1).toLowerCase());
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

/**
 * O(1) time & 4-byte memory check verifying PKZIP magic signature (`0x50 0x4B` = 'PK')
 * before streaming multi-megabyte payloads over the network.
 */
async function assertPkzipMagicSignature(blob: File | Blob): Promise<void> {
  if (blob.size < 2 || typeof blob.slice !== 'function') return;
  const headerSlice = blob.slice(0, 4);
  if (typeof headerSlice.arrayBuffer !== 'function') return;
  const header = new Uint8Array(await headerSlice.arrayBuffer());
  if (header.byteLength >= 2 && (header[0] !== 0x50 || header[1] !== 0x4b)) {
    throw new Error('Selected file is not a valid PKZIP archive.');
  }
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
  if (!zipFile || zipFile.size === 0) {
    throw new Error('A non-empty ZIP archive file is required for import.');
  }
  if (zipFile.size > MAX_CLIENT_ARCHIVE_BYTES) {
    throw new Error('ZIP archive exceeds maximum allowed size of 500 MB.');
  }
  await assertPkzipMagicSignature(zipFile);

  const report = (
    phase: ImportZipProgress['phase'],
    message: string,
    current: number,
  ) => {
    onProgress?.({ phase, message, current, total: 2 });
  };

  const finalProjectName =
    projectName?.trim() ||
    inferArchiveProjectName(zipFile, 'Imported LaTeX Project');

  let targetProjectId = existingProjectId?.trim() || '';
  if (!targetProjectId && !parentPageId) {
    report('creating_project', `Creating project "${finalProjectName}"...`, 0);
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

  report('uploading', `Importing "${finalProjectName}" on server...`, 1);
  const summary = await exportDocs.importProjectZip(targetSpaceId, zipFile, {
    ...(preferredRootDoc ? { preferredRootDoc } : {}),
    ...(parentPageId ? { pageId: parentPageId } : {}),
  });

  const rootPageId = summary.rootDocId || parentPageId || '';
  report('done', 'Imported project archive successfully.', 2);

  return {
    projectId: summary.projectId || targetSpaceId,
    rootPageId,
    mainFileId: summary.rootDocId || undefined,
    summary,
  };
}
