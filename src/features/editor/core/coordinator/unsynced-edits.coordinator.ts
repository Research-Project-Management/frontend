/**
 * unsynced-edits.coordinator.ts
 *
 * Manages debounced persistence of uncommitted local edits to `unsyncedEditsStore`,
 * recovery decision gates while prompting the user after reload, and recovery checks.
 */

import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import {
  unsyncedEditsStore,
  type UnsyncedDocEdit,
} from '@/features/editor/domain/offline-storage';
import { multiTabBus } from '@/shared/lib/multi-tab';

const UNSYNCED_SAVE_DEBOUNCE_MS = 600;

export class UnsyncedEditsCoordinator {
  private readonly saveTimers = new Map<string, NodeJS.Timeout>();
  private readonly pendingSaves = new Map<string, { content: string; projectId?: string }>();
  /** Files awaiting an explicit restore/discard decision from the user. */
  private readonly recoveryDecisionPending = new Set<string>();

  constructor(private readonly resolveEffectiveProjectId: (projectId?: string) => string) {}

  // ── Recovery decision gate ─────────────────────────────────────────────────

  /**
   * Suppresses overwriting an unsynced local edit while the user decides whether to restore it.
   */
  public beginRecoveryDecision(fileId: string): void {
    this.recoveryDecisionPending.add(fileId);
    const timer = this.saveTimers.get(fileId);
    if (timer) {
      clearTimeout(timer);
      this.saveTimers.delete(fileId);
    }
    this.pendingSaves.delete(fileId);
  }

  public endRecoveryDecision(fileId: string): void {
    this.recoveryDecisionPending.delete(fileId);
  }

  public isRecoveryDecisionPending(fileId: string): boolean {
    return this.recoveryDecisionPending.has(fileId);
  }

  // ── Unsynced edit persistence ──────────────────────────────────────────────

  public flushNow(fileId: string, content: string, projectId?: string): void {
    const timer = this.saveTimers.get(fileId);
    if (timer) {
      clearTimeout(timer);
      this.saveTimers.delete(fileId);
    }
    this.pendingSaves.delete(fileId);
    const resolvedProjectId = this.resolveEffectiveProjectId(projectId);
    const expectedRev = lruDocumentCache.getModel(fileId)?.serverRev;

    if (expectedRev !== undefined) {
      unsyncedEditsStore.saveMemory(fileId, content, projectId, undefined, expectedRev);
      unsyncedEditsStore.save(fileId, content, resolvedProjectId, undefined, expectedRev).catch(() => {});
    } else {
      unsyncedEditsStore.saveMemory(fileId, content, projectId);
      unsyncedEditsStore.save(fileId, content, resolvedProjectId).catch(() => {});
    }

    multiTabBus.publish({
      type: 'EDITOR_UNSYNCED_EDIT_UPDATED',
      fileId,
      projectId: resolvedProjectId,
      content,
      updatedAt: Date.now(),
    });
  }

  public flushPending(): void {
    for (const [fileId, pending] of this.pendingSaves.entries()) {
      const timer = this.saveTimers.get(fileId);
      if (timer) {
        clearTimeout(timer);
        this.saveTimers.delete(fileId);
      }
      const expectedRev = lruDocumentCache.getModel(fileId)?.serverRev;
      const resolvedProj = this.resolveEffectiveProjectId(pending.projectId);
      const savePromise =
        expectedRev !== undefined
          ? unsyncedEditsStore.save(fileId, pending.content, resolvedProj, undefined, expectedRev)
          : unsyncedEditsStore.save(fileId, pending.content, resolvedProj);
      savePromise.catch(() => {});
    }
    this.pendingSaves.clear();
  }

  public scheduleSave(fileId: string, content: string, projectId?: string): void {
    if (this.recoveryDecisionPending.has(fileId)) return;

    const expectedRev = lruDocumentCache.getModel(fileId)?.serverRev;
    if (expectedRev !== undefined) {
      unsyncedEditsStore.saveMemory(fileId, content, projectId, undefined, expectedRev);
    } else {
      unsyncedEditsStore.saveMemory(fileId, content, projectId);
    }

    const existingTimer = this.saveTimers.get(fileId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.saveTimers.delete(fileId);
    }

    this.pendingSaves.set(fileId, { content, projectId });
    const timer = setTimeout(() => {
      this.saveTimers.delete(fileId);
      const pending = this.pendingSaves.get(fileId);
      if (pending) {
        this.pendingSaves.delete(fileId);
        const resolvedProjectId = this.resolveEffectiveProjectId(pending.projectId);
        const latestRev = lruDocumentCache.getModel(fileId)?.serverRev;
        const savePromise =
          latestRev !== undefined
            ? unsyncedEditsStore.save(
                fileId,
                pending.content,
                resolvedProjectId,
                undefined,
                latestRev,
              )
            : unsyncedEditsStore.save(fileId, pending.content, resolvedProjectId);
        savePromise.catch(() => {});
        multiTabBus.publish({
          type: 'EDITOR_UNSYNCED_EDIT_UPDATED',
          fileId,
          projectId: resolvedProjectId,
          content: pending.content,
          updatedAt: Date.now(),
        });
      }
    }, UNSYNCED_SAVE_DEBOUNCE_MS);
    this.saveTimers.set(fileId, timer);
  }

  public clear(fileId: string): void {
    if (this.recoveryDecisionPending.has(fileId)) return;
    const timer = this.saveTimers.get(fileId);
    if (timer) {
      clearTimeout(timer);
      this.saveTimers.delete(fileId);
    }
    this.pendingSaves.delete(fileId);
    unsyncedEditsStore.clear(fileId).catch(() => {});
  }

  public checkRecoverySync(
    fileId: string,
    serverContent: string,
  ): { hasRecoverableEdit: boolean; edit?: UnsyncedDocEdit } {
    const model = lruDocumentCache.getModel(fileId);
    if (model && model.isDirty && model.content !== serverContent) {
      return {
        hasRecoverableEdit: true,
        edit: {
          fileId,
          content: model.content,
          savedAt: model.lastActiveAt,
          projectId: model.projectId,
          title: model.filePath,
        },
      };
    }
    return unsyncedEditsStore.checkRecoverySync(fileId, serverContent);
  }

  public async checkRecoveryAsync(
    fileId: string,
    serverContent: string,
  ): Promise<{ hasRecoverableEdit: boolean; edit?: UnsyncedDocEdit }> {
    const model = lruDocumentCache.getModel(fileId);
    if (model && model.isDirty && model.content !== serverContent) {
      return {
        hasRecoverableEdit: true,
        edit: {
          fileId,
          content: model.content,
          savedAt: model.lastActiveAt,
          projectId: model.projectId,
          title: model.filePath,
        },
      };
    }
    return unsyncedEditsStore.checkRecovery(fileId, serverContent);
  }

  public evictFile(fileId: string): void {
    const timer = this.saveTimers.get(fileId);
    if (timer) {
      clearTimeout(timer);
      this.saveTimers.delete(fileId);
    }
    this.pendingSaves.delete(fileId);
    this.recoveryDecisionPending.delete(fileId);
  }

  public clearAll(): void {
    for (const timer of this.saveTimers.values()) {
      clearTimeout(timer);
    }
    this.saveTimers.clear();
    this.pendingSaves.clear();
    this.recoveryDecisionPending.clear();
  }
}
