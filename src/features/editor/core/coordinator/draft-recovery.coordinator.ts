/**
 * draft-recovery.coordinator.ts
 *
 * Manages local crash-resilience draft snapshots, recovery decision gates,
 * and remote-vs-local conflict detection & resolution for document sessions.
 */

import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import {
  draftStorageService,
  type DraftSnapshot,
} from '@/features/editor/domain/document/draft-storage';
import { multiTabBus } from '@/shared/lib/multi-tab';
import { useConnectivityStore } from '../store/connectivity.store';

export interface DocumentConflict {
  fileId: string;
  localContent: string;
  remoteContent: string;
  detectedAt: number;
  currentRev?: number;
  hasAuthoritativeRemote?: boolean;
}

export type ConflictListener = (conflict: DocumentConflict) => void;

export class DraftRecoveryCoordinator {
  private readonly draftTimers = new Map<string, NodeJS.Timeout>();
  private readonly pendingDrafts = new Map<string, { content: string; projectId?: string }>();
  /** Files whose local draft is awaiting a user restore/discard decision. */
  private readonly draftDecisionPending = new Set<string>();
  /** Unresolved remote-vs-local conflicts, keyed by fileId. */
  private readonly conflicts = new Map<string, DocumentConflict>();
  private readonly conflictListeners = new Set<ConflictListener>();

  constructor(private readonly resolveEffectiveProjectId: (projectId?: string) => string) {}

  // ── Draft recovery decision gate ───────────────────────────────────────────

  /**
   * While a draft recovery decision is pending, local draft snapshots for the file are
   * suppressed so stale server content can never overwrite the recoverable draft.
   */
  public beginDraftDecision(fileId: string): void {
    this.draftDecisionPending.add(fileId);
    const timer = this.draftTimers.get(fileId);
    if (timer) {
      clearTimeout(timer);
      this.draftTimers.delete(fileId);
    }
    this.pendingDrafts.delete(fileId);
  }

  public endDraftDecision(fileId: string): void {
    this.draftDecisionPending.delete(fileId);
  }

  public isDraftDecisionPending(fileId: string): boolean {
    return this.draftDecisionPending.has(fileId);
  }

  // ── Draft persistence ──────────────────────────────────────────────────────

  public flushDraftNow(fileId: string, content: string, projectId?: string): void {
    const timer = this.draftTimers.get(fileId);
    if (timer) {
      clearTimeout(timer);
      this.draftTimers.delete(fileId);
    }
    this.pendingDrafts.delete(fileId);
    const resolvedProjectId = this.resolveEffectiveProjectId(projectId);
    const expectedRev = lruDocumentCache.getModel(fileId)?.serverRev;
    if (expectedRev !== undefined) {
      draftStorageService.saveMemoryDraft(fileId, content, projectId, undefined, expectedRev);
      draftStorageService.saveDraft(fileId, content, resolvedProjectId, undefined, expectedRev).catch(() => {});
    } else {
      draftStorageService.saveMemoryDraft(fileId, content, projectId);
      draftStorageService.saveDraft(fileId, content, resolvedProjectId).catch(() => {});
    }
    multiTabBus.publish({
      type: 'EDITOR_OFFLINE_DRAFT_UPDATED',
      fileId,
      projectId: resolvedProjectId,
      content,
      updatedAt: Date.now(),
    });
  }

  public flushPendingDrafts(): void {
    for (const [fileId, pending] of this.pendingDrafts.entries()) {
      const timer = this.draftTimers.get(fileId);
      if (timer) {
        clearTimeout(timer);
        this.draftTimers.delete(fileId);
      }
      const expectedRev = lruDocumentCache.getModel(fileId)?.serverRev;
      const resolvedProj = this.resolveEffectiveProjectId(pending.projectId);
      const savePromise =
        expectedRev !== undefined
          ? draftStorageService.saveDraft(fileId, pending.content, resolvedProj, undefined, expectedRev)
          : draftStorageService.saveDraft(fileId, pending.content, resolvedProj);
      savePromise.catch(() => {});
    }
    this.pendingDrafts.clear();
  }

  public saveDraftSnapshot(fileId: string, content: string, projectId?: string): void {
    if (this.draftDecisionPending.has(fileId)) return;

    const expectedRev = lruDocumentCache.getModel(fileId)?.serverRev;
    if (expectedRev !== undefined) {
      draftStorageService.saveMemoryDraft(fileId, content, projectId, undefined, expectedRev);
    } else {
      draftStorageService.saveMemoryDraft(fileId, content, projectId);
    }

    const existingTimer = this.draftTimers.get(fileId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.draftTimers.delete(fileId);
    }

    this.pendingDrafts.set(fileId, { content, projectId });
    const timer = setTimeout(() => {
      this.draftTimers.delete(fileId);
      const pending = this.pendingDrafts.get(fileId);
      if (pending) {
        this.pendingDrafts.delete(fileId);
        const resolvedProjectId = this.resolveEffectiveProjectId(pending.projectId);
        const latestRev = lruDocumentCache.getModel(fileId)?.serverRev;
        const savePromise =
          latestRev !== undefined
            ? draftStorageService.saveDraft(
                fileId,
                pending.content,
                resolvedProjectId,
                undefined,
                latestRev,
              )
            : draftStorageService.saveDraft(fileId, pending.content, resolvedProjectId);
        savePromise.catch(() => {});
        multiTabBus.publish({
          type: 'EDITOR_OFFLINE_DRAFT_UPDATED',
          fileId,
          projectId: resolvedProjectId,
          content: pending.content,
          updatedAt: Date.now(),
        });
      }
    }, 600);
    this.draftTimers.set(fileId, timer);
  }

  public clearDraftSnapshot(fileId: string): void {
    if (this.draftDecisionPending.has(fileId)) return;
    const timer = this.draftTimers.get(fileId);
    if (timer) {
      clearTimeout(timer);
      this.draftTimers.delete(fileId);
    }
    this.pendingDrafts.delete(fileId);
    draftStorageService.clearDraft(fileId).catch(() => {});
  }

  public persistOfflineDraft(
    projectId: string | undefined,
    fileId: string,
    content: string,
    filePath?: string,
    saveSnapshot = true,
  ): void {
    const cachedModel = lruDocumentCache.getModel(fileId);
    const expectedRev = cachedModel?.serverRev;
    if (saveSnapshot) {
      this.saveDraftSnapshot(fileId, content, projectId);
    }
    const effectiveProjectId = this.resolveEffectiveProjectId(projectId);
    void draftStorageService.saveProjectFileSnapshot({
      id: fileId,
      projectId: effectiveProjectId,
      title: filePath || fileId,
      content,
      filePath,
      updatedAt: Date.now(),
    });
    void draftStorageService
      .enqueueMutation({
        fileId,
        projectId: effectiveProjectId,
        spaceId: cachedModel?.spaceId,
        pageId: cachedModel?.pageId,
        type: 'update_content',
        payload: {
          content,
          filePath,
          ...(expectedRev !== undefined ? { expectedRev } : {}),
        },
      })
      .then(async () => {
        const list = await draftStorageService.getPendingMutations().catch(() => []);
        useConnectivityStore.getState().setPendingMutationsCount(list.length);
        multiTabBus.publish({
          type: 'OFFLINE_OUTBOX_MUTATED',
          action: 'ENQUEUED',
          count: list.length,
        });
      })
      .catch(() => {});
  }

  public checkDraftRecovery(
    fileId: string,
    serverContent: string
  ): { hasRecoverableDraft: boolean; draft?: DraftSnapshot } {
    const model = lruDocumentCache.getModel(fileId);
    if (model && model.isDirty && model.content !== serverContent) {
      return {
        hasRecoverableDraft: true,
        draft: {
          fileId,
          content: model.content,
          savedAt: model.lastActiveAt,
          projectId: model.projectId,
          title: model.filePath,
        },
      };
    }
    return draftStorageService.checkDraftRecovery(fileId, serverContent);
  }

  public async checkDraftRecoveryAsync(
    fileId: string,
    serverContent: string
  ): Promise<{ hasRecoverableDraft: boolean; draft?: DraftSnapshot }> {
    const model = lruDocumentCache.getModel(fileId);
    if (model && model.isDirty && model.content !== serverContent) {
      return {
        hasRecoverableDraft: true,
        draft: {
          fileId,
          content: model.content,
          savedAt: model.lastActiveAt,
          projectId: model.projectId,
          title: model.filePath,
        },
      };
    }
    return draftStorageService.checkDraftRecoveryAsync(fileId, serverContent);
  }

  // ── Conflict surfacing ─────────────────────────────────────────────────────

  public onConflict(listener: ConflictListener): () => void {
    this.conflictListeners.add(listener);
    return () => {
      this.conflictListeners.delete(listener);
    };
  }

  public getConflict(fileId: string): DocumentConflict | undefined {
    return this.conflicts.get(fileId);
  }

  public getConflicts(): DocumentConflict[] {
    return Array.from(this.conflicts.values());
  }

  public clearConflict(fileId: string): void {
    this.conflicts.delete(fileId);
  }

  public takeConflict(fileId: string): DocumentConflict | undefined {
    const conflict = this.conflicts.get(fileId);
    if (conflict) {
      this.conflicts.delete(fileId);
    }
    return conflict;
  }

  public recordConflict(
    fileId: string,
    localContent: string,
    remoteContent: string,
    projectId?: string,
    options?: { currentRev?: number; hasAuthoritativeRemote?: boolean },
  ): void {
    const conflict: DocumentConflict = {
      fileId,
      localContent,
      remoteContent,
      detectedAt: Date.now(),
      ...(typeof options?.currentRev === 'number' ? { currentRev: options.currentRev } : {}),
      hasAuthoritativeRemote: options?.hasAuthoritativeRemote ?? true,
    };
    this.conflicts.set(fileId, conflict);
    // Make sure the local version is durably backed up while the user decides.
    this.flushDraftNow(fileId, localContent, projectId);
    if (this.conflictListeners.size === 0) {
      console.warn(`[SessionCoordinator] Unresolved remote conflict on ${fileId}; local edits kept.`);
    }
    for (const listener of this.conflictListeners) {
      try {
        listener(conflict);
      } catch (err) {
        console.error('[SessionCoordinator] conflict listener error:', err);
      }
    }
  }

  public evictFile(fileId: string): void {
    this.conflicts.delete(fileId);
    this.draftDecisionPending.delete(fileId);
  }

  public clearAll(): void {
    for (const timer of this.draftTimers.values()) {
      clearTimeout(timer);
    }
    this.draftTimers.clear();
    this.pendingDrafts.clear();
    this.draftDecisionPending.clear();
    this.conflicts.clear();
  }
}
