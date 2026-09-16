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
