import JSZip from 'jszip';
import { toast } from 'sonner';
import { fileService, documentService } from '../services/core.service';
import { StorageService } from '../services/storage.service';
import { resolveFileUrl } from './editor.util';

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
}: BundleZipOptions): Promise<void> {
  const label = isArxiv ? 'arXiv submission bundle (.zip)' : 'ZIP';
  const toastId = toast.loading(
    isArxiv
      ? 'Packaging arXiv submission bundle (.zip)...'
      : 'Packaging project files into ZIP...',
  );

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
        const strContent =
          typeof f.content === 'string'
            ? f.content
            : f.content && typeof f.content === 'object'
              ? ((f.content as any).source ||
                  (f.content as any).text ||
                  (f.content as any).content ||
                  '')
              : '';
        filesMap.set(title, strContent);
      }
    }

    // 3. Ensure the main LaTeX document is included
    const hasMain = Array.from(filesMap.keys()).some(
      (k) => k.toLowerCase() === 'main.tex',
    );

    if (!hasMain) {
      const rootTitle =
        rootPage?.title && rootPage.title.endsWith('.tex')
          ? rootPage.title
          : 'main.tex';

      const rootStr =
        activeFileId === parentPageId && typeof currentContent === 'string'
          ? currentContent
          : typeof rootPage?.content === 'string'
            ? rootPage.content
            : rootPage?.content && typeof rootPage.content === 'object'
              ? ((rootPage.content as any).source ||
                  (rootPage.content as any).text ||
                  '')
              : currentContent || '';

      filesMap.set(rootTitle, rootStr);
    }

    // Add all source files to the ZIP
    for (const [path, content] of filesMap.entries()) {
      zip.file(path, content);
    }

    // 4. Download and embed media/storage assets (images, pdfs, bibs, etc.)
    if (storageFiles && storageFiles.length > 0) {
      await Promise.all(
        storageFiles.map(async (item: any) => {
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

    toast.success(
      isArxiv
        ? `Exported ${filename} successfully for arXiv!`
        : `Exported ${filename} successfully!`,
      { id: toastId },
    );
  } catch (error) {
    console.error(`[export-zip] Error generating ${label}:`, error);
    toast.error(
      isArxiv
        ? 'Failed to create arXiv submission ZIP.'
        : 'Failed to create project ZIP archive.',
      { id: toastId },
    );
  }
}

/**
 * Packages all LaTeX files, auxiliary documents, and media assets belonging to the project
 * into a single compressed .zip file and initiates a client-side download.
 */
export async function exportProjectAsZip(options: ExportZipOptions): Promise<void> {
  return bundleAndDownloadZip({ ...options, isArxiv: false });
}

/**
 * Packages project files strictly adhering to arXiv / Journal Submission standards:
 *  - Strips auxiliary/cached files (.aux, .log, .synctex, etc.)
 *  - Ensures main .tex and bibliography (.bbl/.bib) are included at the root level
 *  - Mounts valid figure/asset files
 *  - Emits an arxiv-<title>.zip package ready for direct upload
 */
export async function exportArxivSubmissionZip(options: ExportZipOptions): Promise<void> {
  return bundleAndDownloadZip({ ...options, isArxiv: true });
}
