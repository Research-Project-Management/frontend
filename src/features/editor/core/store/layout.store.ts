/**
 * layout.store.ts
 *
 * Workbench Layout State Store (State Layer).
 *
 * Unified Facade over useWorkspaceStore (Matt Pocock Deep Module Pattern).
 * All workbench layout states, dimensions, and actions are now centralized in
 * `workspace.store.ts` to ensure a single source of truth without desynchronization.
 *
 * Location: `frontend/src/features/editor/store/layout.store.ts`
 */

import { useWorkspaceStore } from './workspace.store';

export type {
  ActivityBarTab,
  EditorSplitMode,
  ActiveEditorPane,
  LayoutState,
} from './workspace.store';

/**
 * useLayoutStore
 * Re-exported facade directing 100% of calls to the unified useWorkspaceStore.
 */
export const useLayoutStore = useWorkspaceStore;
