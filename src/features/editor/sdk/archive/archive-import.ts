/**
 * archive-import.ts
 *
 * Domain logic for unpacking and importing ZIP project archives into the workspace:
 * - Parsing ZIP archive entries with JSZip
 * - Stripping macOS/OS artifacts and detecting common root prefixes
 * - Detecting main LaTeX entry file (main.tex, \documentclass)
 * - Creating asset directories and uploading media
 * - Creating child text files and setting the root/main file
 */

import JSZip from 'jszip';
import { fileService, pageService, StorageService, manuscriptService } from '@/features/editor/sdk/manuscript.service';
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

export const ZIP_SECURITY_LIMITS = {
  MAX_TOTAL_FILES: 5000,
  MAX_TOTAL_UNCOMPRESSED_SIZE: 150 * 1024 * 1024, // 150 MB
  MAX_SINGLE_FILE_SIZE: 50 * 1024 * 1024, // 50 MB
};

/**
 * Normalizes file path to POSIX standard, strips leading/trailing slashes,
 * and securely neutralizes Path Traversal sequences (Zip Slip prevention: CWE-22).
 * Guarantees that extracted files are safely confined within the target root directory.
 */
export function sanitizeZipPath(rawPath: string): string {
  if (!rawPath || typeof rawPath !== 'string') return '';

  // 1. Remove null bytes and non-printable control characters
  let clean = rawPath.replace(/\0/g, '').replace(/[\x00-\x1f\x7f]/g, '').trim();

  // 2. Normalize Windows drive letters (e.g. C:/, D:\) and backslashes
  clean = clean.replace(/^[a-zA-Z]:[/\\]*/, '').replace(/\\/g, '/');

  // 3. Strip leading and trailing slashes
  clean = clean.replace(/^\/+/, '').replace(/\/+$/, '').trim();

  // 4. Safely resolve path segments inside jail
  const rawSegments = clean.split('/');
  const safeSegments: string[] = [];

  for (const segment of rawSegments) {
    const trimmed = segment.trim();
    if (!trimmed || trimmed === '.') continue;

    // Neutralize directory traversal ('..')
    if (trimmed === '..') {
      if (safeSegments.length > 0) {
        safeSegments.pop();
      }
      // Never allow escaping above project root
      continue;
    }

    safeSegments.push(trimmed);
  }

  return safeSegments.join('/');
}

/**
 * Checks if a zip entry path represents OS system noise (__MACOSX, .DS_Store, Thumbs.db, etc.)
 */
export function isSystemNoise(path: string): boolean {
  const normalized = sanitizeZipPath(path);
  const segments = normalized.split('/');
  for (const seg of segments) {
    if (seg === '__MACOSX' || seg === '.DS_Store' || seg === 'Thumbs.db' || seg === 'desktop.ini') {
      return true;
    }
    if (seg.startsWith('._')) {
      return true;
    }
    if (seg === '.git') {
      return true;
    }
  }
  return false;
}

/**
 * If all files in the archive share a single common top-level directory (standard Overleaf/GitHub archive export),
 * returns that prefix so it can be stripped.
 */
export function detectCommonRootPrefix(paths: string[]): string {
  if (paths.length === 0) return '';

  const validPaths = paths.filter((p) => !isSystemNoise(p));
  if (validPaths.length === 0) return '';

  const firstSegs = validPaths.map((p) => {
    const parts = sanitizeZipPath(p).split('/');
    return parts.length > 1 ? parts[0] : null;
  });

  const rootCandidate = firstSegs[0];
  if (!rootCandidate) return '';

  const allShareRoot = firstSegs.every((seg) => seg === rootCandidate);
  return allShareRoot ? `${rootCandidate}/` : '';
}

/**
 * Determines whether a file path has an extension indicating text content.
 */
export function isTextFile(path: string): boolean {
  const ext = (path.split('.').pop() || '').toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

/**
 * Parses a ZIP archive into structured project data, stripping system junk and
 * detecting the main LaTeX entry point.
 */
export async function parseZipArchive(
  fileOrBlob: File | Blob,
  preferredName?: string,
): Promise<ExtractedZipProject> {
  const zip = await JSZip.loadAsync(fileOrBlob);

  const rawEntries: { path: string; entry: JSZip.JSZipObject }[] = [];
  zip.forEach((relPath, entry) => {
    if (!entry.dir) {
      const safePath = sanitizeZipPath(relPath);
      if (safePath && !isSystemNoise(safePath)) {
        rawEntries.push({ path: safePath, entry });
      }
    }
  });

  // Guard: File count limit (Zip Bomb protection)
  if (rawEntries.length > ZIP_SECURITY_LIMITS.MAX_TOTAL_FILES) {
    throw new Error(
      `Security violation: ZIP archive contains ${rawEntries.length} files, exceeding maximum safety limit (${ZIP_SECURITY_LIMITS.MAX_TOTAL_FILES} files).`
    );
  }

  // Check for common root prefix
  const allPaths = rawEntries.map((e) => e.path);
  const commonPrefix = detectCommonRootPrefix(allPaths);

  const items: ExtractedZipItem[] = [];
  let accumulatedSize = 0;

  for (const { path: rawPath, entry } of rawEntries) {
    const cleanPath = commonPrefix && rawPath.startsWith(commonPrefix)
      ? rawPath.slice(commonPrefix.length)
      : rawPath;

    if (!cleanPath) continue;

    const parts = cleanPath.split('/');
    const name = parts[parts.length - 1];
    const folderPath = parts.slice(0, -1).join('/');
    const isText = isTextFile(name);

    if (isText) {
      const textContent = await entry.async('string');
      const entrySize = new TextEncoder().encode(textContent).length;

      if (entrySize > ZIP_SECURITY_LIMITS.MAX_SINGLE_FILE_SIZE) {
        throw new Error(
          `Security violation: File "${cleanPath}" exceeds maximum allowable single file size (50MB).`
        );
      }

      accumulatedSize += entrySize;
      if (accumulatedSize > ZIP_SECURITY_LIMITS.MAX_TOTAL_UNCOMPRESSED_SIZE) {
        throw new Error(
          `Security violation: Archive uncompressed size exceeds maximum safety limit (150MB).`
        );
      }

      items.push({
        path: cleanPath,
        name,
        folderPath,
        isText: true,
        textContent,
        size: entrySize,
      });
    } else {
      const blob = await entry.async('blob');

      if (blob.size > ZIP_SECURITY_LIMITS.MAX_SINGLE_FILE_SIZE) {
        throw new Error(
          `Security violation: File "${cleanPath}" exceeds maximum allowable single file size (50MB).`
        );
      }

      accumulatedSize += blob.size;
      if (accumulatedSize > ZIP_SECURITY_LIMITS.MAX_TOTAL_UNCOMPRESSED_SIZE) {
        throw new Error(
          `Security violation: Archive uncompressed size exceeds maximum safety limit (150MB).`
        );
      }

      items.push({
        path: cleanPath,
        name,
        folderPath,
        isText: false,
        blob,
        size: blob.size,
      });
    }
  }

  // Identify main file
  const textFiles = items.filter((i) => i.isText);
  const assetFiles = items.filter((i) => !i.isText);

  let mainFilePath: string | undefined;

  // 1. Exact "main.tex" at root
  const rootMain = textFiles.find((f) => f.path.toLowerCase() === 'main.tex');
  if (rootMain) {
    mainFilePath = rootMain.path;
  } else {
    // 2. Any root-level .tex containing \documentclass (excluding subfiles child documents)
    const isRealDocClass = (text?: string) =>
      Boolean(text && /\\documentclass\b/.test(text) && !/\\documentclass\s*(?:\[[^\]]*\])?\s*\{\s*subfiles\s*\}/.test(text));

    const rootDocClass = textFiles.find(
      (f) =>
        !f.folderPath &&
        f.name.toLowerCase().endsWith('.tex') &&
        isRealDocClass(f.textContent),
    );
    if (rootDocClass) {
      mainFilePath = rootDocClass.path;
    } else {
      // 3. Any .tex containing \documentclass anywhere in the tree
      const anyDocClass = textFiles.find(
        (f) =>
          f.name.toLowerCase().endsWith('.tex') &&
          isRealDocClass(f.textContent),
      );
      if (anyDocClass) {
        mainFilePath = anyDocClass.path;
      } else {
        // 4. Fallback to first .tex at root, or first .tex overall
        const firstRootTex = textFiles.find(
          (f) => !f.folderPath && f.name.toLowerCase().endsWith('.tex'),
        );
        const firstAnyTex = textFiles.find((f) => f.name.toLowerCase().endsWith('.tex'));
        mainFilePath = firstRootTex?.path || firstAnyTex?.path;
      }
    }
  }

  // Project name deduction
  let projectName = preferredName;
  if (!projectName && fileOrBlob instanceof File && fileOrBlob.name) {
    projectName = fileOrBlob.name.replace(/\.zip$/i, '').trim();
  }
  if (!projectName && commonPrefix) {
    projectName = commonPrefix.replace(/\/$/, '').trim();
  }
  if (!projectName) {
    projectName = 'Imported Project';
  }

  const totalSize = items.reduce((acc, curr) => acc + curr.size, 0);

  return {
    name: projectName,
    mainFilePath,
    items,
    textFiles,
    assetFiles,
    totalFiles: items.length,
    totalSize,
  };
}

export interface ImportZipOptions {
  extracted: ExtractedZipProject;
  zipFile?: File;
  projectName?: string;
  projectId?: string;
  parentPageId?: string;
  onProgress?: (progress: ImportZipProgress) => void;
}

/**
 * Imports extracted project files into Flux backend:
 * - If `parentPageId` is absent: creates new Project and root Page, then attaches child files/assets.
 * - If `parentPageId` is provided: unpacks files directly into the existing project.
 */
export async function extractAndImportZipToProject({
  extracted,
  zipFile,
  projectName,
  projectId: existingProjectId,
  parentPageId: existingParentPageId,
  onProgress,
}: ImportZipOptions): Promise<{ projectId: string; rootPageId: string; mainFileId?: string }> {
  const finalProjectName = (projectName || extracted.name || 'Imported LaTeX Project').trim();
  let effectiveProjectId = existingProjectId;
  let effectiveRootPageId = existingParentPageId;

  const totalItems = extracted.items.length;
  let processedItems = 0;

  const report = (phase: ImportZipProgress['phase'], message: string) => {
    onProgress?.({
      phase,
      message,
      current: processedItems,
      total: totalItems,
    });
  };

  // ── Step 1: Create Project if needed ─────────────────────────────────────
  if (!effectiveProjectId) {
    report('creating_project', `Creating project "${finalProjectName}"...`);
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

  // ── Step 2: Create Root Page if needed ───────────────────────────────────
  let rootPageFileId: string | undefined;

  // Identify the content to put in the root document
  const mainItem = extracted.textFiles.find((f) => f.path === extracted.mainFilePath);
  const rootContent = mainItem?.textContent || '% LaTeX document\n\\documentclass{article}\n\\begin{document}\n\\end{document}';
  const rootTitle = mainItem?.name || 'main.tex';

  if (!effectiveRootPageId) {
    report('creating_root', `Initializing root document (${rootTitle})...`);
    const createdRoot = await pageService.create({
      projectId: effectiveProjectId,
      title: rootTitle,
      content: rootContent,
      status: 'draft',
    });
    effectiveRootPageId = createdRoot?.id;
  }

  if (!effectiveRootPageId) {
    throw new Error('Failed to create or resolve root document page.');
  }

  // ── Step 3: Create Asset Directory Tree ──────────────────────────────────
  if (extracted.assetFiles.length > 0) {
    report('creating_folders', 'Creating directory structure for figures and assets...');
    const folderPaths = new Set<string>();
    for (const asset of extracted.assetFiles) {
      if (asset.folderPath) {
        const parts = asset.folderPath.split('/');
        for (let i = 1; i <= parts.length; i++) {
          folderPaths.add(parts.slice(0, i).join('/'));
        }
      }
    }

    const sortedFolders = Array.from(folderPaths).sort();
    const folderIdMap: Record<string, string> = {};

    for (const fPath of sortedFolders) {
      const parts = fPath.split('/');
      const folderName = parts[parts.length - 1];
      const parentPath = parts.slice(0, -1).join('/');
      const parentFolderId = parentPath ? folderIdMap[parentPath] : null;

      try {
        const created = await StorageService.createPageFolder(
          effectiveRootPageId,
          folderName,
          parentFolderId,
        );
        folderIdMap[fPath] =
          created && typeof created === 'object' && 'id' in created
            ? String((created as { id: unknown }).id)
            : '';
      } catch (folderErr) {
        console.warn(`[import-zip] Folder creation note for "${fPath}":`, folderErr);
      }
    }

    // ── Step 4: Upload Asset Files ─────────────────────────────────────────
    report('uploading_assets', `Uploading ${extracted.assetFiles.length} asset(s)...`);
    for (const asset of extracted.assetFiles) {
      if (!asset.blob) continue;
      const parentFolderId = asset.folderPath ? folderIdMap[asset.folderPath] : null;
      const file = new File([asset.blob], asset.name, {
        type: asset.blob.type || 'application/octet-stream',
      });

      try {
        await StorageService.uploadPageFile(
          effectiveRootPageId,
          file,
          parentFolderId,
        );
      } catch (assetErr) {
        console.error(`[import-zip] Failed to upload asset ${asset.path}:`, assetErr);
      } finally {
        processedItems++;
        report('uploading_assets', `Uploaded ${asset.name} (${processedItems}/${totalItems})`);
      }
    }
  }

  // ── Step 5: Create Child Text Documents (.tex, .bib, .sty, etc.) ────────
  report('creating_files', `Extracting ${extracted.textFiles.length} source file(s)...`);

  for (const textFile of extracted.textFiles) {
    // If this file was already used as root page content and we're initializing a new root page
    if (!existingParentPageId && textFile.path === extracted.mainFilePath) {
      processedItems++;
      continue;
    }

    try {
      const createdChild = await fileService.create({
        parentPageId: effectiveRootPageId,
        title: textFile.path,
        content: textFile.textContent,
      });

      if (textFile.path === extracted.mainFilePath) {
        rootPageFileId = createdChild.id;
      }
    } catch (textErr) {
      console.error(`[import-zip] Failed to create source file ${textFile.path}:`, textErr);
    } finally {
      processedItems++;
      report('creating_files', `Created ${textFile.name} (${processedItems}/${totalItems})`);
    }
  }

  // ── Step 6: Finalize Main Document ───────────────────────────────────────
  if (rootPageFileId) {
    try {
      await fileService.setMain({
        pageId: effectiveRootPageId,
        fileId: rootPageFileId,
      });
    } catch (setMainErr) {
      console.warn('[import-zip] Note setting main file:', setMainErr);
    }
  }

  // Server-side ZIP import sync if projectId is active
  if (effectiveProjectId && zipFile) {
    try {
      await manuscriptService.export.importProjectZip(effectiveProjectId, zipFile);
    } catch {
      // Non-fatal fallback when offline or local-only
    }
  }

  report('done', 'Import complete!');

  return {
    projectId: effectiveProjectId,
    rootPageId: effectiveRootPageId,
    mainFileId: rootPageFileId,
  };
}
