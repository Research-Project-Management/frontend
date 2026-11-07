/**
 * archive-export.ts
 *
 * Thin, reliable client SDK wrappers for packaging LaTeX projects into ZIP archives
 * via the authoritative Backend Manuscripts Export-Import & Project History services:
 * - Standard project ZIP packaging (`GET /projects/:projectId/export/zip`)
 * - arXiv submission ZIP bundle (`GET /projects/:projectId/export/zip?cleanArxiv=true`)
 * - Snapshot / Historical revision ZIP packaging (`GET /projects/:projectId/history/versions/:version/export-zip`)
 */

import { manuscriptService } from '@/features/editor/sdk/pages.service';
import { sessionCoordinator } from '@/features/editor/core';
import { triggerFileDownload } from './document-download';

export interface ArchiveExportOptions {
  parentPageId: string;
  projectTitle?: string;
  currentContent?: string;
  activeFileId?: string;
  activeFileTitle?: string;
  mainFile?: string;
  getDocumentContent?: (fileId: string) => string;
}

export type ExportZipOptions = ArchiveExportOptions;

interface BundleZipOptions extends ArchiveExportOptions {
  isArxiv?: boolean;
}

/**
 * Unified thin wrapper for project archives (Standard ZIP & arXiv Bundle).
 * Flushes pending client & Yjs session changes, then downloads the authoritative ZIP stream from the backend.
 */
async function bundleAndDownloadZip({
  parentPageId,
  projectTitle,
  isArxiv = false,
}: BundleZipOptions): Promise<string> {
  if (!parentPageId) {
    throw new Error('Project or document identifier is required to export ZIP.');
  }

  const baseTitle = isArxiv
    ? projectTitle || 'manuscript'
    : projectTitle || 'flux-project';

  const cleanTitle =
    baseTitle
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_') || (isArxiv ? 'manuscript' : 'flux-project');

  const hadDirtyBeforeExport =
    typeof sessionCoordinator.hasDirtyDocuments === 'function'
      ? sessionCoordinator.hasDirtyDocuments()
      : true;
  if (hadDirtyBeforeExport) {
    const flushRes = await sessionCoordinator.flushAllPending().catch(() => null);
    if (!flushRes || flushRes.total > 0) {
      await manuscriptService.updater.flushProject(parentPageId).catch(() => null);
    }
  }

  const serverBlob = await manuscriptService.export.exportProjectZip(parentPageId, {
    cleanArxiv: isArxiv,
    includePdf: !isArxiv,
    projectName: cleanTitle,
  });

  const filename = isArxiv ? `arxiv-${cleanTitle}.zip` : `${cleanTitle}.zip`;
  triggerFileDownload(serverBlob, filename);
  return filename;
}

/**
 * Packages all LaTeX files, auxiliary documents, and media assets belonging to the project
 * into a single compressed .zip file via the backend and initiates a browser download.
 */
export async function exportProjectAsZip(options: ExportZipOptions): Promise<string> {
  return bundleAndDownloadZip({ ...options, isArxiv: false });
}

/**
 * Packages project files strictly adhering to arXiv / Journal Submission standards
 * via the backend and initiates a browser download.
 */
export async function exportArxivSubmissionZip(options: ExportZipOptions): Promise<string> {
  return bundleAndDownloadZip({ ...options, isArxiv: true });
}

export interface ExportVersionZipOptions {
  parentPageId?: string;
  projectId?: string;
  versionId?: string;
  version?: number | string;
  revisionDate?: string | Date;
  revisionLabel?: string;
  projectTitle?: string;
}

/**
 * Downloads a specific historical revision snapshot as a compressed .zip archive
 * directly from the backend (`manuscriptService.export.exportVersionZip`).
 */
export async function exportVersionAsZip(options: ExportVersionZipOptions): Promise<string> {
  const projectId = options.projectId || options.parentPageId || '';
  const version = options.version ?? options.versionId ?? 1;
  const projectTitle = options.projectTitle || 'flux-project';

  if (!projectId) {
    throw new Error('Project ID is required to export version ZIP.');
  }

  const cleanTitle =
    projectTitle
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_') || 'flux-project';

  await sessionCoordinator.flushAllPending().catch(() => null);

  const serverBlob = await manuscriptService.export.exportVersionZip(
    projectId,
    version,
    cleanTitle,
  );

  const revisionLabel =
    options.revisionLabel || (options.version ? `v${options.version}` : undefined);
  const cleanLabel = revisionLabel
    ? `-${revisionLabel.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')}`
    : options.revisionDate
      ? `-${new Date(options.revisionDate).toISOString().slice(0, 10)}`
      : '-snapshot';

  const filename = `${cleanTitle}${cleanLabel}.zip`;
  triggerFileDownload(serverBlob, filename);
  return filename;
}
