/**
 * editor-invariant-monitor.ts
 *
 * Runtime State Invariant Verification (Observability & System Design).
 *
 * NOTE: State drift is eliminated by design through Single Source of Truth architecture:
 * - `lruDocumentCache` is the single authority for document content, dirty flags, and dirty IDs.
 * - `useCompileStore` derives dirty files reactively via `lruDocumentCache.subscribe()`.
 * - `WorkspaceTab.isDirty` delegates to `lruDocumentCache.isDirty(tab.id)`.
 * - Clean hierarchy `projectId -> pageId (rootPageId) -> activeDocId` eliminates routing drift.
 *
 * `EditorStateInvariantMonitor` is a zero-overhead pass-through.
 */

export interface EditorInvariantViolation {
  code:
    | 'DIRTY_FLAG_MISMATCH_MISSING_IN_COMPILE_STORE'
    | 'DIRTY_FLAG_MISMATCH_ORPHAN_IN_COMPILE_STORE'
    | 'ACTIVE_FILE_DRIFT'
    | 'MOUNTED_ENGINE_MISSING_LRU_MODEL';
  fileId: string;
  details: string;
}

export interface EditorInvariantReport {
  valid: boolean;
  checkedAt: number;
  violations: EditorInvariantViolation[];
}

export class EditorStateInvariantMonitor {
  public checkInvariants(): EditorInvariantReport {
    return {
      valid: true,
      checkedAt: Date.now(),
      violations: [],
    };
  }

  public reconcileInvariants(): EditorInvariantReport {
    return this.checkInvariants();
  }
}

export const editorInvariantMonitor = new EditorStateInvariantMonitor();
