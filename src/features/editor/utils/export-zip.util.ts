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

/**
 * Packages all LaTeX files, auxiliary documents, and media assets belonging to the project
 * into a single compressed .zip file and initiates a client-side download.
 */
export async function exportProjectAsZip({
  parentPageId,
  projectTitle,
  currentContent,
  activeFileId,
}: ExportZipOptions): Promise<void> {
  const toastId = toast.loading('Packaging project files into ZIP...');

  try {
    const zip = new JSZip();

    // 1. Fetch root page & child pages (files) and storage assets concurrently
    const [rootPage, childFiles, storageFiles] = await Promise.all([
      documentService.getById(parentPageId).catch(() => null),
      fileService.getByPageId(parentPageId).catch(() => []),
      StorageService.getPageFiles(parentPageId).catch(() => []),
    ]);

    const filesMap = new Map<string, string>();

    // 2. Add child files to filesMap
    for (const f of childFiles) {
      const title = f.title.trim();
      if (!title) continue;

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
          if (!item.url) return;

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
      compressionOptions: { level: 6 },
    });

    const cleanTitle = (projectTitle || rootPage?.title || 'flux-project')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_') || 'flux-project';

    const filename = `${cleanTitle}.zip`;

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);

    toast.success(`Exported ${filename} successfully!`, { id: toastId });
  } catch (error) {
    console.error('[export-zip] Error generating project ZIP:', error);
    toast.error('Failed to create project ZIP archive.', { id: toastId });
  }
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

/**
 * Packages project files strictly adhering to arXiv / Journal Submission standards:
 *  - Strips auxiliary/cached files (.aux, .log, .synctex, etc.)
 *  - Ensures main .tex and bibliography (.bbl/.bib) are included at the root level
 *  - Mounts valid figure/asset files
 *  - Emits an arxiv-<title>.zip package ready for direct upload
 */
export async function exportArxivSubmissionZip({
  parentPageId,
  projectTitle,
  currentContent,
  activeFileId,
}: ExportZipOptions): Promise<void> {
  const toastId = toast.loading('Packaging arXiv submission bundle (.zip)...');

  try {
    const zip = new JSZip();

    // 1. Fetch root page & child pages (files) and storage assets concurrently
    const [rootPage, childFiles, storageFiles] = await Promise.all([
      documentService.getById(parentPageId).catch(() => null),
      fileService.getByPageId(parentPageId).catch(() => []),
      StorageService.getPageFiles(parentPageId).catch(() => []),
    ]);

    const filesMap = new Map<string, string>();

    // 2. Filter & add valid LaTeX / text files
    for (const f of childFiles) {
      const title = f.title.trim();
      if (!title || !isArxivAllowed(title)) continue;

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

    let mainSource = '';
    if (!hasMain) {
      const rootTitle =
        rootPage?.title && rootPage.title.endsWith('.tex')
          ? rootPage.title
          : 'main.tex';

      mainSource =
        activeFileId === parentPageId && typeof currentContent === 'string'
          ? currentContent
          : typeof rootPage?.content === 'string'
            ? rootPage.content
            : rootPage?.content && typeof rootPage.content === 'object'
              ? ((rootPage.content as any).source ||
                  (rootPage.content as any).text ||
                  '')
              : currentContent || '';

      filesMap.set(rootTitle, mainSource);
    } else {
      mainSource = filesMap.get('main.tex') || '';
    }

    // Add valid source files to the ZIP
    for (const [path, content] of filesMap.entries()) {
      zip.file(path, content);
    }

    // 4. Download and embed valid media/figure assets
    if (storageFiles && storageFiles.length > 0) {
      await Promise.all(
        storageFiles.map(async (item: any) => {
          if (item.isFolder) return;
          if (!item.url || !item.filename) return;
          if (!isArxivAllowed(item.filename)) return;

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
            console.warn(
              `[export-arxiv-zip] Failed to fetch asset ${item.filename}:`,
              fetchErr,
            );
          }
        }),
      );
    }

    // 5. Generate arXiv ZIP package and trigger download
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }, // High compression for arXiv 10MB limits
    });

    const cleanTitle = (projectTitle || rootPage?.title || 'manuscript')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_') || 'manuscript';

    const filename = `arxiv-${cleanTitle}.zip`;

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);

    toast.success(`Exported ${filename} successfully for arXiv!`, { id: toastId });
  } catch (error) {
    console.error('[export-arxiv-zip] Error generating arXiv ZIP:', error);
    toast.error('Failed to create arXiv submission ZIP.', { id: toastId });
  }
}
