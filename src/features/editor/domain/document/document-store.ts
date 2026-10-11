/**
 * document-store.ts
 *
 * Deep Module: Unified Multi-Tier Document Storage (Domain Layer).
 *
 * Encapsulates the multi-tier storage hierarchy:
 * - Tier 1: In-Memory Bounded LRU Cache (RAM, O(1), active file protection)
 * - Tier 2: Persistent Offline Drafts (IndexedDB + LocalStorage fallback)
 *
 * Provides a deep, high-leverage seam for the Editor subsystem:
 * Callers interact with a single coherent API without juggling memory vs disk sync.
 */

import {
  LRUDocumentCache,
  lruDocumentCache,
  type DocumentModelState,
  type DocumentCursorSelection,
  type DocumentScrollViewport,
  type ModelChangeListener,
  type ModelEvictionListener,
  type DocumentModelStats,
} from './lru-document-cache';
import {
  draftStorageService,
  DraftStorageServiceRegistry,
  type DraftSnapshot,
  type IDraftStorageSink,
  type ProjectFileSnapshot,
  type OfflineMutation,
  type OfflineMutationType,
} from './draft-storage';

export type { ProjectFileSnapshot, OfflineMutation, OfflineMutationType };

export interface UpdateContentOptions {
  isDirty?: boolean;
  projectId?: string;
  filePath?: string;
}

export interface DocumentStoreRecoveryResult {
  hasRecoverableDraft: boolean;
  draft?: DraftSnapshot;
}

export class DocumentStore {
  constructor(
    public readonly cache: LRUDocumentCache = lruDocumentCache,
    public readonly storage: DraftStorageServiceRegistry = draftStorageService
  ) {
    // Wire persistence seam into LRU cache for automatic eviction flushing
    this.cache.setPersistenceSink(this.storage);
  }

  /**
   * Fast synchronous in-memory document retrieval.
   */
  public get(fileId: string): DocumentModelState | undefined {
    return this.cache.getModel(fileId);
  }

  public getModel(fileId: string): DocumentModelState | undefined {
    return this.cache.getModel(fileId);
  }

  public has(fileId: string): boolean {
    return this.cache.has(fileId);
  }

  public getContent(fileId: string): string | undefined {
    return this.cache.getContent(fileId);
  }

  public isDirty(fileId: string): boolean {
    return this.cache.isDirty(fileId);
  }

  public getDirtyModels(): DocumentModelState[] {
    return this.cache.getDirtyModels();
  }

  public getAllModels(): DocumentModelState[] {
    return this.cache.getAllModels();
  }

  public getStats(): DocumentModelStats {
    return this.cache.getStats();
  }

  /**
   * Hydrates a model from Tier 2 persistence (IndexedDB/LocalStorage) if evicted or not yet loaded in RAM.
   */
  public async getModelAsync(
    fileId: string,
    fallbackContent: string,
    filePath?: string,
    projectId?: string
  ): Promise<DocumentModelState> {
    return this.cache.hydrateModelAsync(fileId, fallbackContent, filePath, projectId);
  }

  /**
   * Warms or updates model registration in memory.
   */
  public warm(
    fileId: string,
    initialData: {
      content: string;
      filePath?: string;
      projectId?: string;
      yText?: any | null;
      selection?: DocumentCursorSelection;
      scrollViewport?: DocumentScrollViewport;
    }
  ): DocumentModelState {
    return this.cache.warm(fileId, initialData);
  }

  /**
   * Updates document content in RAM and optionally backs up dirty snapshot to persistence.
   */
  public updateContent(
    fileId: string,
    content: string,
    options?: UpdateContentOptions
  ): void {
    const isDirty = options?.isDirty ?? true;
    this.cache.updateContent(fileId, content, isDirty);

    if (isDirty) {
      const model = this.cache.getModel(fileId);
      const projectId = options?.projectId || model?.projectId;
      const filePath = options?.filePath || model?.filePath;
      this.storage.saveDraft(fileId, content, projectId, filePath).catch(() => {});
    }
  }

  /**
   * Marks a model as clean (saved remotely) and removes any local recovery draft.
   */
  public markClean(fileId: string): void {
    this.cache.markClean(fileId);
    this.storage.clearDraft(fileId).catch(() => {});
  }

  public markDirty(fileId: string): void {
    this.cache.markDirty(fileId);
  }

  /**
   * Explicitly persists a draft snapshot to Tier 2 storage.
   */
  public async saveDraft(
    fileId: string,
    content: string,
    projectId?: string,
    title?: string
  ): Promise<void> {
    return this.storage.saveDraft(fileId, content, projectId, title);
  }

  /**
   * Clears a persisted draft snapshot across all storage tiers.
   */
  public async clearDraft(fileId: string): Promise<void> {
    return this.storage.clearDraft(fileId);
  }

  /**
   * Checks whether a recoverable offline draft exists for this file in Memory or LocalStorage.
   */
  public checkDraftRecovery(
    fileId: string,
    serverContent: string
  ): DocumentStoreRecoveryResult {
    // 1. Check hot RAM model
    const memoryModel = this.cache.getModel(fileId);
    if (memoryModel && memoryModel.isDirty && memoryModel.content !== serverContent) {
      return {
        hasRecoverableDraft: true,
        draft: {
          fileId,
          content: memoryModel.content,
          savedAt: memoryModel.lastActiveAt,
          projectId: memoryModel.projectId,
          title: memoryModel.filePath,
        },
      };
    }

    // 2. Check sync persistent storage (LocalStorage)
    return this.storage.checkDraftRecovery(fileId, serverContent);
  }

  /**
   * Checks whether a recoverable offline draft exists across all tiers (including IndexedDB).
   */
  public async checkDraftRecoveryAsync(
    fileId: string,
    serverContent: string
  ): Promise<DocumentStoreRecoveryResult> {
    const syncCheck = this.checkDraftRecovery(fileId, serverContent);
    if (syncCheck.hasRecoverableDraft) return syncCheck;

    return this.storage.checkDraftRecoveryAsync(fileId, serverContent);
  }

  /**
   * Retrieves all recent drafts for a specific project.
   */
  public async getRecentDraftsForProject(projectId: string): Promise<DraftSnapshot[]> {
    return this.storage.getRecentDraftsForProject(projectId);
  }

  /**
   * Saves snapshot of project file to Tier 2 persistent cache.
   */
  public async saveProjectFileSnapshot(file: ProjectFileSnapshot): Promise<void> {
    return this.storage.saveProjectFileSnapshot(file);
  }

  /**
   * Batch saves snapshots for multiple project files.
   */
  public async saveProjectFilesSnapshot(files: ProjectFileSnapshot[]): Promise<void> {
    return this.storage.saveProjectFilesSnapshot(files);
  }

  /**
   * Retrieves a cached project file snapshot.
   */
  public async getProjectFileSnapshot(fileId: string): Promise<ProjectFileSnapshot | null> {
    return this.storage.getProjectFileSnapshot(fileId);
  }

  /**
   * Retrieves all cached file snapshots for a project.
   */
  public async getProjectFilesSnapshot(projectId: string): Promise<ProjectFileSnapshot[]> {
    return this.storage.getProjectFilesSnapshot(projectId);
  }

  /**
   * Enqueues an offline mutation for deferred replay.
   */
  public async enqueueMutation(
    mutationData: Omit<OfflineMutation, 'id' | 'timestamp' | 'status' | 'retryCount'>
  ): Promise<OfflineMutation> {
    return this.storage.enqueueMutation(mutationData);
  }

  /**
   * Retrieves all pending mutations for synchronization.
   */
  public async getPendingMutations(): Promise<OfflineMutation[]> {
    return this.storage.getPendingMutations();
  }

  /**
   * Removes a processed mutation from the queue.
   */
  public async removeMutation(id: number): Promise<void> {
    return this.storage.removeMutation(id);
  }

  public setActiveFileId(fileId: string | null): void {
    this.cache.setActiveFileId(fileId);
  }

  public setCapacity(newCapacity: number): void {
    this.cache.setCapacity(newCapacity);
  }

  public evict(fileId: string): void {
    this.cache.evictModel(fileId);
  }

  public clear(): void {
    this.cache.clearAll();
  }

  public subscribe(listener: ModelChangeListener): () => void {
    return this.cache.subscribe(listener);
  }

  public onEvict(listener: ModelEvictionListener): () => void {
    return this.cache.onEvict(listener);
  }
}

export const documentStore = new DocumentStore();
