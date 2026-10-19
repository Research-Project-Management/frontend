/**
 * compilation-snapshot.ts
 *
 * In-Memory Consistent Project Compilation Snapshot Domain Model (Pure Domain Layer).
 * Location: `features/editor/domain/document/compilation-snapshot.ts`
 *
 * Architecture inspired by Zed & Overleaf CLSI:
 * - Solves the Compilation Race Condition: Instead of performing blocking HTTP PUT flushes
 *   to database before compiling, we assemble an immutable in-memory snapshot of all project
 *   files across open tabs, dirty buffers, and LRU cache in 0ms.
 * - Guarantees the LaTeX compiler engine receives consistent content at timestamp T.
 * - Pure Domain logic: Zero dependencies on UI stores, command bus, or coordinators.
 */

import { normalizeLatexPath } from '@/features/editor/domain/latex/latex-dag-engine';
import { extractDocumentContentString } from '../types/core.types';

export interface ProjectCompilationSnapshot {
  revisionId: string;
  timestamp: number;
  mainFile: string;
  source?: string;
  files: Record<string, string>;
  dirtyFileIds: string[];
  fileCount: number;
}

export type SnapshotContentValue =
  | string
  | { source?: string; text?: string; content?: string }
  | null
  | undefined
  | unknown;

export interface SnapshotProjectFile {
  id: string;
  title?: string;
  name?: string;
  path?: string;
  content?: SnapshotContentValue;
}

export interface SnapshotLRUModel {
  fileId: string;
  filePath?: string;
  content: string;
  isDirty?: boolean;
}

export interface SnapshotDirtyItem {
  fileId: string;
  content: string;
}

export interface SnapshotActiveDoc {
  id?: string;
  title?: string | null;
  name?: string | null;
  path?: string | null;
  content?: SnapshotContentValue;
}

export interface AssembleSnapshotParams {
  baseFiles?: SnapshotProjectFile[];
  lruModels?: SnapshotLRUModel[];
  dirtyFiles?: SnapshotDirtyItem[];
  currentPage?: SnapshotActiveDoc | null;
  activeDoc?: SnapshotActiveDoc | null;
  activeContent?: string | null;
  rootFileId?: string;
  resolvedMainFile?: string;
  /** Optional explicit fileId -> path/title map (e.g. from the page store). */
  filePathsById?: Record<string, string>;
}

/**
 * Builds a fileId -> human path map from every available source (explicit map, project files
 * from the page store, current page, active doc). Used to avoid keying content by UUID.
 */
export function buildFilePathIndex(params: AssembleSnapshotParams): Map<string, string> {
  const index = new Map<string, string>();
  const add = (id: string | null | undefined, path: string | null | undefined) => {
    if (!id || !path || path === id) return;
    if (!index.has(id)) index.set(id, path);
  };
  if (params.filePathsById) {
    for (const [id, path] of Object.entries(params.filePathsById)) add(id, path);
  }
  for (const file of params.baseFiles ?? []) add(file.id, file.path || file.title || file.name);
  add(params.currentPage?.id, params.currentPage?.path || params.currentPage?.title || params.currentPage?.name);
  add(params.activeDoc?.id, params.activeDoc?.path || params.activeDoc?.title || params.activeDoc?.name);
  return index;
}

/**
 * Resolves a project-relative path for a fileId, preferring an explicit path when it is not a
 * raw UUID/id, falling back to `pathIndex`, then `fallbackPath`.
 */
export function resolveSnapshotFilePath(
  fileId: string | null | undefined,
  explicitPath: string | null | undefined,
  pathIndex: Map<string, string>,
  fallbackPath = 'main.tex',
): string {
  const candidate =
    (explicitPath && explicitPath !== fileId ? explicitPath : null) ||
    (fileId ? pathIndex.get(fileId) : null) ||
    explicitPath ||
    fallbackPath;
  return normalizeLatexPath(candidate);
}

/**
 * Pure function that merges base project files, LRU in-memory buffers, dirty edits,
 * and the active editor buffer into an atomic, consistent compilation snapshot.
 *
 * Precedence Order (Lowest to Highest):
 * 1. Base Project Files (Server / Store state)
 * 2. Current Page fallback
 * 3. LRU In-Memory Document Cache Models
 * 4. Dirty Files Map
 * 5. Active Editor View Buffer (Real-time keystroke content)
 */
export function assembleCompilationSnapshot(params: AssembleSnapshotParams): ProjectCompilationSnapshot {
  const timestamp = Date.now();
  const filesMap: Record<string, string> = {};
  const dirtyFileIdsSet = new Set<string>();
  const pathIndex = buildFilePathIndex(params);

  // 1. Base project files
  if (params.baseFiles && params.baseFiles.length > 0) {
    for (const file of params.baseFiles) {
      const path = resolveSnapshotFilePath(file.id, file.path || file.title || file.name, pathIndex);
      filesMap[path] = extractDocumentContentString(file.content);
    }
  }

  // 2. Current page fallback if baseFiles is empty
  if (Object.keys(filesMap).length === 0 && params.currentPage) {
    const fallbackPath = resolveSnapshotFilePath(
      params.currentPage.id,
      params.currentPage.path || params.currentPage.title || params.currentPage.name,
      pathIndex,
    );
    filesMap[fallbackPath] = extractDocumentContentString(params.currentPage.content);
  }

  // 3. Overlay LRU cache models (in-memory buffers for recently edited tabs)
  if (params.lruModels && params.lruModels.length > 0) {
    for (const model of params.lruModels) {
      if (typeof model.content === 'string') {
        const path = resolveSnapshotFilePath(model.fileId, model.filePath, pathIndex);
        filesMap[path] = model.content;
        if (model.isDirty) {
          dirtyFileIdsSet.add(model.fileId);
        }
      }
    }
  }

  // 4. Overlay explicit dirty files
  if (params.dirtyFiles && params.dirtyFiles.length > 0) {
    for (const dirty of params.dirtyFiles) {
      dirtyFileIdsSet.add(dirty.fileId);
      const mappedPath = pathIndex.get(dirty.fileId);
      if (mappedPath) {
        const normPath = normalizeLatexPath(mappedPath);
        filesMap[normPath] = dirty.content;
      } else if (
        params.activeDoc &&
        dirty.fileId === params.activeDoc.id &&
        (params.activeDoc.path || params.activeDoc.title || params.activeDoc.name)
      ) {
        const normPath = resolveSnapshotFilePath(
          params.activeDoc.id,
          params.activeDoc.path || params.activeDoc.title || params.activeDoc.name,
          pathIndex,
        );
        filesMap[normPath] = dirty.content;
      }
    }
  }

  // 5. Overlay active editor buffer (highest priority — live keystrokes)
  let activeFilePath = 'main.tex';
  if (params.activeDoc) {
    activeFilePath = resolveSnapshotFilePath(
      params.activeDoc.id,
      params.activeDoc.path || params.activeDoc.title || params.activeDoc.name,
      pathIndex,
    );
    const liveText =
      typeof params.activeContent === 'string'
        ? params.activeContent
        : extractDocumentContentString(params.activeDoc.content);
    filesMap[activeFilePath] = liveText;
  } else if (typeof params.activeContent === 'string') {
    filesMap[activeFilePath] = params.activeContent;
  }

  const mainFile = normalizeLatexPath(params.resolvedMainFile || activeFilePath || 'main.tex');
  const source = filesMap[mainFile] ?? filesMap[activeFilePath] ?? '';
  const dirtyFileIds = Array.from(dirtyFileIdsSet);

  // Deterministic revision ID based on timestamp + dirty state count
  const revisionId = `snap_${timestamp}_${dirtyFileIds.length}`;

  return {
    revisionId,
    timestamp,
    mainFile,
    source,
    files: filesMap,
    dirtyFileIds,
    fileCount: Object.keys(filesMap).length,
  };
}
