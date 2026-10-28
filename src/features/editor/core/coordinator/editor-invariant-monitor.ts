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

import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { useCompileStore } from '@/features/editor/subsystems/compiler/coordinator/compiler.store';

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
   * Verifies that useCompileStore.dirtyFileIds matches lruDocumentCache.getDirtyModels().
   */
  public checkInvariants(): EditorInvariantReport {
    const violations: EditorInvariantViolation[] = [];
    const dirtyModels = lruDocumentCache.getDirtyModels();
    const lruDirtyIds = new Set(dirtyModels.map((m) => m.fileId));
    const compileDirtyIds = useCompileStore.getState().dirtyFileIds;

    for (const fileId of lruDirtyIds) {
      if (!compileDirtyIds.has(fileId)) {
        violations.push({
          code: 'DIRTY_FLAG_MISMATCH_MISSING_IN_COMPILE_STORE',
          fileId,
          details: `File ${fileId} is dirty in lruDocumentCache but missing from useCompileStore.dirtyFileIds`,
        });
      }
    }

    for (const fileId of compileDirtyIds) {
      if (!lruDirtyIds.has(fileId)) {
        violations.push({
          code: 'DIRTY_FLAG_MISMATCH_ORPHAN_IN_COMPILE_STORE',
          fileId,
          details: `File ${fileId} is marked dirty in useCompileStore.dirtyFileIds but clean/absent in lruDocumentCache`,
        });
      }
    }

    return {
      valid: violations.length === 0,
      checkedAt: Date.now(),
      violations,
    };
  }

  /**
   * Checks invariants and reconciles useCompileStore dirty state with lruDocumentCache if needed.
   */
  public reconcileInvariants(): EditorInvariantReport {
    const report = this.checkInvariants();
    if (!report.valid) {
      const dirtyModels = lruDocumentCache.getDirtyModels();
      useCompileStore.setState({
        dirtyFileIds: new Set(dirtyModels.map((m) => m.fileId)),
        dirtyContentMap: new Map(dirtyModels.map((m) => [m.fileId, m.content])),
      });
    }
    return report;
  }
}

export const editorInvariantMonitor = new EditorStateInvariantMonitor();
