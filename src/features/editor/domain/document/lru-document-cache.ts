import {
  normalizeVirtualPath,
  rewritePathPrefix,
} from './document-naming';

/**
 * In-Memory Virtual Document Model & Bounded LRU Cache (Domain Layer).
 *
 * High-performance Doubly Linked List + Hash Map (O(1) touch/evict/read).
 * Automatically flushes dirty documents to Tier 2 Persistent Storage (IndexedDB) upon eviction.
 */

import { draftStorageService, type IDraftStorageSink } from './draft-storage';
import { EDITOR_LIMITS } from '@/features/editor/domain/constants/editor.constants';
export type { IDraftStorageSink };

export interface DocumentCursorSelection {
  anchor: number;
  head: number;
}

export interface DocumentScrollViewport {
  top: number;
  left: number;
}

/**
 * Computes exact UTF-8 byte length of a UTF-16 string without allocating temporary buffers.
 */
export function measureUtf8Bytes(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
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

export interface DocumentManifestEntry {
  rev?: number;
  hash?: string | null;
  sizeBytes?: number;
  sessionValidated?: boolean;
}

export interface LRUNode {
  fileId: string;
  prev: LRUNode | null;
  next: LRUNode | null;
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

const DEFAULT_CAPACITY: number = EDITOR_LIMITS.LRU_MAX_FILES;
const DEFAULT_MAX_BYTES: number = EDITOR_LIMITS.LRU_MAX_BYTES;

export class LRUDocumentCache {
  private readonly models = new Map<string, DocumentModelState>();
  private readonly lruNodes = new Map<string, LRUNode>();
  private head: LRUNode | null = null; // Most Recently Used (MRU)
  private tail: LRUNode | null = null; // Least Recently Used (LRU)
  private capacity: number = DEFAULT_CAPACITY;
  private maxBytes: number = DEFAULT_MAX_BYTES;
  private totalBytes = 0;
  private activeFileId: string | null = null;
  private version = 0;
  private readonly listeners = new Set<ModelChangeListener | CacheSubscriber>();
  private readonly fileListeners = new Map<string, Set<CacheSubscriber>>();
  private readonly dirtyFileIds = new Set<string>();
  private readonly manifestByDocId = new Map<string, DocumentManifestEntry>();
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
   * Configures the maximum text byte budget retained in RAM simultaneously.
   */
  public setMaxBytes(newMaxBytes: number): void {
    if (newMaxBytes < 1) return;
    this.maxBytes = newMaxBytes;
    this.enforceCapacity();
  }

  /**
   * Restores dual-bound RAM defaults (40 files / 16 MB text).
   */
  public resetLimits(): void {
    this.capacity = DEFAULT_CAPACITY;
    this.maxBytes = DEFAULT_MAX_BYTES;
    this.enforceCapacity();
  }

  /**
   * Returns current memory governor metrics.
   */
  public getStats(): DocumentModelStats {
    return {
      size: this.models.size,
      capacity: this.capacity,
      totalBytes: this.totalBytes,
      maxBytes: this.maxBytes,
      dirtyCount: this.dirtyFileIds.size,
      mruFileId: this.head?.fileId ?? null,
      lruFileId: this.tail?.fileId ?? null,
    };
  }

  public setManifestEntry(fileId: string, entry: DocumentManifestEntry): void {
    if (!fileId) return;
    const prev = this.manifestByDocId.get(fileId) ?? {};
    this.manifestByDocId.set(fileId, {
      ...prev,
      ...(entry.rev !== undefined ? { rev: entry.rev } : {}),
      ...(entry.hash !== undefined ? { hash: entry.hash } : {}),
      ...(entry.sizeBytes !== undefined ? { sizeBytes: entry.sizeBytes } : {}),
      ...(entry.sessionValidated !== undefined
        ? { sessionValidated: entry.sessionValidated }
        : prev.sessionValidated !== undefined
          ? { sessionValidated: prev.sessionValidated }
          : {}),
    });
  }

  public getManifestEntry(fileId: string): DocumentManifestEntry | undefined {
    return this.manifestByDocId.get(fileId);
  }

  public hydrateManifestFromTree(
    nodes: ReadonlyArray<{
      type?: string;
      id?: string;
      docId?: string | null;
      hash?: string | null;
      rev?: number | null;
      sizeBytes?: number;
      isRootDoc?: boolean;
      children?: unknown[];
    }>,
    options?: { rootDocId?: string; pageId?: string },
  ): void {
    if (!Array.isArray(nodes)) return;
    const visit = (
      list: ReadonlyArray<{
        type?: string;
        id?: string;
        docId?: string | null;
        hash?: string | null;
        rev?: number | null;
        sizeBytes?: number;
        isRootDoc?: boolean;
        children?: unknown[];
      }>,
    ) => {
      for (const node of list) {
        if (!node) continue;
        const upperType = node.type?.toUpperCase();
        if (!upperType || upperType === 'DOC') {
          const docId = node.docId || node.id;
          if (docId) {
            const entry: DocumentManifestEntry = {
              ...(node.hash !== undefined ? { hash: node.hash } : {}),
              ...(typeof node.rev === 'number' ? { rev: node.rev } : {}),
              ...(typeof node.sizeBytes === 'number' ? { sizeBytes: node.sizeBytes } : {}),
              sessionValidated: true,
            };
            this.setManifestEntry(docId, entry);
            if (
              (node.isRootDoc || docId === options?.rootDocId) &&
              options?.pageId &&
              options.pageId !== docId
            ) {
              this.setManifestEntry(options.pageId, entry);
            }
          }
        }
        if (Array.isArray(node.children) && node.children.length > 0) {
          visit(
            node.children as ReadonlyArray<{
              type?: string;
              id?: string;
              docId?: string | null;
              hash?: string | null;
              rev?: number | null;
              sizeBytes?: number;
              isRootDoc?: boolean;
              children?: unknown[];
            }>,
          );
        }
      }
    };
    visit(nodes);
  }

  public isSnapshotFreshAgainstManifest(
    fileId: string,
    snapshot: { rev?: number; hash?: string | null },
  ): boolean {
    const manifest = this.manifestByDocId.get(fileId);
    if (!manifest) return false;
    if (manifest.hash && snapshot.hash) {
      return manifest.hash === snapshot.hash;
    }
    if (manifest.rev !== undefined && snapshot.rev !== undefined) {
      return manifest.rev === snapshot.rev;
    }
    if (manifest.sessionValidated && manifest.hash === undefined && manifest.rev === undefined) {
      return true;
    }
    return false;
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
      spaceId?: string;
      pageId?: string;
      yText?: unknown;
      selection?: DocumentCursorSelection;
      scrollViewport?: DocumentScrollViewport;
      serverRev?: number;
      hash?: string | null;
      serverUpdatedAt?: string;
      isAuthoritative?: boolean;
    }
  ): DocumentModelState {
    const existing = this.models.get(fileId);
    const now = Date.now();
    const incomingAuthoritative = initialData.isAuthoritative !== false;

    if (existing) {
      existing.lastActiveAt = now;
      if (initialData.filePath) existing.filePath = initialData.filePath;
      if (initialData.projectId) existing.projectId = initialData.projectId;
      if (initialData.spaceId) existing.spaceId = initialData.spaceId;
      if (initialData.pageId) existing.pageId = initialData.pageId;
      if (initialData.yText !== undefined) existing.yText = initialData.yText;
      if (
        initialData.serverRev !== undefined &&
        (existing.serverRev === undefined || initialData.serverRev >= existing.serverRev)
      ) {
        existing.serverRev = initialData.serverRev;
      }
      if (initialData.hash !== undefined) existing.hash = initialData.hash;
      if (initialData.serverUpdatedAt !== undefined) existing.serverUpdatedAt = initialData.serverUpdatedAt;
      if (incomingAuthoritative) {
        existing.isAuthoritative = true;
      }
      if (!existing.isDirty && incomingAuthoritative && initialData.content !== existing.content) {
        this.totalBytes = Math.max(
          0,
          this.totalBytes + measureUtf8Bytes(initialData.content) - measureUtf8Bytes(existing.content),
        );
        existing.content = initialData.content;
      }
      if (existing.isAuthoritative !== false) {
        this.setManifestEntry(fileId, {
          ...(existing.serverRev !== undefined ? { rev: existing.serverRev } : {}),
          ...(existing.hash !== undefined ? { hash: existing.hash } : {}),
          sessionValidated: true,
        });
      }
      this.touch(fileId);
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
    if (existing && existing.isAuthoritative !== false) return existing;

    const manifest = this.manifestByDocId.get(fileId);

    if (this.persistenceSink) {
      try {
        const [draft, snapshot] = await Promise.all([
          this.persistenceSink.getDraft(fileId).catch(() => null),
          this.persistenceSink.getProjectFileSnapshot
            ? this.persistenceSink.getProjectFileSnapshot(fileId).catch(() => null)
            : Promise.resolve(null),
        ]);

        if (
          draft &&
          typeof draft.content === 'string' &&
          (!snapshot || (draft.savedAt ?? Infinity) >= (snapshot.updatedAt ?? 0))
        ) {
          const model = this.registerModel(fileId, {
            content: draft.content,
            filePath: filePath || draft.title || snapshot?.filePath || snapshot?.title || fileId,
            projectId: projectId || draft.projectId || snapshot?.projectId,
            serverRev: draft.expectedRev ?? snapshot?.rev ?? manifest?.rev,
            hash: snapshot?.hash ?? manifest?.hash,
            isAuthoritative: true,
          });
          this.markDirty(fileId);
          return model;
        }

        if (snapshot && typeof snapshot.content === 'string') {
          return this.registerModel(fileId, {
            content: snapshot.content,
            filePath: filePath || snapshot.filePath || snapshot.title || fileId,
            projectId: projectId || snapshot.projectId,
            serverRev: snapshot.rev ?? manifest?.rev,
            hash: snapshot.hash ?? manifest?.hash,
            isAuthoritative: true,
          });
        }
      } catch {
        // Fallback
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
    if (isDirty) {
      this.dirtyFileIds.add(fileId);
    } else {
      this.dirtyFileIds.delete(fileId);
    }
    model.lastActiveAt = Date.now();
    this.touch(fileId);
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
    const hadDirtyFlag = this.dirtyFileIds.delete(fileId);
    if (!model) {
      if (hadDirtyFlag) {
        this.notify(fileId, undefined);
      }
      return;
    }

    model.isDirty = false;
    model.lastSavedAt = Date.now();
    this.notify(fileId, model);
  }

  public markSaved(fileId: string): void {
    this.markClean(fileId);
  }

  /**
   * Encapsulated domain command to rename a file's path and notify listeners.
   */
  public renameFile(fileId: string, newFilePath: string): void {
    const model = this.models.get(fileId);
    if (!model) return;
    model.filePath = newFilePath;
    model.lastActiveAt = Date.now();
    this.touch(fileId);
    this.notify(fileId, model);
  }

  /**
   * Renames all cached models whose filePath resides under `oldPrefix/`.
   * Returns the list of updated models with their old and new paths so callers
   * can synchronize DAG, symbol index, and diagnostics aliases.
   */
  public renameFolderPrefix(
    oldPrefix: string,
    newPrefix: string,
  ): Array<{ fileId: string; oldPath: string; newPath: string; content: string }> {
    const cleanOld = normalizeVirtualPath(oldPrefix);
    const cleanNew = normalizeVirtualPath(newPrefix);
    if (!cleanOld || cleanOld === cleanNew) return [];

    const updated: Array<{ fileId: string; oldPath: string; newPath: string; content: string }> = [];
    const now = Date.now();

    for (const model of this.models.values()) {
      const nextPath = rewritePathPrefix(model.filePath, cleanOld, cleanNew, true);
      if (nextPath !== null) {
        const prevPath = model.filePath;
        model.filePath = nextPath;
        model.lastActiveAt = now;
        updated.push({
          fileId: model.fileId,
          oldPath: prevPath,
          newPath: nextPath,
          content: model.content,
        });
      }
    }

    if (updated.length > 0) {
      this.notify();
    }
    return updated;
  }

  /**
   * Encapsulated domain command to update server optimistic concurrency metadata.
   */
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

  /**
   * Returns a monotonic snapshot version counter bumped on every cache mutation.
   * Compatible with React 18/19 useSyncExternalStore.
   */
  public getSnapshot = (): number => {
    return this.version;
  };

  public getVersion(): number {
    return this.version;
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
   * Returns file IDs for all currently dirty models (including spilled IDB drafts).
   * Single source of truth for unsaved state.
   */
  public getDirtyFileIds(): string[] {
    return Array.from(this.dirtyFileIds);
  }

  /**
   * Marks all models clean.
   */
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
    if (changed) {
      this.notify();
    }
  }

  /**
   * Returns all document models currently retained in RAM.
   */
  public getAllModels(): DocumentModelState[] {
    return Array.from(this.models.values());
  }

  /**
   * Evicts a model from RAM and safely flushes it to IndexedDB if dirty unless `skipPersistence` is set.
   */
  public evictModel(fileId: string, options?: { skipPersistence?: boolean }): void {
    const node = this.lruNodes.get(fileId);
    if (node) {
      this.evictLRUNode(node, options);
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
    this.dirtyFileIds.clear();
    this.manifestByDocId.clear();
    this.head = null;
    this.tail = null;
    this.totalBytes = 0;
    this.activeFileId = null;
    this.notify();
  }

  /**
   * Discards all models from RAM immediately without persisting dirty models to persistenceSink.
   * Used when remote state (e.g. GitHub Pull) authoritatively replaces local workspace files.
   */
  public discardAll(): void {
    for (const model of this.models.values()) {
      model.yText = null;
    }
    this.models.clear();
    this.lruNodes.clear();
    this.dirtyFileIds.clear();
    this.manifestByDocId.clear();
    this.head = null;
    this.tail = null;
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
      if (newlyDirty) {
        this.notify(fileId, undefined);
      }
      return;
    }
    if (!model.isDirty || newlyDirty) {
      model.isDirty = true;
      this.notify(fileId, model);
    }
  }

  /**
   * O(1) per-file subscription for UI elements (e.g., individual EditorTab dirty dots)
   * so keystrokes in one file never wake N sibling tabs.
   */
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
      if (set.size === 0) {
        this.fileListeners.delete(fileId);
      }
    };
  };

  /**
   * Subscribes to document cache changes.
   * Supports zero-argument subscriber callbacks (compatible with React `useSyncExternalStore`)
   * as well as legacy `(fileId, model)` listeners.
   */
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
    while (
      (this.models.size > this.capacity || (this.totalBytes > this.maxBytes && this.models.size > 1)) &&
      this.tail
    ) {
      let candidate: LRUNode | null = this.tail;

      if (candidate.fileId === this.activeFileId) {
        candidate = candidate.prev;
      }

      if (!candidate) break;
      this.evictLRUNode(candidate);
    }
  }

  private evictLRUNode(node: LRUNode, options?: { skipPersistence?: boolean }): void {
    const { fileId } = node;
    const model = this.models.get(fileId);

    if (options?.skipPersistence) {
      this.dirtyFileIds.delete(fileId);
    }

    if (!options?.skipPersistence && model && this.persistenceSink) {
      if (model.isDirty) {
        this.dirtyFileIds.add(fileId);
        const savePromise =
          model.serverRev !== undefined
            ? this.persistenceSink.saveDraft(
                fileId,
                model.content,
                model.projectId || 'workspace-local',
                model.filePath,
                model.serverRev,
              )
            : this.persistenceSink.saveDraft(
                fileId,
                model.content,
                model.projectId || 'workspace-local',
                model.filePath,
              );
        savePromise.catch(() => {});
      } else {
        this.dirtyFileIds.delete(fileId);
        if (
          model.isAuthoritative !== false &&
          (model.content.length > 0 || model.serverRev !== undefined || model.hash !== undefined) &&
          this.persistenceSink.saveProjectFileSnapshot
        ) {
          this.persistenceSink
            .saveProjectFileSnapshot({
              id: fileId,
              projectId: model.projectId || 'workspace-local',
              title: model.filePath,
              content: model.content,
              filePath: model.filePath,
              rev: model.serverRev,
              hash: model.hash,
              updatedAt: Date.now(),
            })
            .catch(() => {});
        }
      }
    }

    this.detach(node);
    this.lruNodes.delete(fileId);
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
