/**
 * compilation-snapshot.coordinator.ts
 *
 * Application Coordinator for assembling in-memory compilation snapshots.
 * Location: `features/editor/coordinators/compilation-snapshot.coordinator.ts`
 *
 * Implements the Hexagonal / Clean Architecture Application Coordinator:
 * Queries active UI state (Zustand stores, active CodeMirror view, workspace coordinator)
 * and delegates pure snapshot assembly to the Domain layer (`assembleCompilationSnapshot`).
 */

import {
  assembleCompilationSnapshot,
  type ProjectCompilationSnapshot,
  type SnapshotProjectFile,
} from '../domain/document/compilation-snapshot';
import { lruDocumentCache } from '../domain/document/lru-document-cache';
import { useCompileStore } from '../store/compiler.store';
import { usePageStore } from '../store/editor.store';
import { getActiveEditorContent } from './command-bus';
import { workspaceCoordinator } from './workspace.coordinator';

export interface CreateSnapshotOptions {
  rootFileId?: string;
  resolvedMainFile?: string;
  projectFiles?: SnapshotProjectFile[];
}

export class CompilationSnapshotProvider {
  /**
   * Assembles an atomic, immutable snapshot of all project files in 0ms.
   * Zero network calls. Synchronous in-memory state aggregation.
   */
  public static createSnapshot(options: CreateSnapshotOptions = {}): ProjectCompilationSnapshot {
    const pageStore = usePageStore.getState();
    const compileStore = useCompileStore.getState();

    const activeDoc = pageStore.getActiveDocument();
    const activeContent = getActiveEditorContent() || (activeDoc?.content as string) || '';

    const baseFiles = options.projectFiles || workspaceCoordinator.getProjectFiles() || [];
    const lruModels = lruDocumentCache.getAllModels();
    const dirtyFiles = compileStore.getDirtyFiles();

    return assembleCompilationSnapshot({
      baseFiles,
      lruModels,
      dirtyFiles,
      currentPage: pageStore.currentPage,
      activeDoc,
      activeContent,
      rootFileId: options.rootFileId,
      resolvedMainFile: options.resolvedMainFile,
    });
  }
}

export const compilationSnapshotProvider = CompilationSnapshotProvider;
