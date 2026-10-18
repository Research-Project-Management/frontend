/**
 * archive-export.ts
 *
 * Domain logic for packaging LaTeX documents into ZIP archives:
 * - Standard project ZIP packaging with local asset embedding
 * - arXiv submission ZIP bundle (filtering aux files, validating extensions)
 * - Snapshot / Historical revision ZIP packaging
 */

import JSZip from 'jszip';
import {
  fileService,
  documentService,
  versionService,
  manuscriptService,
  StorageService,
} from '@/features/editor/sdk/manuscript.service';
import { resolveFileUrl } from '@/shared/lib/file-client';
import { extractDocumentContentString } from '@/features/editor/domain/types/core.types';
import { useSettingsStore } from '@/features/editor/core/store/settings.store';

export interface ExportZipOptions {
  parentPageId: string;
  projectTitle?: string;
  currentContent?: string;
  activeFileId?: string;
  activeFileTitle?: string;
}

const ARXIV_ALLOWED_EXTENSIONS = new Set([
  'tex',
  'ltx',
  'sty',
  'cls',
  'bst',
  'def',
  'fd',
  'cfg',
  'bbx',
  'cbx',
  'bib',
  'bbl',
  'png',
  'jpg',
  'jpeg',
  'pdf',
  'eps',
  'ps',
  'svg',
  'csv',
  'dat',
  'txt',
]);

function isArxivAllowed(filename: string): boolean {
  const clean = filename.trim().toLowerCase();
  // Filter out system / hidden files
  if (clean.startsWith('.') || clean.startsWith('__macosx')) return false;
  // Filter out aux, log, out, synctex, fls
  if (/\.(aux|log|out|synctex\.gz|toc|lof|lot|fls|fdb_latexmk)$/i.test(clean)) return false;
  const ext = clean.split('.').pop() || '';
  return ARXIV_ALLOWED_EXTENSIONS.has(ext);
}

interface BundleZipOptions extends ExportZipOptions {
  isArxiv?: boolean;
}

/**
 * Unified packaging engine for project archives (Standard ZIP & arXiv Bundle).
 */
async function bundleAndDownloadZip({
  parentPageId,
  projectTitle,
  currentContent,
  activeFileId,
  isArxiv = false,
}: BundleZipOptions): Promise<string> {
  const baseTitle = isArxiv
    ? (projectTitle || 'manuscript')
    : (projectTitle || 'flux-project');

  const cleanTitle =
    baseTitle
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_') || (isArxiv ? 'manuscript' : 'flux-project');

  try {
    const zip = new JSZip();

    // 1. Fetch root page & child pages (files) and storage assets concurrently
    const [rootPage, childFiles, storageFiles] = await Promise.all([
      documentService.getById(parentPageId).catch(() => null),
      fileService.getByPageId(parentPageId).catch(() => []),
      StorageService.getPageFiles(parentPageId).catch(() => []),
    ]);

    const filesMap = new Map<string, string>();

    // 2. Filter & add child files to filesMap
    for (const f of childFiles) {
      const title = f.title.trim();
      if (!title) continue;
      if (isArxiv && !isArxivAllowed(title)) continue;

      if (activeFileId === f.id && typeof currentContent === 'string') {
        filesMap.set(title, currentContent);
      } else {
        const strContent = extractDocumentContentString(f.content);
        filesMap.set(title, strContent);
      }
    }

    // 3. Ensure the main LaTeX document is included
    const configuredMain = useSettingsStore.getState().mainFile || 'main.tex';
    const hasMain = Array.from(filesMap.entries()).some(
      ([k, v]) =>
        k.toLowerCase() === configuredMain.toLowerCase() ||
        k.toLowerCase() === 'main.tex' ||
        (k.toLowerCase().endsWith('.tex') && /\\documentclass\b/.test(v)),
    );

    if (!hasMain) {
      const rootTitle =
        rootPage?.title && rootPage.title.endsWith('.tex')
          ? rootPage.title
          : configuredMain;

      const rootStr =
        activeFileId === parentPageId && typeof currentContent === 'string'
          ? currentContent
          : extractDocumentContentString(rootPage?.content) || currentContent || '';

      filesMap.set(rootTitle, rootStr);
    }

    // 3.5. arXiv Publication Parity: Ensure compiled .bbl is retrieved from compiler artifacts if missing
    if (isArxiv) {
      const hasBbl = Array.from(filesMap.keys()).some((k) => k.toLowerCase().endsWith('.bbl'));
      if (!hasBbl) {
        try {
          const auxFiles = await manuscriptService.compiler.listAuxFiles(parentPageId).catch(() => []);
          const bblItem = (auxFiles || []).find((f) => f.name.toLowerCase().endsWith('.bbl'));
          if (bblItem) {
            const bblName = bblItem.name;
            const bblUrl = manuscriptService.compiler.downloadAuxFileUrl(parentPageId, bblName);
            const res = await fetch(bblUrl, { credentials: 'include' });
            if (res.ok) {
              const bblContent = await res.text();
              filesMap.set(bblName, bblContent);
              // If root file is main.tex but bbl is output.bbl, also provide main.bbl for arXiv compiler auto-detection
              const rootTex = Array.from(filesMap.keys()).find((k) => k.toLowerCase().endsWith('.tex'));
              if (rootTex && bblName.toLowerCase() === 'output.bbl') {
                const targetBbl = rootTex.replace(/\.tex$/i, '.bbl');
                if (!filesMap.has(targetBbl)) {
                  filesMap.set(targetBbl, bblContent);
                }
              }
            }
          }
        } catch (e) {
          console.warn('[export-arxiv] Could not fetch compiled .bbl artifact:', e);
        }
      }
    }

    // Add all source files to the ZIP
    for (const [path, content] of filesMap.entries()) {
      zip.file(path, content);
    }

    // 4. Download and embed media/storage assets (images, pdfs, bibs, etc.)
    if (storageFiles && storageFiles.length > 0) {
      await Promise.all(
        storageFiles.map(async (item) => {
          if (item.isFolder) return;
          if (!item.url || !item.filename) return;
          if (isArxiv && !isArxivAllowed(item.filename)) return;

          try {
            const resolvedUrl = resolveFileUrl(item.url);
            if (!resolvedUrl) return;

            const res = await fetch(resolvedUrl, { credentials: 'include' });
            if (res.ok) {
              const blob = await res.blob();
              // Don't overwrite if text file with the same name exists
              if (!filesMap.has(item.filename)) {
                zip.file(item.filename, blob);
              }
            }
          } catch (fetchErr) {
            console.warn(
              `[export-zip] Failed to fetch asset ${item.filename}:`,
              fetchErr,
            );
          }
        }),
      );
    }

    // 5. Generate ZIP Blob and trigger download
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: isArxiv ? 9 : 6 },
    });

    const baseTitle = isArxiv
      ? (projectTitle || rootPage?.title || 'manuscript')
      : (projectTitle || rootPage?.title || 'flux-project');

    const cleanTitle = baseTitle
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_') || (isArxiv ? 'manuscript' : 'flux-project');

    const filename = isArxiv ? `arxiv-${cleanTitle}.zip` : `${cleanTitle}.zip`;

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);

    return filename;
  } catch (error) {
    try {
      const serverBlob = await manuscriptService.export.exportProjectZip(parentPageId);
      if (serverBlob && serverBlob.size > 0) {
        const fallbackFilename = isArxiv ? `arxiv-${cleanTitle}.zip` : `${cleanTitle}.zip`;
        const downloadUrl = URL.createObjectURL(serverBlob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fallbackFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
        return fallbackFilename;
      }
    } catch {
      // Fall through to original error
    }
    console.error('[export-zip] Error generating ZIP:', error);
    throw error;
  }
}

/**
 * Packages all LaTeX files, auxiliary documents, and media assets belonging to the project
 * into a single compressed .zip file and initiates a client-side download.
 */
export async function exportProjectAsZip(options: ExportZipOptions): Promise<string> {
  return bundleAndDownloadZip({ ...options, isArxiv: false });
}

/**
 * Packages project files strictly adhering to arXiv / Journal Submission standards:
 *  - Strips auxiliary/cached files (.aux, .log, .synctex, etc.)
 *  - Ensures main .tex and bibliography (.bbl/.bib) are included at the root level
 *  - Mounts valid figure/asset files
 *  - Emits an arxiv-<title>.zip package ready for direct upload
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
 * Packages all files and assets belonging to a specific revision snapshot
 * into a single compressed .zip file and initiates a client-side download.
 */
export async function exportVersionAsZip(options: ExportVersionZipOptions): Promise<string> {
  const parentPageId = options.parentPageId || options.projectId || '';
  const versionId = options.versionId || String(options.version ?? '');
  const revisionDate = options.revisionDate;
  const revisionLabel = options.revisionLabel || (options.version ? `v${options.version}` : undefined);
  const projectTitle = options.projectTitle;

  try {
    const zip = new JSZip();

    // 1. Fetch root page, active child files, deleted files, and storage files concurrently
    const [rootPage, childFiles, storageFiles] = await Promise.all([
      parentPageId ? documentService.getById(parentPageId).catch(() => null) : null,
      parentPageId ? fileService.getByPageId(parentPageId).catch(() => []) : [],
      parentPageId ? StorageService.getPageFiles(parentPageId).catch(() => []) : [],
    ]);

    const deletedFiles = await fileService.getDeletedByPageId(parentPageId).catch(() => []);
    const allFiles = [...childFiles, ...deletedFiles];

    const targetDate = revisionDate ? new Date(revisionDate).getTime() : Date.now();
    const filesMap = new Map<string, string>();

    // 2. Resolve content for each file at the revision
    await Promise.all(
      allFiles.map(async (f) => {
        const title = f.title?.trim();
        if (!title) return;

        // Fetch versions of this file
        try {
          const versions = await versionService.getByPageId(f.id).catch(() => []);
          if (versions && versions.length > 0) {
            let matchingVer = versions.find((v) => v.id === versionId);
            if (!matchingVer && revisionDate) {
              const beforeVers = versions.filter(
                (v) => new Date(v.createdAt).getTime() <= targetDate + 1000,
              );
              matchingVer = beforeVers[0] || versions[versions.length - 1];
            }
            if (!matchingVer) matchingVer = versions[0];

            if (matchingVer) {
              const fullVer = await versionService.getById(f.id, matchingVer.id).catch(() => null);
              if (fullVer && typeof fullVer.content === 'string') {
                filesMap.set(title, fullVer.content);
                return;
              }
            }
          }
        } catch {
          // fallback to file's default content
        }

        const strContent = extractDocumentContentString(f.content);
        filesMap.set(title, strContent);
      }),
    );

    // 3. Ensure the main LaTeX document is included
    const hasMain = Array.from(filesMap.keys()).some(
      (k) => k.toLowerCase() === 'main.tex',
    );

    if (!hasMain) {
      const rootTitle =
        rootPage?.title && rootPage.title.endsWith('.tex')
          ? rootPage.title
          : 'main.tex';

      let rootStr = typeof rootPage?.content === 'string' ? rootPage.content : '';
      try {
        const rootVersions = await versionService.getByPageId(parentPageId).catch(() => []);
        const matchingRoot =
          rootVersions.find((v) => v.id === versionId) ||
          rootVersions.find((v) => new Date(v.createdAt).getTime() <= targetDate + 1000) ||
          rootVersions[0];
        if (matchingRoot) {
          const fullRoot = await versionService.getById(parentPageId, matchingRoot.id).catch(() => null);
          if (fullRoot && typeof fullRoot.content === 'string') {
            rootStr = fullRoot.content;
          }
        }
      } catch {
        // fallback to default rootStr
      }

      filesMap.set(rootTitle, rootStr);
    }

    // 3b. If exporting a milestone project snapshot directly by version number
    if (options.projectId && typeof options.version === 'number') {
      try {
        const snap = await manuscriptService.history.getProjectSnapshot(options.projectId, options.version);
        if (snap && snap.files) {
          for (const [filePath, fileData] of Object.entries(snap.files)) {
            const cleanPath = filePath.replace(/^\//, '');
            const content = extractDocumentContentString(fileData);
            if (content !== undefined) {
              filesMap.set(cleanPath, content);
            }
          }
        }
      } catch {}
    }

    // Add all source files to the ZIP
    for (const [path, content] of filesMap.entries()) {
      zip.file(path, content);
    }

    // 4. Download and embed media/storage assets (images, figures)
    if (storageFiles && storageFiles.length > 0) {
      await Promise.all(
        storageFiles.map(async (item) => {
          if (item.isFolder || !item.url || !item.filename) return;
          try {
            const resolvedUrl = resolveFileUrl(item.url);
            if (!resolvedUrl) return;

            const res = await fetch(resolvedUrl, { credentials: 'include' });
            if (res.ok) {
              const blob = await res.blob();
              if (!filesMap.has(item.filename)) {
                zip.file(item.filename, blob);
              }
            }
          } catch (fetchErr) {
            console.warn(`[export-zip] Failed to fetch asset ${item.filename}:`, fetchErr);
          }
        }),
      );
    }

    // 5. Generate ZIP Blob and trigger download
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const baseTitle = projectTitle || rootPage?.title || 'flux-project';
    const cleanTitle =
      baseTitle
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '_') || 'flux-project';

    const cleanLabel = revisionLabel
      ? `-${revisionLabel.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')}`
      : revisionDate
        ? `-${new Date(revisionDate).toISOString().slice(0, 10)}`
        : '-snapshot';

    const filename = `${cleanTitle}${cleanLabel}.zip`;

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);

    return filename;
  } catch (error) {
    console.error('[export-zip] Error generating version ZIP:', error);
    throw error;
  }
}
