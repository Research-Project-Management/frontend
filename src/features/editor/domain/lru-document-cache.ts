/**
 * lru-document-cache.ts
 *
 * In-Memory Virtual Document Model & Bounded LRU Cache (Domain Layer).
 *
 * High-performance Doubly Linked List + Hash Map (O(1) touch/evict/read).
 * Automatically flushes dirty documents to Tier 2 Persistent Storage (IndexedDB) upon eviction.
 */

import { draftStorageService } from '../services/draft-storage.service';

export interface DocumentCursorSelection {
  anchor: number;
  head: number;
}

export interface DocumentScrollViewport {
  top: number;
  left: number;
}

export interface DocumentModelState {
  fileId: string;
  filePath: string;
  projectId?: string;
  content: string;
  selection?: DocumentCursorSelection;
  scrollViewport?: DocumentScrollViewport;
  yText?: any | null;
  isDirty: boolean;
  lastSavedAt?: number;
  lastActiveAt: number;
  metadata?: Record<string, unknown>;
}

export interface LRUNode {
  fileId: string;
  prev: LRUNode | null;
  next: LRUNode | null;
}

export type ModelChangeListener = (fileId: string, model: DocumentModelState) => void;
export type ModelEvictionListener = (fileId: string, model: DocumentModelState) => void;

export interface DocumentModelStats {
  size: number;
  capacity: number;
  dirtyCount: number;
  mruFileId: string | null;
  lruFileId: string | null;
}

const DEFAULT_CAPACITY = 25;

export class LRUDocumentCache {
  private readonly models = new Map<string, DocumentModelState>();
  private readonly lruNodes = new Map<string, LRUNode>();
  private head: LRUNode | null = null; // Most Recently Used (MRU)
  private tail: LRUNode | null = null; // Least Recently Used (LRU)
  private capacity = DEFAULT_CAPACITY;
  private activeFileId: string | null = null;
  private readonly listeners = new Set<ModelChangeListener>();
  private readonly evictionListeners = new Set<ModelEvictionListener>();

  /**
   * Designates the currently active editor file so it is protected from eviction.
   */
  public setActiveFileId(fileId: string | null): void {
    this.activeFileId = fileId;
    if (fileId) {
      this.touch(fileId);
    }
  }

  /**
   * Configures the maximum number of documents retained in RAM simultaneously.
   */
  public setCapacity(newCapacity: number): void {
    if (newCapacity < 1) return;
    this.capacity = newCapacity;
    this.enforceCapacity();
  }

  /**
   * Returns current memory governor metrics.
   */
  public getStats(): DocumentModelStats {
    let dirtyCount = 0;
    for (const m of this.models.values()) {
      if (m.isDirty) dirtyCount++;
    }
    return {
      size: this.models.size,
      capacity: this.capacity,
      dirtyCount,
      mruFileId: this.head?.fileId ?? null,
      lruFileId: this.tail?.fileId ?? null,
    };
  }

  /**
   * Registers a document model in the in-memory cache or updates existing metadata.
   */
  public registerModel(
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
    const existing = this.models.get(fileId);
    const now = Date.now();

    if (existing) {
      existing.lastActiveAt = now;
      if (initialData.filePath) existing.filePath = initialData.filePath;
      if (initialData.projectId) existing.projectId = initialData.projectId;
      if (initialData.yText !== undefined) existing.yText = initialData.yText;
      if (!existing.isDirty && initialData.content !== existing.content) {
        existing.content = initialData.content;
      }
      this.touch(fileId);
      this.notify(fileId, existing);
      return existing;
    }

    const newModel: DocumentModelState = {
      fileId,
      filePath: initialData.filePath || fileId,
      projectId: initialData.projectId,
      content: initialData.content,
      selection: initialData.selection,
      scrollViewport: initialData.scrollViewport,
      yText: initialData.yText,
      isDirty: false,
      lastActiveAt: now,
    };

    this.models.set(fileId, newModel);

    // Create and attach new LRU node at the head
    const node: LRUNode = { fileId, prev: null, next: null };
    this.lruNodes.set(fileId, node);
    this.attachToHead(node);

    this.enforceCapacity();
    this.notify(fileId, newModel);
    return newModel;
  }

  /**
   * Retrieves an in-memory document model by fileId.
   */
  public getModel(fileId: string): DocumentModelState | undefined {
    const model = this.models.get(fileId);
    if (model) {
      this.touch(fileId);
    }
    return model;
  }

  /**
   * Hydrates a model from Tier 2 Storage (IndexedDB) if it was evicted from RAM.
   */
  public async hydrateModelAsync(
    fileId: string,
    fallbackContent: string,
    filePath?: string,
    projectId?: string
  ): Promise<DocumentModelState> {
    const existing = this.getModel(fileId);
    if (existing) return existing;

    try {
      const draft = await draftStorageService.getDraft(fileId);
      if (draft && typeof draft.content === 'string') {
        return this.registerModel(fileId, {
          content: draft.content,
          filePath: filePath || fileId,
          projectId,
        });
      }
    } catch {
      // Fallback
    }

    return this.registerModel(fileId, {
      content: fallbackContent,
      filePath: filePath || fileId,
      projectId,
    });
  }

  /**
   * Checks if a document model is currently mounted in RAM.
   */
  public hasModel(fileId: string): boolean {
    return this.models.has(fileId);
  }

  /**
   * Finds a cached model by matching its filePath (case-insensitive & relative path normalized).
   */
  public findByPath(targetPath: string): DocumentModelState | undefined {
    if (!targetPath) return undefined;
    const cleanTarget = targetPath.replace(/^\.?\//, '').trim().toLowerCase();
    for (const model of this.models.values()) {
      const cleanPath = (model.filePath || model.fileId).replace(/^\.?\//, '').trim().toLowerCase();
      if (
        cleanPath === cleanTarget ||
        cleanPath.endsWith(`/${cleanTarget}`) ||
        cleanTarget.endsWith(`/${cleanPath}`)
      ) {
        return model;
      }
    }
    return undefined;
  }

  /**
   * Updates content and dirty flag for an existing model.
   */
  public updateContent(fileId: string, content: string, isDirty = true): void {
    const model = this.models.get(fileId);
    if (!model) return;

    model.content = content;
    model.isDirty = isDirty;
    model.lastActiveAt = Date.now();
    this.touch(fileId);
    this.notify(fileId, model);
  }

  /**
   * Preserves view state (selection & scroll) across tab switches.
   */
  public updateViewState(
    fileId: string,
    selection?: DocumentCursorSelection,
    scrollViewport?: DocumentScrollViewport
  ): void {
    const model = this.models.get(fileId);
    if (!model) return;

    if (selection) model.selection = selection;
    if (scrollViewport) model.scrollViewport = scrollViewport;
    model.lastActiveAt = Date.now();
    this.touch(fileId);
  }

  /**
   * Marks a model as clean (saved to disk/backend).
   */
  public markClean(fileId: string): void {
    const model = this.models.get(fileId);
    if (!model) return;

    model.isDirty = false;
    model.lastSavedAt = Date.now();
    this.notify(fileId, model);
  }

  /**
   * Returns all currently dirty models.
   */
  public getDirtyModels(): DocumentModelState[] {
    const dirty: DocumentModelState[] = [];
    for (const model of this.models.values()) {
      if (model.isDirty) dirty.push(model);
    }
    return dirty;
  }

  /**
   * Evicts a model from RAM and safely flushes it to IndexedDB if dirty.
   */
  public evictModel(fileId: string): void {
    const node = this.lruNodes.get(fileId);
    if (node) {
      this.evictLRUNode(node);
    }
  }

  /**
   * Evicts all models from RAM.
   */
  public clearAll(): void {
    for (const node of Array.from(this.lruNodes.values())) {
      this.evictLRUNode(node);
    }
    this.models.clear();
    this.lruNodes.clear();
    this.head = null;
    this.tail = null;
    this.activeFileId = null;
  }

  public subscribe(listener: ModelChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public onEvict(listener: ModelEvictionListener): () => void {
    this.evictionListeners.add(listener);
    return () => this.evictionListeners.delete(listener);
  }

  private touch(fileId: string): void {
    const node = this.lruNodes.get(fileId);
    if (!node || node === this.head) return;

    this.detach(node);
    this.attachToHead(node);
  }

  private attachToHead(node: LRUNode): void {
    node.prev = null;
    node.next = this.head;
    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;
    if (!this.tail) {
      this.tail = node;
    }
  }

  private detach(node: LRUNode): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    node.prev = null;
    node.next = null;
  }

  private enforceCapacity(): void {
    while (this.models.size > this.capacity && this.tail) {
      let candidate: LRUNode | null = this.tail;

      if (candidate.fileId === this.activeFileId) {
        candidate = candidate.prev;
      }

      if (!candidate) break;
      this.evictLRUNode(candidate);
    }
  }

  private evictLRUNode(node: LRUNode): void {
    const { fileId } = node;
    const model = this.models.get(fileId);

    if (model?.isDirty) {
      draftStorageService.saveDraft(
        fileId,
        model.content,
        model.projectId || 'anonymous',
        Date.now(),
        true
      ).catch(() => {});
    }

    this.detach(node);
    this.lruNodes.delete(fileId);
    this.models.delete(fileId);

    if (model) {
      for (const listener of this.evictionListeners) {
        try {
          listener(fileId, model);
        } catch {}
      }
    }
  }

  private notify(fileId: string, model: DocumentModelState): void {
    for (const listener of this.listeners) {
      try {
        listener(fileId, model);
      } catch {}
    }
  }
}

export const lruDocumentCache = new LRUDocumentCache();
// Alias for backward compatibility
export const documentModelManager = lruDocumentCache;
