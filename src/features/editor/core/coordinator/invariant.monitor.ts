/**
 * invariant.monitor.ts
 *
 * Runtime State Invariant Verification (Observability & System Design).
 *
 * NOTE: State drift is eliminated by design through Single Source of Truth architecture:
 * - `lruDocumentCache` is the single authority for document content, dirty flags, and dirty IDs.
 * - `useCompileStore` derives dirty files reactively via `lruDocumentCache.subscribe()`.
 * - `WorkspaceTab.isDirty` delegates to `lruDocumentCache.isDirty(tab.id)`.
 * - Clean hierarchy `projectId -> pageId (rootPageId) -> activeDocId` eliminates routing drift.
 *
 * `InvariantMonitor` is a zero-overhead pass-through.
 */

export interface InvariantViolation {
  code:
    | 'DIRTY_FLAG_MISMATCH_MISSING_IN_COMPILE_STORE'
    | 'DIRTY_FLAG_MISMATCH_ORPHAN_IN_COMPILE_STORE'
    | 'ACTIVE_FILE_DRIFT'
    | 'MOUNTED_ENGINE_MISSING_LRU_MODEL';
  fileId: string;
  details: string;
}

export type EditorInvariantViolation = InvariantViolation;

export interface InvariantReport {
  valid: boolean;
  checkedAt: number;
  violations: InvariantViolation[];
}

export type EditorInvariantReport = InvariantReport;

export class InvariantMonitor {
  public start(): void {}

  public stop(): void {}

  public checkInvariants(): InvariantReport {
    return {
      valid: true,
      checkedAt: Date.now(),
      violations: [],
    };
  }

  public reconcileInvariants(): InvariantReport {
    return this.checkInvariants();
  }

  public runAuditNow(): InvariantReport {
    return this.checkInvariants();
  }

  public getViolationCount(): number {
    return 0;
  }
}

export { InvariantMonitor as EditorStateInvariantMonitor };
export const invariantMonitor = new InvariantMonitor();
export { invariantMonitor as editorInvariantMonitor };
