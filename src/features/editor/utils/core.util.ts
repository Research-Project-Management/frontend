/**
 * core.util.ts
 *
 * Core document utility functions: title formatting, filename sanitization, and path resolution.
 */

/** Formats document and project title for topbar / browser tab */
export function formatEditorTitle(pageTitle?: string, projectTitle?: string): string {
  if (!pageTitle && !projectTitle) return 'Editor';
  if (pageTitle && projectTitle && pageTitle !== projectTitle) {
    return `${pageTitle} - ${projectTitle}`;
  }
  return pageTitle || projectTitle || 'Editor';
}

/** Generates clean download filename */
export function getExportFilename(title: string, extension: 'pdf' | 'zip' | 'tex'): string {
  const clean = (title || 'document').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${clean}.${extension}`;
}

/** Checks whether a filename is a LaTeX source file */
export function isLatexSourceFile(filename: string): boolean {
  return filename.endsWith('.tex') || filename.endsWith('.sty') || filename.endsWith('.cls');
}

/** Checks whether a filename is a BibTeX bibliography file */
export function isBibtexFile(filename: string): boolean {
  return filename.endsWith('.bib');
}

/** Checks whether a filename is a static image asset */
export function isImageAsset(filename: string): boolean {
  return /\.(png|jpe?g|gif|svg|webp|pdf)$/i.test(filename);
}
