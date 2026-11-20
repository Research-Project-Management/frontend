/**
 * editor-workspace-lifecycle.ts
 *
 * Centralized Feature-Level Teardown & Reset Entrypoint for the LaTeX Editor.
 * Lives at the feature root (`features/editor/`) so it can cleanly coordinate
 * reset across `core/`, `domain/`, and `subsystems/` without introducing reverse dependencies.
 */

import { workspaceCoordinator } from './core/coordinator/workspace.coordinator';
import { useDocumentCollaborationStore } from './core/store/collaboration.store';
import { useSearchStore } from './core/store/search.store';
import { latexSymbolsIndex } from './domain/latex/latex-symbols-index';
import { latexDependencyGraph } from './domain/latex/dependency-graph';
import { warmEditorStatePool } from './domain/workspace/editor-tab-pool.domain';
import {
  compilerCoordinator,
  useCompileStore,
  useViewerStore,
} from './subsystems/compiler';
import { diagnosticsCoordinator } from './subsystems/diagnostics/coordinator/diagnostics.coordinator';
import { reviewCoordinator } from './subsystems/review/coordinator/review.coordinator';
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

  workspaceCoordinator.resetAllState();
  warmEditorStatePool.clear();

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
