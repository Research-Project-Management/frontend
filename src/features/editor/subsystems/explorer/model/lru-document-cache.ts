/**
 * lru-document-cache.ts
 *
 * In-Memory Virtual Document Model & Bounded LRU Cache (Domain Layer).
 *
 * High-performance Doubly Linked List + Hash Map (O(1) touch/evict/read).
 * Automatically flushes dirty documents to Tier 2 Persistent Storage (IndexedDB) upon eviction.
 */

import { draftStorageService, type IDraftStorageSink } from '@/features/editor/domain/document/draft-storage';
export type { IDraftStorageSink };

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
  yText?: unknown | null;
  isDirty: boolean;
  /** Monotonic counter bumped on every content mutation; used for race-free markClean. */
  contentVersion?: number;
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

const DEFAULT_CAPACITY = 10;

export class LRUDocumentCache {
  private readonly models = new Map<string, DocumentModelState>();
  private readonly lruNodes = new Map<string, LRUNode>();
  private head: LRUNode | null = null; // Most Recently Used (MRU)
  private tail: LRUNode | null = null; // Least Recently Used (LRU)
  private capacity = DEFAULT_CAPACITY;
  private activeFileId: string | null = null;
  private readonly listeners = new Set<ModelChangeListener>();
  private readonly evictionListeners = new Set<ModelEvictionListener>();
  private persistenceSink: IDraftStorageSink | null = draftStorageService;

  constructor(persistenceSink: IDraftStorageSink | null = draftStorageService) {
    this.persistenceSink = persistenceSink;
  }

  /**
   * Configures the backing multi-tier persistence sink (seam for draft storage).
   */
  public setPersistenceSink(sink: IDraftStorageSink | null): void {
    this.persistenceSink = sink;
  }

  /**
   * Designates the currently active editor file so it is protected from eviction.
   */
  public setActiveFileId(fileId: string | null): void {
    this.activeFileId = fileId;
    if (fileId) {
      this.touch(fileId);
    }
  }

  public getActiveFileId(): string | null {
    return this.activeFileId;
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
  public warm = this.registerModel.bind(this);

  public registerModel(
    fileId: string,
    initialData: {
      content: string;
      filePath?: string;
      projectId?: string;
      yText?: unknown;
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

  public get(fileId: string): DocumentModelState | undefined {
    return this.getModel(fileId);
  }

  /**
   * Hydrates a model from Tier 2 Storage (IndexedDB) if it was evicted from RAM.
   * Checks:
   * 1. Active uncommitted draft snapshot
   * 2. Cached project file snapshot
   * 3. Fallback content
   */
  public async hydrateModelAsync(
    fileId: string,
    fallbackContent: string,
    filePath?: string,
    projectId?: string
  ): Promise<DocumentModelState> {
    const existing = this.getModel(fileId);
    if (existing) return existing;

    if (this.persistenceSink) {
      try {
        const draft = await this.persistenceSink.getDraft(fileId);
        if (draft && typeof draft.content === 'string') {
          return this.registerModel(fileId, {
            content: draft.content,
            filePath: filePath || draft.title || fileId,
            projectId: projectId || draft.projectId,
          });
        }

        if (this.persistenceSink.getProjectFileSnapshot) {
          const snapshot = await this.persistenceSink.getProjectFileSnapshot(fileId);
          if (snapshot && typeof snapshot.content === 'string') {
            return this.registerModel(fileId, {
              content: snapshot.content,
              filePath: filePath || snapshot.filePath || snapshot.title || fileId,
              projectId: projectId || snapshot.projectId,
            });
          }
        }
      } catch {
        // Fallback
      }
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
    const cleanTarget = targetPath.replace(/\\/g, '/').replace(/^\.?\//, '').trim().toLowerCase();
    const bareTarget = cleanTarget.split('/').pop() || cleanTarget;
    const cleanTargetNoExt = cleanTarget.replace(/\.(tex|bib|sty|cls)$/i, '');
    const bareTargetNoExt = bareTarget.replace(/\.(tex|bib|sty|cls)$/i, '');

    let bareFallback: DocumentModelState | undefined;

    for (const model of this.models.values()) {
      const cleanPath = (model.filePath || model.fileId).replace(/\\/g, '/').replace(/^\.?\//, '').trim().toLowerCase();
      const barePath = cleanPath.split('/').pop() || cleanPath;
      const cleanPathNoExt = cleanPath.replace(/\.(tex|bib|sty|cls)$/i, '');
      const barePathNoExt = barePath.replace(/\.(tex|bib|sty|cls)$/i, '');

      if (
        cleanPath === cleanTarget ||
        cleanPath === cleanTargetNoExt ||
        cleanPathNoExt === cleanTargetNoExt ||
        cleanPath.endsWith(`/${cleanTarget}`) ||
        cleanPathNoExt.endsWith(`/${cleanTargetNoExt}`) ||
        cleanTarget.endsWith(`/${cleanPath}`) ||
        cleanTargetNoExt.endsWith(`/${cleanPathNoExt}`)
      ) {
        return model;
      }

      if (!bareFallback && !cleanTarget.includes('/') && (barePath === bareTarget || barePathNoExt === bareTargetNoExt)) {
        bareFallback = model;
      }
    }
    return bareFallback;
  }

  /**
   * Updates content and dirty flag for an existing model.
   */
  public updateContent(fileId: string, content: string, isDirty = true): void {
    let model = this.models.get(fileId);
    if (!model) {
      model = this.registerModel(fileId, { content });
      model.isDirty = isDirty;
      model.contentVersion = 1;
      return;
    }

    if (model.content !== content) {
      model.contentVersion = (model.contentVersion ?? 0) + 1;
    }
    model.content = content;
    model.isDirty = isDirty;
    model.lastActiveAt = Date.now();
    this.touch(fileId);
    this.notify(fileId, model);
  }

  /**
   * Applies content that originated from a remote collaborator (e.g. Yjs sync).
   * Never marks the model dirty, and never clears an existing local dirty flag —
   * unsaved local edits must remain flagged for persistence.
   */
  public applyRemoteContent(fileId: string, content: string): void {
    const existing = this.models.get(fileId);
    this.updateContent(fileId, content, existing?.isDirty ?? false);
  }

  /**
   * Returns the current content version for a model (0 when unknown).
   */
  public getContentVersion(fileId: string): number {
    return this.models.get(fileId)?.contentVersion ?? 0;
  }

  /**
   * Marks the model clean only if its content has not changed since `expectedContent`
   * was captured for saving. Returns true when the model was marked clean.
   * Prevents losing edits typed while a save request was in flight.
   */
  public markCleanIfUnchanged(fileId: string, expectedContent: string, expectedVersion?: number): boolean {
    const model = this.models.get(fileId);
    if (!model) return false;
    if (model.content !== expectedContent) return false;
    if (expectedVersion !== undefined && (model.contentVersion ?? 0) !== expectedVersion) return false;
    this.markClean(fileId);
    return true;
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
   * Returns all document models currently retained in RAM.
   */
  public getAllModels(): DocumentModelState[] {
    return Array.from(this.models.values());
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

  public clear(): void {
    this.clearAll();
  }

  public has(fileId: string): boolean {
    return this.hasModel(fileId);
  }

  public getContent(fileId: string): string | undefined {
    return this.getModel(fileId)?.content;
  }

  public isDirty(fileId: string): boolean {
    return this.getModel(fileId)?.isDirty ?? false;
  }

  public markDirty(fileId: string): void {
    const model = this.models.get(fileId);
    if (!model) return;
    model.isDirty = true;
    this.notify(fileId, model);
  }

  public subscribe(listener: ModelChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public onEvict(listener: ModelEvictionListener): () => void {
    this.evictionListeners.add(listener);
    return () => this.evictionListeners.delete(listener);
  }

  public onEviction(listener: ModelEvictionListener): () => void {
    return this.onEvict(listener);
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

    if (model?.isDirty && this.persistenceSink) {
      this.persistenceSink.saveDraft(
        fileId,
        model.content,
        model.projectId || 'workspace-local',
        model.filePath
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
