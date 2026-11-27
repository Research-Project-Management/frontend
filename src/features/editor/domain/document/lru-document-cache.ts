/**
 * In-Memory Virtual Document Model & Bounded LRU Cache (Domain Layer).
 *
 * High-performance Doubly Linked List + Hash Map (O(1) touch/evict/read).
 * Automatically flushes dirty documents to Tier 2 Persistent Storage (IndexedDB) upon eviction.
 */

import {
  LRULinkedList,
  measureUtf8Bytes,
  type LRUNode,
} from './lru-linked-list';
import {
  DocumentManifestStore,
  findModelByNormalizedPath,
  mergeModelRegistration,
  persistEvictedModelToSink,
  resolveHydratedRegistrationFromSink,
  rewriteModelsFolderPrefix,
  type DocumentManifestEntry,
  type ManifestTreeNode,
} from './document-manifest.store';
import {
  defaultDocumentSpillSink,
  type IDocumentSpillSink,
} from '@/features/editor/domain/offline-storage';
import { EDITOR_LIMITS } from '@/features/editor/domain/constants/editor.constants';
import { resolveHardwareBudget } from '@/shared/lib/memory-governor';

export { measureUtf8Bytes };
export type { IDocumentSpillSink, DocumentManifestEntry, LRUNode };

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
  spaceId?: string;
  pageId?: string;
  content: string;
  selection?: DocumentCursorSelection;
  scrollViewport?: DocumentScrollViewport;
  yText?: unknown | null;
  isDirty: boolean;
  /** False when pre-populated as an empty tab shell awaiting async IDB/Server hydration. */
  isAuthoritative?: boolean;
  /** Monotonic counter bumped on every content mutation; used for race-free markClean. */
  contentVersion?: number;
  serverRev?: number;
  hash?: string | null;
  serverUpdatedAt?: string;
  lastSavedAt?: number;
  lastActiveAt: number;
  metadata?: Record<string, unknown>;
}

export type ModelChangeListener = (fileId?: string, model?: DocumentModelState) => void;
export type CacheSubscriber = () => void;
export type ModelEvictionListener = (fileId: string, model: DocumentModelState) => void;

export interface DocumentModelStats {
  size: number;
  capacity: number;
  totalBytes: number;
  maxBytes: number;
  dirtyCount: number;
  mruFileId: string | null;
  lruFileId: string | null;
}

const HARDWARE_BUDGET = resolveHardwareBudget();
const DEFAULT_CAPACITY: number = HARDWARE_BUDGET.lruMaxFiles || EDITOR_LIMITS.LRU_MAX_FILES;
const DEFAULT_MAX_BYTES: number = HARDWARE_BUDGET.lruMaxBytes || EDITOR_LIMITS.LRU_MAX_BYTES;

export class LRUDocumentCache {
  private readonly models = new Map<string, DocumentModelState>();
  private readonly lruList = new LRULinkedList();
  private readonly manifestStore = new DocumentManifestStore();
  private capacity: number = DEFAULT_CAPACITY;
  private maxBytes: number = DEFAULT_MAX_BYTES;
  private totalBytes = 0;
  private activeFileId: string | null = null;
  private version = 0;
  private readonly listeners = new Set<ModelChangeListener | CacheSubscriber>();
  private readonly fileListeners = new Map<string, Set<CacheSubscriber>>();
  private readonly dirtyFileIds = new Set<string>();
  private readonly evictionListeners = new Set<ModelEvictionListener>();
  private persistenceSink: IDocumentSpillSink | null = defaultDocumentSpillSink;

  constructor(persistenceSink: IDocumentSpillSink | null = defaultDocumentSpillSink) {
    this.persistenceSink = persistenceSink;
  }

  public setPersistenceSink(sink: IDocumentSpillSink | null): void {
    this.persistenceSink = sink;
  }

  public setActiveFileId(fileId: string | null): void {
    this.activeFileId = fileId;
    if (fileId) this.lruList.touch(fileId);
  }

  public getActiveFileId(): string | null {
    return this.activeFileId;
  }

  public setCapacity(newCapacity: number): void {
    if (newCapacity < 1) return;
    this.capacity = newCapacity;
    this.enforceCapacity();
  }

  public setMaxBytes(newMaxBytes: number): void {
    if (newMaxBytes < 1) return;
    this.maxBytes = newMaxBytes;
    this.enforceCapacity();
  }

  public resetLimits(): void {
    this.capacity = DEFAULT_CAPACITY;
    this.maxBytes = DEFAULT_MAX_BYTES;
    this.enforceCapacity();
  }

  public getStats(): DocumentModelStats {
    return {
      size: this.models.size,
      capacity: this.capacity,
      totalBytes: this.totalBytes,
      maxBytes: this.maxBytes,
      dirtyCount: this.dirtyFileIds.size,
      mruFileId: this.lruList.getMruId(),
      lruFileId: this.lruList.getLruId(),
    };
  }

  public setManifestEntry(fileId: string, entry: DocumentManifestEntry): void {
    this.manifestStore.setEntry(fileId, entry);
  }

  public getManifestEntry(fileId: string): DocumentManifestEntry | undefined {
    return this.manifestStore.getEntry(fileId);
  }

  public hydrateManifestFromTree(
    nodes: ReadonlyArray<ManifestTreeNode>,
    options?: { rootDocId?: string; pageId?: string },
  ): void {
    this.manifestStore.hydrateFromTree(nodes, options);
  }

  public isSyncedCacheFreshAgainstManifest(
    fileId: string,
    cached: { rev?: number; hash?: string | null },
  ): boolean {
    return this.manifestStore.isSyncedCacheFreshAgainstManifest(fileId, cached);
  }

  public warm = this.registerModel.bind(this);

  public registerModel(
    fileId: string,
    initialData: {
      content: string;
      filePath?: string;
      projectId?: string;
      spaceId?: string;
      pageId?: string;
      yText?: unknown;
      selection?: DocumentCursorSelection;
      scrollViewport?: DocumentScrollViewport;
      serverRev?: number;
      hash?: string | null;
      serverUpdatedAt?: string;
      isAuthoritative?: boolean;
    },
  ): DocumentModelState {
    const existing = this.models.get(fileId);
    const now = Date.now();
    const incomingAuthoritative = initialData.isAuthoritative !== false;

    if (existing) {
      const bytesDelta = mergeModelRegistration(existing, initialData, incomingAuthoritative, now);
      if (bytesDelta !== 0) {
        this.totalBytes = Math.max(0, this.totalBytes + bytesDelta);
      }
      if (existing.isAuthoritative !== false) {
        this.setManifestEntry(fileId, {
          ...(existing.serverRev !== undefined ? { rev: existing.serverRev } : {}),
          ...(existing.hash !== undefined ? { hash: existing.hash } : {}),
          sessionValidated: true,
        });
      }
      this.lruList.touch(fileId);
      if (this.totalBytes > this.maxBytes && this.models.size > 1) {
        this.enforceCapacity();
      }
      this.notify(fileId, existing);
      return existing;
    }

    const newModel: DocumentModelState = {
      fileId,
      filePath: initialData.filePath || fileId,
      projectId: initialData.projectId,
      spaceId: initialData.spaceId,
      pageId: initialData.pageId,
      content: initialData.content,
      selection: initialData.selection,
      scrollViewport: initialData.scrollViewport,
      yText: initialData.yText,
      serverRev: initialData.serverRev,
      hash: initialData.hash,
      serverUpdatedAt: initialData.serverUpdatedAt,
      isDirty: this.dirtyFileIds.has(fileId),
      isAuthoritative: incomingAuthoritative,
      lastActiveAt: now,
    };

    if (incomingAuthoritative) {
      this.setManifestEntry(fileId, {
        ...(newModel.serverRev !== undefined ? { rev: newModel.serverRev } : {}),
        ...(newModel.hash !== undefined ? { hash: newModel.hash } : {}),
        sessionValidated: true,
      });
    }

    this.models.set(fileId, newModel);
    this.totalBytes += measureUtf8Bytes(newModel.content);
    this.lruList.insertAtHead(fileId);
    this.enforceCapacity();
    this.notify(fileId, newModel);
    return newModel;
  }

  public getModel(fileId: string): DocumentModelState | undefined {
    const model = this.models.get(fileId);
    if (model) this.lruList.touch(fileId);
    return model;
  }

  public get(fileId: string): DocumentModelState | undefined {
    return this.getModel(fileId);
  }

  public async hydrateModelAsync(
    fileId: string,
    fallbackContent: string,
    filePath?: string,
    projectId?: string,
  ): Promise<DocumentModelState> {
    const existing = this.getModel(fileId);
    if (existing && existing.isAuthoritative !== false) return existing;

    const manifest = this.manifestStore.getEntry(fileId);
    if (this.persistenceSink) {
      const hydrated = await resolveHydratedRegistrationFromSink(
        this.persistenceSink,
        manifest,
        fileId,
        filePath,
        projectId,
      );
      if (hydrated) {
        const model = this.registerModel(fileId, hydrated.data);
        if (hydrated.isDirty) this.markDirty(fileId);
        return model;
      }
    }

    return this.registerModel(fileId, {
      content: fallbackContent,
      filePath: filePath || fileId,
      projectId,
      serverRev: manifest?.rev,
      hash: manifest?.hash,
      isAuthoritative: true,
    });
  }

  public hasModel(fileId: string): boolean {
    return this.models.has(fileId);
  }

  public findByPath(targetPath: string): DocumentModelState | undefined {
    return findModelByNormalizedPath(this.models.values(), targetPath);
  }

  public updateContent(fileId: string, content: string, isDirty = true): void {
    let model = this.models.get(fileId);
    if (!model) {
      model = this.registerModel(fileId, { content, isAuthoritative: true });
      model.contentVersion = 1;
      if (isDirty) {
        model.isDirty = true;
        this.dirtyFileIds.add(fileId);
        this.notify(fileId, model);
      } else {
        model.isDirty = false;
        this.dirtyFileIds.delete(fileId);
      }
      return;
    }

    if (model.content !== content) {
      this.totalBytes = Math.max(
        0,
        this.totalBytes + measureUtf8Bytes(content) - measureUtf8Bytes(model.content),
      );
      model.contentVersion = (model.contentVersion ?? 0) + 1;
    }
    model.content = content;
    model.isDirty = isDirty;
    model.isAuthoritative = true;
    if (isDirty) this.dirtyFileIds.add(fileId);
    else this.dirtyFileIds.delete(fileId);
    model.lastActiveAt = Date.now();
    this.lruList.touch(fileId);
    if (this.totalBytes > this.maxBytes && this.models.size > 1) {
      this.enforceCapacity();
    }
    this.notify(fileId, model);
  }

  public setServerRev(fileId: string, rev: number): void {
    const model = this.models.get(fileId);
    if (model) {
      model.serverRev = rev;
      this.notify(fileId, model);
    }
  }

  public clearServerRev(fileId: string): void {
    const model = this.models.get(fileId);
    if (model && model.serverRev !== undefined) {
      model.serverRev = undefined;
      this.notify(fileId, model);
    }
  }

  public applyRemoteContent(fileId: string, content: string): void {
    const existing = this.models.get(fileId);
    this.updateContent(fileId, content, existing?.isDirty ?? false);
  }

  public getContentVersion(fileId: string): number {
    return this.models.get(fileId)?.contentVersion ?? 0;
  }

  public markCleanIfUnchanged(
    fileId: string,
    expectedContent: string,
    expectedVersion?: number,
  ): boolean {
    const model = this.models.get(fileId);
    if (!model) return false;
    if (model.content !== expectedContent) return false;
    if (expectedVersion !== undefined && (model.contentVersion ?? 0) !== expectedVersion) {
      return false;
    }
    this.markClean(fileId);
    return true;
  }

  public updateViewState(
    fileId: string,
    selection?: DocumentCursorSelection,
    scrollViewport?: DocumentScrollViewport,
  ): void {
    const model = this.models.get(fileId);
    if (!model) return;
    if (selection) model.selection = selection;
    if (scrollViewport) model.scrollViewport = scrollViewport;
    model.lastActiveAt = Date.now();
    this.lruList.touch(fileId);
  }

  public markClean(fileId: string): void {
    const model = this.models.get(fileId);
    const hadDirtyFlag = this.dirtyFileIds.delete(fileId);
    if (!model) {
      if (hadDirtyFlag) this.notify(fileId, undefined);
      return;
    }
    model.isDirty = false;
    model.lastSavedAt = Date.now();
    this.notify(fileId, model);
  }

  public markSaved(fileId: string): void {
    this.markClean(fileId);
  }

  public renameFile(fileId: string, newFilePath: string): void {
    const model = this.models.get(fileId);
    if (!model) return;
    model.filePath = newFilePath;
    model.lastActiveAt = Date.now();
    this.lruList.touch(fileId);
    this.notify(fileId, model);
  }

  public renameFolderPrefix(
    oldPrefix: string,
    newPrefix: string,
  ): Array<{ fileId: string; oldPath: string; newPath: string; content: string }> {
    const updated = rewriteModelsFolderPrefix(this.models.values(), oldPrefix, newPrefix);
    if (updated.length > 0) this.notify();
    return updated;
  }

  public updateServerVersion(
    fileId: string,
    meta: { rev?: number; hash?: string | null; updatedAt?: string },
  ): void {
    this.setManifestEntry(fileId, {
      ...(meta.rev !== undefined ? { rev: meta.rev } : {}),
      ...(meta.hash !== undefined ? { hash: meta.hash } : {}),
      sessionValidated: true,
    });
    const model = this.models.get(fileId);
    if (!model) return;
    if (meta.rev !== undefined) model.serverRev = meta.rev;
    if (meta.hash !== undefined) model.hash = meta.hash;
    if (meta.updatedAt !== undefined) model.serverUpdatedAt = meta.updatedAt;
    this.notify(fileId, model);
  }

  public getSnapshot = (): number => this.version;
  public getVersion(): number {
    return this.version;
  }

  public getDirtyModels(): DocumentModelState[] {
    const dirty: DocumentModelState[] = [];
    for (const model of this.models.values()) {
      if (model.isDirty) dirty.push(model);
    }
    return dirty;
  }

  public getDirtyFileIds(): string[] {
    return Array.from(this.dirtyFileIds);
  }

  public clearAllDirty(): void {
    let changed = this.dirtyFileIds.size > 0;
    this.dirtyFileIds.clear();
    for (const model of this.models.values()) {
      if (model.isDirty) {
        model.isDirty = false;
        model.lastSavedAt = Date.now();
        changed = true;
      }
    }
    if (changed) this.notify();
  }

  public getAllModels(): DocumentModelState[] {
    return Array.from(this.models.values());
  }

  public evictModel(fileId: string, options?: { skipPersistence?: boolean }): void {
    const node = this.lruList.get(fileId);
    if (node) this.evictLRUNode(node, options);
  }

  public clearAll(): void {
    for (const node of Array.from(this.lruList.values())) {
      this.evictLRUNode(node);
    }
    this.models.clear();
    this.lruList.clear();
    this.dirtyFileIds.clear();
    this.manifestStore.clear();
    this.totalBytes = 0;
    this.activeFileId = null;
    this.notify();
  }

  public discardAll(): void {
    for (const model of this.models.values()) {
      model.yText = null;
    }
    this.models.clear();
    this.lruList.clear();
    this.dirtyFileIds.clear();
    this.manifestStore.clear();
    this.totalBytes = 0;
    this.activeFileId = null;
    this.notify();
  }

  public clear(): void {
    this.clearAll();
  }

  public has(fileId: string): boolean {
    return this.hasModel(fileId);
  }

  public getContent(fileId: string): string | undefined {
    return this.models.get(fileId)?.content;
  }

  public isDirty(fileId: string): boolean {
    return this.models.get(fileId)?.isDirty ?? this.dirtyFileIds.has(fileId);
  }

  public markDirty(fileId: string): void {
    const model = this.models.get(fileId);
    const newlyDirty = !this.dirtyFileIds.has(fileId);
    this.dirtyFileIds.add(fileId);
    if (!model) {
      if (newlyDirty) this.notify(fileId, undefined);
      return;
    }
    if (!model.isDirty || newlyDirty) {
      model.isDirty = true;
      this.notify(fileId, model);
    }
  }

  public subscribeFile = (fileId: string, listener: CacheSubscriber): (() => void) => {
    let listenersForFile = this.fileListeners.get(fileId);
    if (!listenersForFile) {
      listenersForFile = new Set();
      this.fileListeners.set(fileId, listenersForFile);
    }
    listenersForFile.add(listener);
    return () => {
      const set = this.fileListeners.get(fileId);
      if (!set) return;
      set.delete(listener);
      if (set.size === 0) this.fileListeners.delete(fileId);
    };
  };

  public subscribe = (listener: CacheSubscriber | ModelChangeListener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public onEvict(listener: ModelEvictionListener): () => void {
    this.evictionListeners.add(listener);
    return () => this.evictionListeners.delete(listener);
  }

  public onEviction(listener: ModelEvictionListener): () => void {
    return this.onEvict(listener);
  }

  private enforceCapacity(): void {
    while (
      (this.models.size > this.capacity ||
        (this.totalBytes > this.maxBytes && this.models.size > 1)) &&
      this.lruList.getTail()
    ) {
      const candidate = this.lruList.getEvictionCandidate(this.activeFileId);
      if (!candidate) break;
      this.evictLRUNode(candidate);
    }
  }

  private evictLRUNode(node: LRUNode, options?: { skipPersistence?: boolean }): void {
    const { fileId } = node;
    const model = this.models.get(fileId);

    if (options?.skipPersistence) this.dirtyFileIds.delete(fileId);

    if (!options?.skipPersistence && model && this.persistenceSink) {
      persistEvictedModelToSink(this.persistenceSink, fileId, model, this.dirtyFileIds);
    }

    this.lruList.remove(fileId);
    this.models.delete(fileId);

    if (model) {
      this.totalBytes = Math.max(0, this.totalBytes - measureUtf8Bytes(model.content));
      for (const listener of this.evictionListeners) {
        try {
          listener(fileId, model);
        } catch {}
      }
      model.yText = null;
      this.notify(fileId, undefined);
    }
  }

  private notify(fileId?: string, model?: DocumentModelState): void {
    this.version++;
    for (const listener of this.listeners) {
      try {
        listener(fileId, model);
      } catch {}
    }
    if (fileId !== undefined) {
      const targetListeners = this.fileListeners.get(fileId);
      if (targetListeners) {
        for (const listener of targetListeners) {
          try {
            listener();
          } catch {}
        }
      }
    } else {
      for (const set of this.fileListeners.values()) {
        for (const listener of set) {
          try {
            listener();
          } catch {}
        }
      }
    }
  }
}

export const lruDocumentCache = new LRUDocumentCache();
