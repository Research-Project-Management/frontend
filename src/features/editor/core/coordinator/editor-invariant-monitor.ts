/**
 * editor-invariant-monitor.ts
 *
 * Runtime State Invariant Verification & Self-Healing Monitor (Observability & System Design).
 *
 * Verifies cross-store consistency invariants across:
 * 1. `useCompileStore.dirtyFiles` <-> `lruDocumentCache.getDirtyModels()`
 * 2. `useWorkspaceStore.activeByProject` <-> `lruDocumentCache.getActiveFileId()`
 * 3. `getAllRegisteredEngines()` <-> `lruDocumentCache` registration
 *
 * Supports both diagnostic inspection (`checkInvariants()`) and automatic self-healing
 * (`reconcileInvariants()`) so transient state drift is deterministically corrected.
 */

import { getAllRegisteredEngines } from '@/features/editor/core/bus/command-bus';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { useWorkspaceStore } from '@/features/editor/core/store/workspace.store';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { useCompileStore } from '@/features/editor/subsystems/compiler';

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
   * Evaluates all cross-store editor invariants without mutating state.
   */
  public checkInvariants(): EditorInvariantReport {
    const violations: EditorInvariantViolation[] = [];
    const compileState = useCompileStore.getState();
    const dirtyModels = lruDocumentCache.getDirtyModels();
    const dirtyModelIds = new Set(dirtyModels.map((m) => m.fileId));

    // Invariant 1a: Every dirty model in LRU cache must be reflected in compileStore.dirtyFileIds
    for (const model of dirtyModels) {
      if (!compileState.isDirtyFile(model.fileId)) {
        violations.push({
          code: 'DIRTY_FLAG_MISMATCH_MISSING_IN_COMPILE_STORE',
          fileId: model.fileId,
          details: `LRU model '${model.fileId}' is dirty, but missing from useCompileStore.dirtyFileIds`,
        });
      }
    }

    // Invariant 1b: Every entry in compileStore.dirtyFileIds that exists in LRU cache must be marked dirty
    for (const fileId of compileState.dirtyFileIds) {
      const model = lruDocumentCache.getModel(fileId);
      if (model && !dirtyModelIds.has(fileId)) {
        violations.push({
          code: 'DIRTY_FLAG_MISMATCH_ORPHAN_IN_COMPILE_STORE',
          fileId,
          details: `useCompileStore.dirtyFileIds contains '${fileId}', but its LRU model is clean`,
        });
      }
    }

    // Invariant 2: Active file in PageStore/WorkspaceStore should align with lruDocumentCache.activeFileId
    const pageState = usePageStore.getState();
    const expectedActiveId =
      pageState.activeFilePage?.id ||
      pageState.activePageId ||
      pageState.currentPage?.id ||
      null;
    const lruActiveId = lruDocumentCache.getActiveFileId();
    if (
      expectedActiveId &&
      lruActiveId &&
      expectedActiveId !== lruActiveId &&
      lruDocumentCache.hasModel(expectedActiveId)
    ) {
      violations.push({
        code: 'ACTIVE_FILE_DRIFT',
        fileId: expectedActiveId,
        details: `Active document is '${expectedActiveId}', but lruDocumentCache.activeFileId is '${lruActiveId}'`,
      });
    }

    // Invariant 3: Mounted CodeMirror engines with a fileId should have an initialized LRU model
    const engines = getAllRegisteredEngines();
    for (const [fileId] of engines.entries()) {
      if (fileId && !fileId.startsWith('__') && !lruDocumentCache.hasModel(fileId)) {
        violations.push({
          code: 'MOUNTED_ENGINE_MISSING_LRU_MODEL',
          fileId,
          details: `Mounted CodeMirror engine for '${fileId}' has no corresponding model in lruDocumentCache`,
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
   * Checks invariants and automatically reconciles any detected drift.
   */
  public reconcileInvariants(): EditorInvariantReport {
    const report = this.checkInvariants();
    if (report.valid) return report;

    const compileStore = useCompileStore.getState();
    const engines = getAllRegisteredEngines();

    for (const v of report.violations) {
      switch (v.code) {
        case 'DIRTY_FLAG_MISMATCH_MISSING_IN_COMPILE_STORE': {
          const model = lruDocumentCache.getModel(v.fileId);
          if (model?.isDirty) {
            compileStore.markDirty(v.fileId, model.content);
          }
          break;
        }
        case 'DIRTY_FLAG_MISMATCH_ORPHAN_IN_COMPILE_STORE': {
          compileStore.clearDirty(v.fileId);
          break;
        }
        case 'ACTIVE_FILE_DRIFT': {
          lruDocumentCache.setActiveFileId(v.fileId);
          break;
        }
        case 'MOUNTED_ENGINE_MISSING_LRU_MODEL': {
          const eng = engines.get(v.fileId);
          if (eng) {
            const pageState = usePageStore.getState();
            const wsState = useWorkspaceStore.getState();
            const projectId =
              pageState.projectId ||
              pageState.parentPageId ||
              Object.keys(wsState.tabsByProject)[0] ||
              undefined;
            lruDocumentCache.registerModel(v.fileId, {
              content: eng.getContent() || '',
              filePath: v.fileId,
              projectId,
            });
          }
          break;
        }
      }
    }

    return report;
  }
}

export const editorInvariantMonitor = new EditorStateInvariantMonitor();
