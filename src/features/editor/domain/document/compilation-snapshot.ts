/**
 * compilation-snapshot.ts
 *
 * In-Memory Consistent Project Compilation Snapshot Provider (Block 2: Domain Layer).
 * Location: `features/editor/domain/compilation-snapshot.ts`
 *
 * Architecture inspired by Zed & Overleaf CLSI:
 * - Solves the Compilation Race Condition: Instead of performing blocking HTTP PUT flushes
 *   to database before compiling, we assemble an immutable in-memory snapshot of all project
 *   files across open tabs, dirty buffers, and LRU cache in 0ms.
 * - Guarantees the LaTeX compiler engine receives consistent content at timestamp T.
 * - Database persistence (auto-save) runs completely decoupled in the background.
 */

import { lruDocumentCache } from './lru-document-cache';
import { useCompileStore } from '../../store/compiler.store';
import { usePageStore } from '../../store/editor.store';
import { getActiveEditorContent } from '../../coordinators/command-bus';
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

export interface CreateSnapshotOptions {
  rootFileId?: string;
  resolvedMainFile?: string;
}

export class CompilationSnapshotProvider {
  /**
   * Assembles an atomic, immutable snapshot of all project files in 0ms.
   * Zero network calls. Pure synchronous in-memory aggregation.
   */
  public static createSnapshot(options: CreateSnapshotOptions = {}): ProjectCompilationSnapshot {
    const pageStore = usePageStore.getState();
    const compileStore = useCompileStore.getState();

    const activeDoc = pageStore.activeFilePage || pageStore.currentPage;
    const activeDocId = activeDoc?.id;
    const activeTitle = activeDoc?.title || 'main.tex';
    const activeContent = getActiveEditorContent() || (activeDoc?.content as string) || '';

    const resolvedMainFile = normalizeLatexPath(options.resolvedMainFile || 'main.tex');
    const files: Record<string, string> = {};
    const dirtyFileIds: string[] = [];

    // 1. Ingest all in-memory models from LRU Cache (both dirty and warm clean models)
    const allModels = lruDocumentCache.getAllModels();
    for (const model of allModels) {
      const cleanPath = normalizeLatexPath(model.filePath || model.fileId);
      files[cleanPath] = model.content;
      if (!files[model.fileId]) {
        files[model.fileId] = model.content;
      }
      if (model.isDirty && !dirtyFileIds.includes(model.fileId)) {
        dirtyFileIds.push(model.fileId);
      }
    }

    // 2. Ingest all dirty buffers from compileStore
    const dirtyList = compileStore.getDirtyFiles();
    for (const item of dirtyList) {
      files[item.fileId] = item.content;
      if (!dirtyFileIds.includes(item.fileId)) {
        dirtyFileIds.push(item.fileId);
      }
    }

    // 3. Ingest currentPage if present and not yet in files
    const currentPage = pageStore.currentPage as any;
    if (currentPage && currentPage.id && currentPage.content) {
      const pageTitle = currentPage.title || 'main.tex';
      const cleanPagePath = normalizeLatexPath(pageTitle);
      const pageContent =
        typeof currentPage.content === 'string'
          ? currentPage.content
          : currentPage.content?.source || '';
      if (!files[cleanPagePath]) files[cleanPagePath] = pageContent;
      if (!files[currentPage.id]) files[currentPage.id] = pageContent;
    }

    // 4. Inject latest editor buffer for active file (guaranteed freshest keystroke)
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
    } else if (options.rootFileId && files[options.rootFileId]) {
      sourcePayload = files[options.rootFileId];
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
}

export const compilationSnapshotProvider = CompilationSnapshotProvider;
