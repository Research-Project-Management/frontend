/**
 * editor-workspace-lifecycle.ts
 *
 * Centralized Feature-Level Teardown & Reset Entrypoint for the LaTeX Editor.
 * Lives at the feature root (`features/editor/`) so it can cleanly coordinate
 * reset across `core/`, `domain/`, and `subsystems/` without introducing reverse dependencies.
 */

import { memoryGovernor } from '@/shared/lib/memory-governor';
import { workspaceCoordinator } from './core/coordinator/workspace.coordinator';
import {
  clearVisualFigureBlobCache,
  getVisualFigureBlobCacheSize,
} from './core/engine/extensions/latex-visual-floats';
import {
  clearKaTeXRenderCache,
  getKaTeXRenderCacheSize,
} from './core/engine/extensions/latex-visual-math';
import { useDocumentCollaborationStore } from './core/store/collaboration.store';
import { useSearchStore } from './core/store/search.store';
import { lruDocumentCache } from './domain/document/lru-document-cache';
import { latexSymbolsIndex } from './domain/latex/latex-symbols-index';
import { latexDependencyGraph } from './domain/latex/dependency-graph';
import { warmEditorStatePool } from './domain/workspace/editor-tab-pool.domain';
import {
  compilerCoordinator,
  useCompileStore,
  useViewerStore,
} from './subsystems/compiler';
import { diagnosticsCoordinator } from './subsystems/diagnostics/coordinator/diagnostics.coordinator';
import { reviewCoordinator } from './subsystems/review';
import { navigationCoordinator } from './subsystems/navigation/coordinator/navigation.coordinator';

export interface ResetEditorWorkspaceOptions {
  /**
   * Skip flushing pending Yjs edits before clearing the provider pool.
   * Defaults to `true` for hard resets/tests; route transitions pass `false`.
   */
  skipFlush?: boolean;
  /** Optional workspace/page scope identifier emitted with the `workspace:reset` command. */
  scopeId?: string;
}

/**
 * Synchronously resets all workspace-scoped editor singletons, Zustand stores,
 * caches, diagnostics, and Yjs provider pools so switching pages/projects never leaks stale state.
 */
export function resetEditorWorkspace(options: ResetEditorWorkspaceOptions = {}): void {
  const { skipFlush = true, scopeId } = options;

  compilerCoordinator.dispose();
  useCompileStore.getState().resetCompiler();
  useViewerStore.getState().resetViewerState();

  workspaceCoordinator.resetAllState({ skipFlush, scopeId });
  warmEditorStatePool.clear();
  clearVisualFigureBlobCache();
  clearKaTeXRenderCache();

  latexSymbolsIndex.clear();
  latexDependencyGraph.clear();
  diagnosticsCoordinator.clear();
  reviewCoordinator.reset();
  navigationCoordinator.clearPendingLineJump();
  navigationCoordinator.resetDiagnosticState();
  useSearchStore.getState().reset();

  const collabStore = useDocumentCollaborationStore.getState();
  collabStore.clearCollaborators();
  collabStore.clearPendingComment();
  collabStore.resetUnreadChatCount();
}

if (typeof window !== 'undefined') {
  memoryGovernor.register({
    id: 'editor-workspace-memory',
    domain: 'editor',
    priority: 20,
    reclaim: ({ level }) => {
      if (level === 'logout') {
        const docStats = lruDocumentCache.getStats();
        const evicted =
          docStats.size +
          warmEditorStatePool.size +
          getVisualFigureBlobCacheSize() +
          getKaTeXRenderCacheSize();
        resetEditorWorkspace({ skipFlush: true });
        return evicted;
      }

      if (level === 'route-handover' || level === 'tab-hidden' || level === 'pressure') {
        const evicted =
          warmEditorStatePool.size +
          getVisualFigureBlobCacheSize() +
          getKaTeXRenderCacheSize();
        warmEditorStatePool.clear();
        clearVisualFigureBlobCache();
        clearKaTeXRenderCache();
        return evicted;
      }
      return 0;
    },
    getStats: () => {
      const docStats = lruDocumentCache.getStats();
      const warmTabs = warmEditorStatePool.size;
      const figureBlobs = getVisualFigureBlobCacheSize();
      const katexEntries = getKaTeXRenderCacheSize();
      return {
        id: 'editor-workspace-memory',
        domain: 'editor',
        entryCount: docStats.size + warmTabs + figureBlobs + katexEntries,
        estimatedBytes: docStats.totalBytes,
        details: {
          lruDocs: docStats.size,
          lruDirtyDocs: docStats.dirtyCount,
          warmEditorTabs: warmTabs,
          figureBlobs,
          katexEntries,
        },
      };
    },
  });
}
