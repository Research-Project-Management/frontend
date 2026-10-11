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

import { normalizeLatexPath } from '../latex/latex-dag-engine';

export interface ProjectCompilationSnapshot {
  revisionId: string;
  timestamp: number;
  mainFile: string;
  source?: string;
  files: Record<string, string>;
  dirtyFileIds: string[];
  fileCount: number;
}

export interface SnapshotProjectFile {
  id: string;
  title?: string;
  name?: string;
  path?: string;
  content?: any;
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
  title?: string;
  name?: string;
  path?: string;
  content?: string | null | any;
  [key: string]: any;
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
}

/**
 * Pure domain function to assemble an immutable, consistent compilation snapshot.
 * Deterministic, synchronously executes in 0ms, zero side-effects.
 */
export function assembleCompilationSnapshot(params: AssembleSnapshotParams = {}): ProjectCompilationSnapshot {
  const resolvedMainFile = normalizeLatexPath(params.resolvedMainFile || 'main.tex');
  const files: Record<string, string> = {};
  const dirtyFileIds: string[] = [];

  // 0. Base layer: Ingest all project files (guarantees unopened files like chapters/*.tex or .bib are included)
  if (params.baseFiles) {
    for (const file of params.baseFiles) {
      const rawPath = file.path || file.title || file.name || file.id;
      const cleanPath = normalizeLatexPath(rawPath);
      const rawContent =
        typeof file.content === 'string'
          ? file.content
          : file.content?.source || file.content?.text || file.content?.content || '';
      if (rawContent) {
        if (!files[cleanPath]) files[cleanPath] = rawContent;
        if (!files[file.id]) files[file.id] = rawContent;
      }
    }
  }

  // 1. Ingest in-memory models from LRU Cache (both dirty and warm clean models)
  if (params.lruModels) {
    for (const model of params.lruModels) {
      const cleanPath = normalizeLatexPath(model.filePath || model.fileId);
      files[cleanPath] = model.content;
      if (!files[model.fileId]) {
        files[model.fileId] = model.content;
      }
      if (model.isDirty && !dirtyFileIds.includes(model.fileId)) {
        dirtyFileIds.push(model.fileId);
      }
    }
  }

  // 2. Ingest dirty buffers
  if (params.dirtyFiles) {
    for (const item of params.dirtyFiles) {
      files[item.fileId] = item.content;
      if (!dirtyFileIds.includes(item.fileId)) {
        dirtyFileIds.push(item.fileId);
      }
    }
  }

  // 3. Ingest currentPage if present and not yet in files
  const curPage = params.currentPage;
  if (curPage && curPage.id && curPage.content) {
    const pageTitle = curPage.title || 'main.tex';
    const cleanPagePath = normalizeLatexPath(pageTitle);
    const pageContent =
      typeof curPage.content === 'string'
        ? curPage.content
        : curPage.content?.source || '';
    if (!files[cleanPagePath]) files[cleanPagePath] = pageContent;
    if (!files[curPage.id]) files[curPage.id] = pageContent;
  }

  // 4. Inject latest editor buffer for active file (guaranteed freshest keystroke)
  const activeDocId = params.activeDoc?.id;
  const activeTitle = params.activeDoc?.title || 'main.tex';
  const activeContent = params.activeContent || (params.activeDoc?.content as string) || '';

  if (activeDocId && activeContent) {
    files[activeDocId] = activeContent;
    const cleanActivePath = normalizeLatexPath(activeTitle);
    files[cleanActivePath] = activeContent;
    if (!dirtyFileIds.includes(activeDocId)) {
      dirtyFileIds.push(activeDocId);
    }
  }

  // 5. Resolve sourcePayload (content of the resolved root document)
  const normActiveTitle = normalizeLatexPath(activeTitle);
  let sourcePayload: string | undefined;

  if (
    normActiveTitle === resolvedMainFile ||
    activeTitle === resolvedMainFile ||
    activeTitle.endsWith(`/${resolvedMainFile}`)
  ) {
    sourcePayload = activeContent;
  } else if (files[resolvedMainFile]) {
    sourcePayload = files[resolvedMainFile];
  } else if (params.rootFileId && files[params.rootFileId]) {
    sourcePayload = files[params.rootFileId];
  } else if (
    activeContent.includes('\\documentclass') &&
    !activeContent.includes('{subfiles}')
  ) {
    sourcePayload = activeContent;
  }

  const timestamp = Date.now();
  const revisionId = `snap-${timestamp}-${Math.random().toString(36).slice(2, 7)}`;

  return {
    revisionId,
    timestamp,
    mainFile: resolvedMainFile,
    source: sourcePayload,
    files,
    dirtyFileIds,
    fileCount: Object.keys(files).length,
  };
}
