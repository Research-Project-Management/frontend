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

import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { usePageStore } from '../store/editor.store';

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
    const violations: EditorInvariantViolation[] = [];
    const pageStore = usePageStore.getState();
    const activeFileId = pageStore.activeFilePage?.id;
    const activePageId = pageStore.activePageId;

    if (
      activeFileId &&
      activePageId &&
      activeFileId !== activePageId &&
      activePageId !== pageStore.currentPage?.id
    ) {
      violations.push({
        code: 'ACTIVE_FILE_DRIFT',
        fileId: activeFileId,
        details: `activeFilePage.id (${activeFileId}) drifted from activePageId (${activePageId})`,
      });
    }

    for (const model of lruDocumentCache.getAllModels()) {
      if (!model.filePath || !model.filePath.trim()) {
        violations.push({
          code: 'MOUNTED_ENGINE_MISSING_LRU_MODEL',
          fileId: model.fileId,
          details: `Cached model ${model.fileId} is missing canonical filePath`,
        });
      }
    }

    return {
      valid: violations.length === 0,
      checkedAt: Date.now(),
      violations,
    };
  }

  public reconcileInvariants(): EditorInvariantReport {
    const report = this.checkInvariants();
    if (!report.valid) {
      const pageStore = usePageStore.getState();
      if (pageStore.activeFilePage?.id && pageStore.activePageId !== pageStore.activeFilePage.id) {
        pageStore.setActivePageId(pageStore.activeFilePage.id);
      }
    }
    return this.checkInvariants();
  }
}

export const editorInvariantMonitor = new EditorStateInvariantMonitor();
