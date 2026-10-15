/**
 * draft-storage.ts
 *
 * Resilient Multi-Tier Offline Draft Storage for Flux (Zero Data Loss Architecture).
 *
 * Tier 1: In-Memory Map (0ms instant access, survives component remounts within tab).
 * Tier 2: Native IndexedDB (Unlimited capacity, asynchronous, persistent across browser crashes & restarts).
 * Tier 3: LocalStorage Fallback (Synchronous fallback for beforeunload event & legacy browsers).
 *
 * Features:
 * - Draft Snapshots for active dirty documents.
 * - Project Files Snapshot Cache for offline project file viewing.
 * - Conflict-Free Ordered Mutation Queue with write coalescing for seamless offline-to-online replay.
 */

export interface DraftSnapshot {
  fileId: string;
  content: string;
  savedAt: number;
  projectId?: string;
  title?: string;
}

export interface ProjectFileSnapshot {
  id: string; // fileId or pageId
  projectId: string;
  title: string;
  content: string;
  filePath?: string;
  type?: string;
  updatedAt: number;
}

export type OfflineMutationType = 'update_content' | 'create_file' | 'delete_file' | 'rename_file';

export interface OfflineMutation {
  id?: number;
  fileId: string;
  projectId?: string;
  type: OfflineMutationType;
  payload: {
    content?: string;
    title?: string;
    filePath?: string;
    parentFolderId?: string;
    [key: string]: unknown;
  };
  status: 'pending' | 'processing' | 'failed';
  retryCount: number;
  error?: string;
  timestamp: number;
}

export interface IDraftStorageSink {
  saveDraft(fileId: string, content: string, projectId?: string, title?: string): Promise<void>;
  getDraft(fileId: string): Promise<DraftSnapshot | null>;
  clearDraft(fileId: string): Promise<void>;
  saveProjectFileSnapshot?(file: ProjectFileSnapshot): Promise<void>;
  getProjectFileSnapshot?(fileId: string): Promise<ProjectFileSnapshot | null>;
}

const DB_NAME = 'flux_offline_drafts_v1';
const STORE_DRAFTS = 'drafts';
const STORE_PROJECT_FILES = 'project_files';
const STORE_MUTATION_QUEUE = 'mutation_queue';
const DB_VERSION = 2;
const LOCAL_STORAGE_PREFIX = 'flux_draft:';

export class DraftStorageServiceRegistry implements IDraftStorageSink {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private readonly memoryCache = new Map<string, DraftSnapshot>();
  private readonly projectFilesMemoryCache = new Map<string, ProjectFileSnapshot>();
  private readonly mutationQueueMemory: OfflineMutation[] = [];
  private nextMutationId = 1;
  private isIndexedDbAvailable = false;

  constructor() {
    if (typeof window !== 'undefined' && 'indexedDB' in window && process.env.NODE_ENV !== 'test') {
      this.isIndexedDbAvailable = true;
      this.initDatabase();
    }
  }

  /**
   * Initializes native IndexedDB connection with upgraded schema for Project Files and Mutation Queue.
   */
  private initDatabase(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;

    if (typeof window === 'undefined' || !this.isIndexedDbAvailable || process.env.NODE_ENV === 'test') {
      return Promise.resolve(null);
    }

    this.dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;

          // Store 1: Drafts
          if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
            const store = db.createObjectStore(STORE_DRAFTS, { keyPath: 'fileId' });
            store.createIndex('projectId', 'projectId', { unique: false });
            store.createIndex('savedAt', 'savedAt', { unique: false });
          }

          // Store 2: Project Files Offline Snapshot Cache
          if (!db.objectStoreNames.contains(STORE_PROJECT_FILES)) {
            const fileStore = db.createObjectStore(STORE_PROJECT_FILES, { keyPath: 'id' });
            fileStore.createIndex('projectId', 'projectId', { unique: false });
            fileStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          }

          // Store 3: Offline Mutation Queue for Conflict-Free Replay
          if (!db.objectStoreNames.contains(STORE_MUTATION_QUEUE)) {
            const queueStore = db.createObjectStore(STORE_MUTATION_QUEUE, {
              keyPath: 'id',
              autoIncrement: true,
            });
            queueStore.createIndex('fileId', 'fileId', { unique: false });
            queueStore.createIndex('status', 'status', { unique: false });
            queueStore.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };

        req.onsuccess = () => {
          resolve(req.result);
        };

        req.onerror = () => {
          console.warn('[DraftStorageService] IndexedDB unavailable, falling back to LocalStorage/Memory');
          resolve(null);
        };

        req.onblocked = () => {
          console.warn('[DraftStorageService] IndexedDB open blocked');
          resolve(null);
        };
      } catch (err) {
        console.warn('[DraftStorageService] Failed to open IndexedDB:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  // =========================================================================
  // TIER 1 & TIER 2: DOCUMENT DRAFT SNAPSHOTS
  // =========================================================================

  /**
   * Immediately updates the in-memory draft cache at 0ms latency.
   */
  public saveMemoryDraft(
    fileId: string,
    content: string,
    projectId?: string,
    title?: string
  ): DraftSnapshot {
    const snapshot: DraftSnapshot = {
      fileId,
      content,
      savedAt: Date.now(),
      projectId,
      title,
    };
    this.memoryCache.set(fileId, snapshot);
    return snapshot;
  }

  /**
   * Persists a document snapshot to all available storage tiers:
   * 1. Memory cache (synchronous)
   * 2. LocalStorage (synchronous, best-effort under 5MB quota)
   * 3. IndexedDB (asynchronous, high capacity)
   */
  public async saveDraft(
    fileId: string,
    content: string,
    projectId?: string,
    title?: string
  ): Promise<void> {
    if (!fileId || typeof window === 'undefined') return;

    const snapshot = this.saveMemoryDraft(fileId, content, projectId, title);

    // 2. LocalStorage (best-effort)
    try {
      localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${fileId}`, JSON.stringify(snapshot));
    } catch {
      // LocalStorage quota exceeded or disabled in private browsing — silently absorb
    }

    // 3. IndexedDB (persistent, large quota)
    try {
      const db = await this.initDatabase();
      if (db) {
        const tx = db.transaction(STORE_DRAFTS, 'readwrite');
        const store = tx.objectStore(STORE_DRAFTS);
        store.put(snapshot);
      }
    } catch {
      // Non-blocking storage error
    }
  }

  /**
   * Synchronous quick draft lookup (Memory -> LocalStorage).
   * Useful for immediate rendering or synchronous lifecycle events (e.g. beforeunload).
   */
  public getDraftSync(fileId: string): DraftSnapshot | null {
    if (!fileId || typeof window === 'undefined') return null;

    // 1. Check memory cache
    const mem = this.memoryCache.get(fileId);
    if (mem) return mem;

    // 2. Check LocalStorage
    try {
      const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${fileId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftSnapshot;
        this.memoryCache.set(fileId, parsed);
        return parsed;
      }
    } catch {
      // Corrupt JSON or access denied
    }

    return null;
  }

  /**
   * Asynchronous comprehensive draft lookup (Memory -> IndexedDB -> LocalStorage).
   */
  public async getDraft(fileId: string): Promise<DraftSnapshot | null> {
    if (!fileId || typeof window === 'undefined') return null;

    // 1. Check memory cache
    const mem = this.memoryCache.get(fileId);
    if (mem) return mem;

    // 2. Check IndexedDB
    try {
      const db = await this.initDatabase();
      if (db) {
        const snapshot = await new Promise<DraftSnapshot | null>((resolve) => {
          const tx = db.transaction(STORE_DRAFTS, 'readonly');
          const store = tx.objectStore(STORE_DRAFTS);
          const req = store.get(fileId);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        });

        if (snapshot) {
          this.memoryCache.set(fileId, snapshot);
          return snapshot;
        }
      }
    } catch {
      // Fallback to LocalStorage
    }

    // 3. Fallback to LocalStorage
    return this.getDraftSync(fileId);
  }

  /**
   * Clears a draft snapshot across all tiers upon successful remote flush.
   */
  public async clearDraft(fileId: string): Promise<void> {
    if (!fileId || typeof window === 'undefined') return;

    // 1. Memory cache
    this.memoryCache.delete(fileId);

    // 2. LocalStorage
    try {
      localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${fileId}`);
    } catch {
      // Ignore
    }

    // 3. IndexedDB
    try {
      const db = await this.initDatabase();
      if (db) {
        const tx = db.transaction(STORE_DRAFTS, 'readwrite');
        const store = tx.objectStore(STORE_DRAFTS);
        store.delete(fileId);
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Clears all offline drafts for an entire project.
   */
  public async clearProjectDrafts(projectId: string): Promise<void> {
    if (!projectId || typeof window === 'undefined') return;

    // Memory cache
    for (const [fileId, draft] of this.memoryCache.entries()) {
      if (draft.projectId === projectId) {
        this.memoryCache.delete(fileId);
        try {
          localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${fileId}`);
        } catch {}
      }
    }

    // IndexedDB index query & delete
    try {
      const db = await this.initDatabase();
      if (db) {
        const tx = db.transaction(STORE_DRAFTS, 'readwrite');
        const store = tx.objectStore(STORE_DRAFTS);
        const index = store.index('projectId');
        const req = index.openCursor(IDBKeyRange.only(projectId));

        req.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Synchronously verifies if a recoverable offline draft exists in Memory or LocalStorage.
   */
  public checkDraftRecovery(
    fileId: string,
    serverContent: string
  ): { hasRecoverableDraft: boolean; draft?: DraftSnapshot } {
    const draft = this.getDraftSync(fileId);
    if (!draft) return { hasRecoverableDraft: false };

    if (draft.content && draft.content !== serverContent) {
      return { hasRecoverableDraft: true, draft };
    }

    return { hasRecoverableDraft: false };
  }

  /**
   * Asynchronously verifies if a recoverable offline draft exists across all tiers including IndexedDB.
   */
  public async checkDraftRecoveryAsync(
    fileId: string,
    serverContent: string
  ): Promise<{ hasRecoverableDraft: boolean; draft?: DraftSnapshot }> {
    const draft = await this.getDraft(fileId);
    if (!draft) return { hasRecoverableDraft: false };

    if (draft.content && draft.content !== serverContent) {
      return { hasRecoverableDraft: true, draft };
    }

    return { hasRecoverableDraft: false };
  }

  /**
   * Retrieves all recent drafts for a specific project.
   */
  public async getRecentDraftsForProject(projectId: string): Promise<DraftSnapshot[]> {
    if (!projectId || typeof window === 'undefined') return [];

    const drafts: DraftSnapshot[] = [];
    const seen = new Set<string>();

    // 1. From memory cache
    for (const d of this.memoryCache.values()) {
      if (d.projectId === projectId) {
        drafts.push(d);
        seen.add(d.fileId);
      }
    }

    // 2. From LocalStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(LOCAL_STORAGE_PREFIX)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw) as DraftSnapshot;
            if (parsed.projectId === projectId && !seen.has(parsed.fileId)) {
              drafts.push(parsed);
              seen.add(parsed.fileId);
            }
          }
        }
      }
    } catch {}

    return drafts.sort((a, b) => b.savedAt - a.savedAt);
  }

  // =========================================================================
  // TIER 2 STORE: PROJECT FILES SNAPSHOT CACHE
  // =========================================================================

  /**
   * Saves or updates a project file snapshot to cache (Memory + IndexedDB).
   */
  public async saveProjectFileSnapshot(file: ProjectFileSnapshot): Promise<void> {
    if (!file?.id) return;
    this.projectFilesMemoryCache.set(file.id, { ...file });

    try {
      const db = await this.initDatabase();
      if (db) {
        const tx = db.transaction(STORE_PROJECT_FILES, 'readwrite');
        const store = tx.objectStore(STORE_PROJECT_FILES);
        store.put(file);
      }
    } catch {
      // Non-blocking
    }
  }

  /**
   * Batch saves snapshots for multiple project files.
   */
  public async saveProjectFilesSnapshot(files: ProjectFileSnapshot[]): Promise<void> {
    if (!Array.isArray(files) || files.length === 0) return;

    for (const file of files) {
      if (file?.id) {
        this.projectFilesMemoryCache.set(file.id, { ...file });
      }
    }

    try {
      const db = await this.initDatabase();
      if (db) {
        const tx = db.transaction(STORE_PROJECT_FILES, 'readwrite');
        const store = tx.objectStore(STORE_PROJECT_FILES);
        for (const file of files) {
          if (file?.id) store.put(file);
        }
      }
    } catch {
      // Non-blocking
    }
  }

  /**
   * Retrieves a cached project file snapshot by fileId.
   */
  public async getProjectFileSnapshot(fileId: string): Promise<ProjectFileSnapshot | null> {
    if (!fileId) return null;

    // 1. Check memory cache
    const mem = this.projectFilesMemoryCache.get(fileId);
    if (mem) return mem;

    // 2. Check IndexedDB
    try {
      const db = await this.initDatabase();
      if (db) {
        const snapshot = await new Promise<ProjectFileSnapshot | null>((resolve) => {
          const tx = db.transaction(STORE_PROJECT_FILES, 'readonly');
          const store = tx.objectStore(STORE_PROJECT_FILES);
          const req = store.get(fileId);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        });

        if (snapshot) {
          this.projectFilesMemoryCache.set(fileId, snapshot);
          return snapshot;
        }
      }
    } catch {
      // Ignore
    }

    return null;
  }

  /**
   * Retrieves all cached file snapshots for a project.
   */
  public async getProjectFilesSnapshot(projectId: string): Promise<ProjectFileSnapshot[]> {
    if (!projectId) return [];

    const fileMap = new Map<string, ProjectFileSnapshot>();

    // 1. Memory cache
    for (const file of this.projectFilesMemoryCache.values()) {
      if (file.projectId === projectId) {
        fileMap.set(file.id, file);
      }
    }

    // 2. IndexedDB
    try {
      const db = await this.initDatabase();
      if (db) {
        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORE_PROJECT_FILES, 'readonly');
          const store = tx.objectStore(STORE_PROJECT_FILES);
          const index = store.index('projectId');
          const req = index.openCursor(IDBKeyRange.only(projectId));

          req.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
              const file = cursor.value as ProjectFileSnapshot;
              if (file && !fileMap.has(file.id)) {
                fileMap.set(file.id, file);
              }
              cursor.continue();
            } else {
              resolve();
            }
          };
          req.onerror = () => resolve();
        });
      }
    } catch {
      // Ignore
    }

    return Array.from(fileMap.values());
  }

  /**
   * Removes a cached project file snapshot.
   */
  public async clearProjectFileSnapshot(fileId: string): Promise<void> {
    if (!fileId) return;
    this.projectFilesMemoryCache.delete(fileId);

    try {
      const db = await this.initDatabase();
      if (db) {
        const tx = db.transaction(STORE_PROJECT_FILES, 'readwrite');
        const store = tx.objectStore(STORE_PROJECT_FILES);
        store.delete(fileId);
      }
    } catch {
      // Ignore
    }
  }

  // =========================================================================
  // TIER 3 STORE: OFFLINE MUTATION REPLAY QUEUE (ORDERED & COALESCING)
  // =========================================================================

  /**
   * Enqueues an offline mutation for later server synchronization.
   *
   * Write Coalescing Optimization:
   * If an 'update_content' mutation is already pending for this fileId, update
   * its payload and timestamp instead of creating redundant writes.
   */
  public async enqueueMutation(
    mutationData: Omit<OfflineMutation, 'id' | 'timestamp' | 'status' | 'retryCount'>
  ): Promise<OfflineMutation> {
    const now = Date.now();

    // 1. Coalesce consecutive update_content mutations for the same fileId
    if (mutationData.type === 'update_content') {
      const existingIdx = this.mutationQueueMemory.findIndex(
        (m) => m.fileId === mutationData.fileId && m.type === 'update_content' && m.status !== 'processing'
      );

      if (existingIdx !== -1) {
        const existing = this.mutationQueueMemory[existingIdx];
        existing.payload = { ...existing.payload, ...mutationData.payload };
        existing.timestamp = now;
        existing.status = 'pending';

        // Update IndexedDB if persistent ID exists
        if (existing.id) {
          try {
            const db = await this.initDatabase();
            if (db) {
              const tx = db.transaction(STORE_MUTATION_QUEUE, 'readwrite');
              const store = tx.objectStore(STORE_MUTATION_QUEUE);
              store.put(existing);
            }
          } catch {}
        }

        return existing;
      }
    }

    // 2. Create new mutation entry
    const newMutation: OfflineMutation = {
      ...mutationData,
      id: this.nextMutationId++,
      status: 'pending',
      retryCount: 0,
      timestamp: now,
    };

    this.mutationQueueMemory.push(newMutation);

    // Persist to IndexedDB
    try {
      const db = await this.initDatabase();
      if (db) {
        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORE_MUTATION_QUEUE, 'readwrite');
          const store = tx.objectStore(STORE_MUTATION_QUEUE);
          // Omit id if autoIncrement in IndexedDB, or write back the returned key
          const { id, ...recordWithoutId } = newMutation;
          const req = store.add(recordWithoutId);
          req.onsuccess = (e) => {
            const assignedId = (e.target as IDBRequest).result as number;
            newMutation.id = assignedId;
            resolve();
          };
          req.onerror = () => resolve();
        });
      }
    } catch {
      // Absorbed; in-memory queue will still serve as fallback
    }

    return newMutation;
  }

  /**
   * Retrieves all pending or failed mutations sorted in FIFO sequence.
   */
  public async getPendingMutations(): Promise<OfflineMutation[]> {
    // 1. In test or memory-only mode
    if (typeof window === 'undefined' || !this.isIndexedDbAvailable || process.env.NODE_ENV === 'test') {
      return [...this.mutationQueueMemory]
        .filter((m) => m.status === 'pending' || m.status === 'failed')
        .sort((a, b) => (a.id || 0) - (b.id || 0));
    }

    // 2. Retrieve from IndexedDB
    try {
      const db = await this.initDatabase();
      if (db) {
        const mutations = await new Promise<OfflineMutation[]>((resolve) => {
          const tx = db.transaction(STORE_MUTATION_QUEUE, 'readonly');
          const store = tx.objectStore(STORE_MUTATION_QUEUE);
          const req = store.getAll();
          req.onsuccess = () => {
            const results = (req.result || []) as OfflineMutation[];
            resolve(
              results
                .filter((m) => m.status === 'pending' || m.status === 'failed')
                .sort((a, b) => (a.id || 0) - (b.id || 0))
            );
          };
          req.onerror = () => resolve([]);
        });

        // Sync back into memory if available
        if (mutations.length > 0) {
          for (const m of mutations) {
            if (!this.mutationQueueMemory.some((existing) => existing.id === m.id)) {
              this.mutationQueueMemory.push(m);
            }
          }
          return mutations;
        }
      }
    } catch {
      // Fallback to memory
    }

    return [...this.mutationQueueMemory]
      .filter((m) => m.status === 'pending' || m.status === 'failed')
      .sort((a, b) => (a.id || 0) - (b.id || 0));
  }

  /**
   * Updates status of an in-flight mutation (e.g., 'processing' or 'failed').
   */
  public async updateMutationStatus(
    id: number,
    status: 'pending' | 'processing' | 'failed',
    error?: string
  ): Promise<void> {
    const item = this.mutationQueueMemory.find((m) => m.id === id);
    if (item) {
      item.status = status;
      if (status === 'failed') item.retryCount++;
      if (error) item.error = error;
    }

    try {
      const db = await this.initDatabase();
      if (db) {
        const tx = db.transaction(STORE_MUTATION_QUEUE, 'readwrite');
        const store = tx.objectStore(STORE_MUTATION_QUEUE);
        const req = store.get(id);
        req.onsuccess = () => {
          const record = req.result as OfflineMutation | undefined;
          if (record) {
            record.status = status;
            if (status === 'failed') record.retryCount = (record.retryCount || 0) + 1;
            if (error) record.error = error;
            store.put(record);
          }
        };
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Removes a mutation after successful synchronization.
   */
  public async removeMutation(id: number): Promise<void> {
    const idx = this.mutationQueueMemory.findIndex((m) => m.id === id);
    if (idx !== -1) {
      this.mutationQueueMemory.splice(idx, 1);
    }

    try {
      const db = await this.initDatabase();
      if (db) {
        const tx = db.transaction(STORE_MUTATION_QUEUE, 'readwrite');
        const store = tx.objectStore(STORE_MUTATION_QUEUE);
        store.delete(id);
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Clears all pending mutations from memory and IndexedDB.
   */
  public async clearPendingMutations(): Promise<void> {
    this.mutationQueueMemory.length = 0;

    try {
      const db = await this.initDatabase();
      if (db) {
        const tx = db.transaction(STORE_MUTATION_QUEUE, 'readwrite');
        const store = tx.objectStore(STORE_MUTATION_QUEUE);
        store.clear();
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Clears memory cache across drafts, project files, and mutations.
   * Useful for testing or cache resets.
   */
  public clearMemory(): void {
    this.memoryCache.clear();
    this.projectFilesMemoryCache.clear();
    this.mutationQueueMemory.length = 0;
    this.nextMutationId = 1;
  }
}

export const draftStorageService = new DraftStorageServiceRegistry();
