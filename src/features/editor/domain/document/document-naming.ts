/**
 * document-naming.ts
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
export function getExportFilename(title: string, extension: 'pdf' | 'zip' | 'tex' | 'doc' | 'docx' | 'md' | 'html' | string): string {
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

/** Pure display name formatter for LaTeX and manuscript project files */
export function displayName(title: string): string {
  const trimmed = (title || '').trim();
  if (!trimmed) {
    return 'main.tex';
  }
  return /\.[a-z0-9]+$/i.test(trimmed) ? trimmed : `${trimmed}.tex`;
}

/** Strips file extension from display name to get clean basename */
export function cleanBasename(title: string): string {
  return displayName(title).replace(/\.[a-z0-9]+$/i, '');
}

/**
 * Normalizes a virtual workspace path:
 * - Converts backslashes to forward slashes
 * - Strips leading `./` or `/` and trailing `/`
 * - Collapses redundant internal slashes and trims whitespace
 */
export function normalizeVirtualPath(raw?: string | null): string {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/\\/g, '/')
    .replace(/^(\.\/+|\/+)/, '')
    .replace(/\/+/g, '/')
    .replace(/\/+$/, '')
    .trim();
}

/**
 * Splits a virtual path into clean, non-empty path segments.
 */
export function splitVirtualPathSegments(raw?: string | null): string[] {
  const norm = normalizeVirtualPath(raw);
  return norm ? norm.split('/').map((s) => s.trim()).filter(Boolean) : [];
}

/**
 * Splits a virtual path into `{ dir, leaf, folderPath, leafName, segments }` where
 * `dir` / `folderPath` is the parent directory (empty string if root) and
 * `leaf` / `leafName` is the filename/basename.
 */
export function splitVirtualPath(raw?: string | null): {
  dir: string;
  leaf: string;
  folderPath: string;
  leafName: string;
  segments: string[];
} {
  const segments = splitVirtualPathSegments(raw);
  if (segments.length === 0) {
    return { dir: '', leaf: '', folderPath: '', leafName: '', segments: [] };
  }
  if (segments.length === 1) {
    const leaf = segments[0];
    return { dir: '', leaf, folderPath: '', leafName: leaf, segments };
  }
  const dir = segments.slice(0, -1).join('/');
  const leaf = segments[segments.length - 1];
  return {
    dir,
    leaf,
    folderPath: dir,
    leafName: leaf,
    segments,
  };
}

/**
 * Joins path segments into a normalized virtual path.
 */
export function joinVirtualPath(...parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => normalizeVirtualPath(p))
    .filter(Boolean)
    .join('/');
}

/**
 * Checks whether `targetPath` is strictly inside `folderPrefix/`.
 */
export function isUnderVirtualFolder(
  targetPath: string | null | undefined,
  folderPrefix: string | null | undefined,
  ignoreCase = false,
): boolean {
  const cleanTarget = normalizeVirtualPath(targetPath);
  const cleanPrefix = normalizeVirtualPath(folderPrefix);
  if (!cleanTarget || !cleanPrefix) return false;
  if (ignoreCase) {
    return cleanTarget.toLowerCase().startsWith(`${cleanPrefix.toLowerCase()}/`);
  }
  return cleanTarget.startsWith(`${cleanPrefix}/`);
}

/**
 * Rewrites `targetPath` if it resides under `oldPrefix/`, preserving a leading `/` if `preserveLeadingSlash` is true.
 * Returns `null` if `targetPath` does not reside under `oldPrefix/`.
 */
export function rewritePathPrefix(
  targetPath: string | null | undefined,
  oldPrefix: string | null | undefined,
  newPrefix: string | null | undefined,
  preserveLeadingSlash = false,
): string | null {
  if (!targetPath) return null;
  const cleanOld = normalizeVirtualPath(oldPrefix);
  const cleanNew = normalizeVirtualPath(newPrefix);
  if (!cleanOld || cleanOld === cleanNew) return null;

  const hasLeadingSlash = preserveLeadingSlash && targetPath.trim().startsWith('/');
  const cleanTarget = normalizeVirtualPath(targetPath);

  if (!cleanTarget.startsWith(`${cleanOld}/`)) {
    return null;
  }

  const suffix = cleanTarget.slice(cleanOld.length);
  const nextClean = cleanNew ? `${cleanNew}${suffix}` : suffix.replace(/^\/+/, '');
  return hasLeadingSlash ? `/${nextClean}` : nextClean;
}

/**
 * Extracts the normalized folder path from a synthetic `folder:path/to/dir` ID, or returns null.
 */
export function parseVirtualFolderId(folderId?: string | null): string | null {
  if (!folderId || !folderId.startsWith('folder:')) return null;
  return normalizeVirtualPath(folderId.slice('folder:'.length));
}

/**
 * Generates a canonical LaTeX inclusion snippet (\input, \bibliography, \includegraphics)
 */
export function formatLatexIncludeSnippet(
  pathOrFilename: string,
  defaultKind: 'tex' | 'asset' = 'tex',
): string {
  const full = normalizeVirtualPath(pathOrFilename) || displayName(pathOrFilename);
  const ext = full.split('.').pop()?.toLowerCase() ?? '';
  const base = full.replace(/\.[a-z0-9]+$/i, '');
  if (ext === 'bib' || ext === 'bst') return `\\bibliography{${base}}`;
  if (ext === 'tex' || ext === 'ltx' || (defaultKind === 'tex' && !full.includes('.'))) {
    return `\\input{${base}}`;
  }
  if (defaultKind === 'tex') {
    return `\\input{${base}}`;
  }
  return `\\includegraphics[width=\\linewidth]{${full}}`;
}
