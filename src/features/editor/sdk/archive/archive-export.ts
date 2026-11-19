/**
 * archive-export.ts
 *
 * Thin, reliable client SDK wrappers for packaging LaTeX projects into ZIP archives
 * via the authoritative Backend Manuscripts Export-Import & Project History services:
 * - Standard project ZIP packaging (`GET /projects/:projectId/export/zip`)
 * - arXiv submission ZIP bundle (`GET /projects/:projectId/export/zip?cleanArxiv=true`)
 * - Snapshot / Historical revision ZIP packaging (`GET /projects/:projectId/history/versions/:version/export-zip`)
 */

import { docs, updater } from '../pages/docs.client';
import { exportDocs } from '../pages/export.client';
import { structure } from '../pages/structure.client';
import { sessionCoordinator } from '@/features/editor/core/coordinator/session.coordinator';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { extractDocumentContentString } from '@/features/editor/domain/types/core.types';
import { triggerFileDownload } from './document-download';

export interface ArchiveExportOptions {
  parentPageId: string;
  pageId?: string;
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
  pageId,
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

  const storeState = usePageStore.getState();
  const targetSpaceId = storeState.spaceId || storeState.projectId || parentPageId;
  const targetPageId = pageId || parentPageId;

  const hadDirtyBeforeExport =
    typeof sessionCoordinator.hasDirtyDocuments === 'function'
      ? sessionCoordinator.hasDirtyDocuments()
      : true;
  if (hadDirtyBeforeExport) {
    const flushRes = await sessionCoordinator.flushAllPending().catch(() => null);
    if (!flushRes || flushRes.total > 0) {
      await updater.flushProject(targetSpaceId).catch(() => null);
    }
  }

  let finalBlob: Blob | null = null;
  try {
    const serverBlob = await exportDocs.exportProjectZip(targetSpaceId, {
      cleanArxiv: isArxiv,
      includePdf: !isArxiv,
      projectName: cleanTitle,
      ...(targetPageId ? { pageId: targetPageId } : {}),
    });
    if (serverBlob && serverBlob.size >= 4) {
      const header = new Uint8Array(await serverBlob.slice(0, 4).arrayBuffer());
      if (header[0] === 0x50 && header[1] === 0x4b) {
        finalBlob = serverBlob;
      }
    }
  } catch {
    finalBlob = null;
  }

  if (!finalBlob) {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const auxPattern = /\.(aux|log|out|synctex\.gz|toc|lof|lot|fls|fdb_latexmk)$/i;

    const rootDoc = await docs.getById(parentPageId).catch(() => null);
    if (rootDoc) {
      const rootName =
        rootDoc.title && rootDoc.title.toLowerCase().endsWith('.tex')
          ? 'main.tex'
          : 'main.tex';
      const rootText = extractDocumentContentString(rootDoc.content);
      if (rootText || !zip.file(rootName)) {
        zip.file(rootName, rootText);
      }
    }

    const childDocs = await docs.getFiles(parentPageId).catch(() => []);
    for (const d of childDocs || []) {
      const entryName = (d.path || d.title || '').replace(/^\/+/, '');
      if (!entryName) continue;
      if (isArxiv && auxPattern.test(entryName)) continue;
      zip.file(entryName, extractDocumentContentString(d.content));
    }

    const storageFiles = await structure.getPageFiles(parentPageId).catch(() => []);
    for (const sf of storageFiles || []) {
      const sfPath = typeof sf.path === 'string' ? sf.path : '';
      const sfName = typeof sf.name === 'string' ? sf.name : sf.filename || '';
      const entryName = (sfPath || sfName).replace(/^\/+/, '');
      if (!entryName) continue;
      if (isArxiv && auxPattern.test(entryName)) continue;
      const fileUrl = typeof sf.fileUrl === 'string' ? sf.fileUrl : sf.url;
      if (typeof fileUrl === 'string' && fileUrl && typeof fetch === 'function') {
        try {
          const resp = await fetch(fileUrl);
          if (resp.ok) {
            zip.file(entryName, await resp.arrayBuffer());
          }
        } catch {
          // Skip unreachable storage file during fallback ZIP generation
        }
      }
    }

    finalBlob = await zip.generateAsync({ type: 'blob' });
  }

  const filename = isArxiv ? `arxiv-${cleanTitle}.zip` : `${cleanTitle}.zip`;
  triggerFileDownload(finalBlob, filename);
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
  pageId?: string;
  versionId?: string;
  version?: number | string;
  revisionDate?: string | Date;
  revisionLabel?: string;
  projectTitle?: string;
}

/**
 * Downloads a specific historical revision snapshot as a compressed .zip archive
 * directly from the backend (`pagesService.export.exportVersionZip`).
 */
export async function exportVersionAsZip(options: ExportVersionZipOptions): Promise<string> {
  const storeState = usePageStore.getState();
  const projectId =
    options.projectId ||
    storeState.spaceId ||
    storeState.projectId ||
    options.parentPageId ||
    '';
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

  const serverBlob = await exportDocs.exportVersionZip(
    projectId,
    version,
    cleanTitle,
    options.pageId ? { pageId: options.pageId } : undefined,
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
