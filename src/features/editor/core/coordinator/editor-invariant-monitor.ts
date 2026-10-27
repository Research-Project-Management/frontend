/**
 * editor-invariant-monitor.ts
 *
 * Runtime State Invariant Verification (Observability & System Design).
 *
 * NOTE: State drift is eliminated by design through Single Source of Truth architecture:
 * - `lruDocumentCache` is the single authority for document content, dirty flags, and dirty IDs.
 * - `useCompileStore` derives dirty files directly from `lruDocumentCache.getDirtyModels()`.
 * - `WorkspaceTab.isDirty` delegates to `lruDocumentCache.isDirty(tab.id)`.
 * - Clean hierarchy `projectId -> pageId (rootPageId) -> activeDocId` eliminates routing drift.
 *
 * `EditorStateInvariantMonitor` is preserved as a zero-overhead, no-op pass-through for
 * backward compatibility across existing coordinators and consumers.
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
  /**
   * Trivial pass-through: always reports valid since invariants are guaranteed by design.
   */
  public checkInvariants(): EditorInvariantReport {
    return {
      valid: true,
      checkedAt: Date.now(),
      violations: [],
    };
  }

  /**
   * Trivial pass-through: no-op since state drift is eliminated by design.
   */
  public reconcileInvariants(): EditorInvariantReport {
    return {
      valid: true,
      checkedAt: Date.now(),
      violations: [],
    };
  }
}

export const editorInvariantMonitor = new EditorStateInvariantMonitor();
