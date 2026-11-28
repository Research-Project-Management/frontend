/**
 * zip-import.ts
 *
 * O(1) 4-byte PKZIP magic-header pre-flight check + authoritative server-side ZIP import
 * (`POST /api/v1/pages/spaces/:spaceId/import/zip`).
 */

import { exportDocs } from '../pages/export.client';
import type { ImportZipResult } from '../pages/types';
import { ProjectService } from '@/features/projects/shell/services/project.service';

const MAX_CLIENT_ARCHIVE_BYTES = 500 * 1024 * 1024;

export interface ImportZipProgress {
  phase: 'creating' | 'uploading' | 'done';
  message: string;
  current: number;
  total: number;
}

export interface ImportZipOptions {
  file: File | Blob;
  name?: string;
  spaceId?: string;
  pageId?: string;
  preferredRootDoc?: string;
  onProgress?: (progress: ImportZipProgress) => void;
}

export function isZipFile(file: File | Blob | string): boolean {
  if (typeof file === 'string') {
    const qIdx = file.indexOf('?');
    const hIdx = file.indexOf('#');
    const cut = qIdx === -1 ? hIdx : hIdx === -1 ? qIdx : Math.min(qIdx, hIdx);
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

export function inferArchiveName(file: File | Blob, fallback = 'Imported Archive'): string {
  if (file instanceof File && file.name) {
    const base = file.name.replace(/\.zip$/i, '').trim();
    if (base) return base;
  }
  return fallback;
}

async function assertPkzipMagicSignature(blob: File | Blob): Promise<void> {
  if (blob.size < 2 || typeof blob.slice !== 'function') return;
  const headerSlice = blob.slice(0, 4);
  if (typeof headerSlice.arrayBuffer !== 'function') return;
  const header = new Uint8Array(await headerSlice.arrayBuffer());
  if (header.byteLength >= 2 && (header[0] !== 0x50 || header[1] !== 0x4b)) {
    throw new Error('Selected file is not a valid PKZIP archive.');
  }
}

function extractCreatedId(res: unknown): string {
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

export async function importZip({
  file,
  name,
  spaceId: existingSpaceId,
  pageId,
  preferredRootDoc,
  onProgress,
}: ImportZipOptions): Promise<{
  spaceId: string;
  rootPageId: string;
  mainFileId?: string;
  summary: ImportZipResult;
}> {
  if (!file || file.size === 0) {
    throw new Error('A non-empty ZIP archive file is required for import.');
  }
  if (file.size > MAX_CLIENT_ARCHIVE_BYTES) {
    throw new Error('ZIP archive exceeds maximum allowed size of 500 MB.');
  }
  await assertPkzipMagicSignature(file);

  const report = (phase: ImportZipProgress['phase'], message: string, current: number) => {
    onProgress?.({ phase, message, current, total: 2 });
  };

  const archiveName = name?.trim() || inferArchiveName(file, 'Imported LaTeX Archive');

  let targetSpaceId = existingSpaceId?.trim() || '';
  if (!targetSpaceId && !pageId) {
    report('creating', `Creating space "${archiveName}"...`, 0);
    const created = await ProjectService.create({
      name: archiveName,
      modules: ['pages', 'work-items'],
    });
    targetSpaceId = extractCreatedId(created);
    if (!targetSpaceId) {
      throw new Error('Could not initialize target space.');
    }
  }

  const resolvedSpaceId = targetSpaceId || pageId || '';
  if (!resolvedSpaceId) {
    throw new Error('Target space ID is required for ZIP import.');
  }

  report('uploading', `Importing "${archiveName}" on server...`, 1);
  const summary = await exportDocs.importZip(resolvedSpaceId, file, {
    ...(preferredRootDoc ? { preferredRootDoc } : {}),
    ...(pageId ? { pageId } : {}),
  });

  const rootPageId = summary.pageId || summary.rootDocId || pageId || '';
  report('done', 'Imported archive successfully.', 2);

  return {
    spaceId: summary.spaceId || summary.projectId || resolvedSpaceId,
    rootPageId,
    mainFileId: summary.rootDocId || undefined,
    summary,
  };
}
