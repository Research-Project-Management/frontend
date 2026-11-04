/**
 * archive-import.ts
 *
 * Thin client SDK wrapper for importing ZIP project archives via the authoritative
 * Backend Manuscripts ExportImportService (`POST /projects/:projectId/import/zip`).
 */

import { manuscriptService } from '@/features/editor/sdk/manuscript.service';
import type { ImportProjectZipResult } from '@/features/editor/sdk/manuscript/types';
import { ProjectService } from '@/features/projects/shell/services/project.service';

export const TEXT_EXTENSIONS = new Set([
  'tex',
  'ltx',
  'sty',
  'cls',
  'bib',
  'bbl',
  'bst',
  'def',
  'txt',
  'md',
  'json',
  'csv',
  'tsv',
  'dtx',
  'ins',
  'bbx',
  'cbx',
  'fd',
  'cfg',
]);

export const ASSET_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'pdf',
  'eps',
  'ps',
  'svg',
  'gif',
  'webp',
  'tiff',
  'bmp',
  'ai',
]);

export interface ExtractedZipItem {
  /** Relative path within the project (e.g., "main.tex" or "sections/intro.tex" or "figures/chart.png") */
  path: string;
  /** File basename (e.g., "intro.tex") */
  name: string;
  /** Directory path without filename (e.g., "sections" or "" for root) */
  folderPath: string;
  /** Whether the file is classified as a text document */
  isText: boolean;
  /** UTF-8 string content for text files */
  textContent?: string;
  /** Blob object for binary assets */
  blob?: Blob;
  /** Original file size in bytes */
  size: number;
}

export interface ExtractedZipProject {
  /** Inferred project title */
  name: string;
  /** Relative path of the detected main LaTeX document */
  mainFilePath?: string;
  /** Raw ZIP archive file/blob for backend upload */
  zipFile?: File | Blob;
  /** All extracted items (excluding system noise) */
  items: ExtractedZipItem[];
  /** Filtered list of text documents (.tex, .bib, .sty, etc.) */
  textFiles: ExtractedZipItem[];
  /** Filtered list of binary assets (.png, .pdf, .eps, etc.) */
  assetFiles: ExtractedZipItem[];
  /** Total count of usable files */
  totalFiles: number;
  /** Total uncompressed size in bytes */
  totalSize: number;
}

export type ParsedZipArchive = ExtractedZipProject;
export type ZipImportResult = ImportProjectZipResult;

export interface ImportZipProgress {
  phase:
    | 'reading'
    | 'creating_project'
    | 'creating_root'
    | 'creating_folders'
    | 'uploading_assets'
    | 'creating_files'
    | 'finalizing'
    | 'done';
  message: string;
  current: number;
  total: number;
}

/**
 * Checks whether a given file, Blob, or filename corresponds to a ZIP archive.
 */
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

/**
 * Determines whether a file path has an extension indicating text content.
 */
export function isTextFile(path: string): boolean {
  const ext = (path.split('.').pop() || '').toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

/**
 * Prepares a lightweight archive descriptor for the selected ZIP file without
 * client-side JSZip unpacking; actual extraction, Zip-Slip validation, and quota enforcement
 * are performed authoritatively on the backend (`POST /projects/:projectId/import/zip`).
 */
export async function parseZipArchive(
  fileOrBlob: File | Blob,
  preferredName?: string,
): Promise<ExtractedZipProject> {
  if (!fileOrBlob || fileOrBlob.size === 0) {
    return {
      name: preferredName || 'Imported Project',
      zipFile: fileOrBlob,
      items: [],
      textFiles: [],
      assetFiles: [],
      totalFiles: 0,
      totalSize: 0,
    };
  }

  let projectName = preferredName;
  if (!projectName && fileOrBlob instanceof File && fileOrBlob.name) {
    projectName = fileOrBlob.name.replace(/\.zip$/i, '').trim();
  }
  if (!projectName) {
    projectName = 'Imported Project';
  }

  const placeholderMain: ExtractedZipItem = {
    path: 'main.tex',
    name: 'main.tex',
    folderPath: '',
    isText: true,
    size: fileOrBlob.size,
  };

  return {
    name: projectName,
    mainFilePath: 'main.tex',
    zipFile: fileOrBlob,
    items: [placeholderMain],
    textFiles: [placeholderMain],
    assetFiles: [],
    totalFiles: 1,
    totalSize: fileOrBlob.size,
  };
}

export interface ImportZipOptions {
  extracted?: ExtractedZipProject;
  zipFile?: File | Blob;
  projectName?: string;
  projectId?: string;
  parentPageId?: string;
  onProgress?: (progress: ImportZipProgress) => void;
}

/**
 * Delegates ZIP archive unpacking and project hydration directly to the Flux backend
 * (`manuscriptService.export.importProjectZip`).
 * - If `projectId` is absent: creates a new Project container first, then imports the ZIP on the server.
 * - If `projectId` is provided: imports the ZIP directly into the existing project on the server.
 */
export async function extractAndImportZipToProject({
  extracted,
  zipFile,
  projectName,
  projectId: existingProjectId,
  parentPageId: existingParentPageId,
  onProgress,
}: ImportZipOptions): Promise<{
  projectId: string;
  rootPageId: string;
  mainFileId?: string;
  summary?: ImportProjectZipResult;
}> {
  const effectiveZipFile = zipFile ?? extracted?.zipFile;
  if (!effectiveZipFile) {
    throw new Error('ZIP archive file is required for import.');
  }

  const finalProjectName = (
    projectName ||
    extracted?.name ||
    (effectiveZipFile instanceof File
      ? effectiveZipFile.name.replace(/\.zip$/i, '')
      : '') ||
    'Imported LaTeX Project'
  ).trim();

  let effectiveProjectId = existingProjectId;
  const totalItems = Math.max(1, extracted?.totalFiles ?? 1);

  const report = (
    phase: ImportZipProgress['phase'],
    message: string,
    current: number,
  ) => {
    onProgress?.({
      phase,
      message,
      current,
      total: totalItems,
    });
  };

  if (!effectiveProjectId) {
    report('creating_project', `Creating project "${finalProjectName}"...`, 0);
    const projectRes = await ProjectService.create({
      name: finalProjectName,
      modules: ['pages', 'work-items'],
    });
    let extractedId: string | null = null;
    if (projectRes && typeof projectRes === 'object') {
      const pObj = projectRes as Record<string, unknown>;
      if (pObj.project && typeof pObj.project === 'object' && 'id' in pObj.project) {
        extractedId = String((pObj.project as { id: unknown }).id);
      } else if (pObj.data && typeof pObj.data === 'object' && 'id' in pObj.data) {
        extractedId = String((pObj.data as { id: unknown }).id);
      } else if ('id' in pObj && pObj.id) {
        extractedId = String(pObj.id);
      }
    }
    effectiveProjectId = extractedId ?? '';
  }

  if (!effectiveProjectId) {
    throw new Error('Could not initialize project container.');
  }

  report('uploading_assets', `Importing archive "${finalProjectName}" on server...`, 0);
  const serverImportRes = await manuscriptService.export.importProjectZip(
    effectiveProjectId,
    effectiveZipFile,
    extracted?.mainFilePath,
  );

  report('done', 'Imported project archive successfully.', totalItems);

  return {
    projectId: serverImportRes.projectId || effectiveProjectId,
    rootPageId: serverImportRes.rootDocId || existingParentPageId || '',
    mainFileId: serverImportRes.rootDocId || undefined,
    summary: serverImportRes,
  };
}
