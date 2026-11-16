/**
 * draft-storage.ts
 *
 * Resilient Multi-Tier Offline Draft Storage for Flux (Zero Data Loss Architecture).
 *
 * Tier 1: Bounded In-Memory Cache (only active as a test/SSR fallback when IndexedDB is unavailable,
 *         or transiently between debounced keystrokes, avoiding duplicate RAM copies alongside LRUDocumentCache).
 * Tier 2: Native IndexedDB (`flux_offline_drafts_v1`, DB_VERSION = 3) with Adaptive Origin Quota:
 *         - Store 1 (`drafts`): dirty uncommitted editor drafts (capped at 25% of adaptive quota)
 *         - Store 2 (`project_files`): clean project file offline snapshots (LRU-capped at 60% / 500 files)
 *         - Store 3 (`offline_mutations`): persistent FIFO mutation queue with write coalescing (15%)
 * Tier 3: Emergency LocalStorage (`<= 512 KB`, strictly reserved for synchronous `window.beforeunload`).
 */

import { EDITOR_STORAGE_KEYS, EDITOR_LIMITS } from '@/features/editor/domain/constants/editor.constants';

export interface DraftSnapshot {
  fileId: string;
  content: string;
  savedAt: number;
  projectId?: string;
  title?: string;
  sizeBytes?: number;
}

export interface ProjectFileSnapshot {
  id: string; // fileId or pageId
  projectId: string;
  title: string;
  content: string;
  filePath?: string;
  type?: string;
  updatedAt: number;
  sizeBytes?: number;
}

export interface WorkspaceTreeSnapshot {
  workspace: unknown;
  tree: unknown[];
  updatedAt: number;
}

export interface OfflineMutation {
  id?: string;
  fileId: string;
  projectId?: string;
  type: 'update_content' | 'create_file' | 'delete_file';
  payload: { content?: string; [key: string]: unknown };
  status?: 'pending' | 'processing' | 'failed' | 'completed';
  retryCount?: number;
  error?: string;
  createdAt?: number;
  sizeBytes?: number;
}

export interface IDraftStorageSink {
  saveDraft(fileId: string, content: string, projectId?: string, title?: string): Promise<void>;
  getDraft(fileId: string): Promise<DraftSnapshot | null>;
  clearDraft(fileId: string): Promise<void>;
  saveProjectFileSnapshot?(file: ProjectFileSnapshot): Promise<void>;
  getProjectFileSnapshot?(fileId: string): Promise<ProjectFileSnapshot | null>;
  deleteProjectFileSnapshot?(fileId: string): Promise<void>;
}

export interface EditorAdaptiveQuotaPolicy {
  maxTotalDiskBytes: number;
  maxDraftsBytes: number;
  maxProjectFilesBytes: number;
  maxMutationsBytes: number;
  maxProjectFilesCount: number;
  originQuotaBytes?: number;
}

/**
 * Computes Editor IndexedDB disk quota dynamically from `navigator.storage.estimate()`,
 * allocating 8% of available origin quota clamped to [24 MB, 100 MB] so Reader (<= 300 MB)
 * and Editor (<= 100 MB) coexist safely well under Firefox's 2 GB eTLD+1 limit.
 */
export function calculateAdaptiveEditorQuota(
  originQuotaBytes?: number,
  originUsageBytes?: number,
): EditorAdaptiveQuotaPolicy {
  let maxTotalDiskBytes: number = EDITOR_LIMITS.MAX_EDITOR_DISK_CEILING_BYTES;

  if (typeof originQuotaBytes === 'number' && Number.isFinite(originQuotaBytes) && originQuotaBytes > 0) {
    const usedBytes =
      typeof originUsageBytes === 'number' && Number.isFinite(originUsageBytes) && originUsageBytes > 0
        ? originUsageBytes
        : 0;
    const proportionalShare = Math.floor(
      Math.max(0, originQuotaBytes - usedBytes) * EDITOR_LIMITS.EDITOR_ORIGIN_QUOTA_SHARE,
    );
    maxTotalDiskBytes = Math.max(
      EDITOR_LIMITS.MIN_EDITOR_DISK_FLOOR_BYTES,
      Math.min(EDITOR_LIMITS.MAX_EDITOR_DISK_CEILING_BYTES, proportionalShare),
    );
  }

  return {
    maxTotalDiskBytes,
    maxDraftsBytes: Math.floor(maxTotalDiskBytes * 0.25),
    maxProjectFilesBytes: Math.floor(maxTotalDiskBytes * 0.6),
    maxMutationsBytes: Math.floor(maxTotalDiskBytes * 0.15),
    maxProjectFilesCount: EDITOR_LIMITS.MAX_PROJECT_FILES_COUNT,
    originQuotaBytes,
  };
}

function isQuotaExceededError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const domErr = err as { name?: string; code?: number; message?: string };
  return (
    domErr.name === 'QuotaExceededError' ||
    domErr.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    domErr.code === 22 ||
    domErr.code === 1014 ||
    Boolean(domErr.message && domErr.message.toLowerCase().includes('quota'))
  );
}

const DB_NAME = EDITOR_STORAGE_KEYS.OFFLINE_DRAFTS_DB;
const STORE_DRAFTS = 'drafts';
const STORE_PROJECT_FILES = 'project_files';
const STORE_MUTATIONS = 'offline_mutations';
const DB_VERSION = 3;
const LOCAL_STORAGE_PREFIX = EDITOR_STORAGE_KEYS.DRAFT_PREFIX;
const MUTATION_QUEUE_STORAGE_KEY = EDITOR_STORAGE_KEYS.OFFLINE_MUTATIONS_QUEUE;
const WORKSPACE_TREE_STORAGE_PREFIX = 'flux_workspace_tree:';
const MAX_WORKSPACE_TREE_ENTRIES = 20;
const MAX_MEMORY_DRAFTS = EDITOR_LIMITS.MAX_MEMORY_DRAFTS;
const MAX_PROJECT_FILES_CACHE = EDITOR_LIMITS.MAX_PROJECT_FILES_CACHE;

export class DraftStorageService implements IDraftStorageSink {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private readonly memoryCache = new Map<string, DraftSnapshot>();
  private readonly projectFilesMemoryCache = new Map<string, ProjectFileSnapshot>();
  private readonly workspaceTreeMemoryCache = new Map<string, WorkspaceTreeSnapshot>();
  private readonly mutationQueue: OfflineMutation[] = [];
  private isIndexedDbAvailable = false;
  private quotaPolicy: EditorAdaptiveQuotaPolicy = calculateAdaptiveEditorQuota();

  private setMemoryDraftBounded(fileId: string, snapshot: DraftSnapshot): void {
    if (this.memoryCache.size >= MAX_MEMORY_DRAFTS && !this.memoryCache.has(fileId)) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) this.memoryCache.delete(oldestKey);
    }
    this.memoryCache.set(fileId, snapshot);
  }

  private setProjectFileMemoryBounded(fileId: string, snapshot: ProjectFileSnapshot): void {
    if (this.projectFilesMemoryCache.size >= MAX_PROJECT_FILES_CACHE && !this.projectFilesMemoryCache.has(fileId)) {
      const oldestKey = this.projectFilesMemoryCache.keys().next().value;
      if (oldestKey) this.projectFilesMemoryCache.delete(oldestKey);
    }
    this.projectFilesMemoryCache.set(fileId, snapshot);
  }

  constructor() {
    if (typeof window !== 'undefined' && 'indexedDB' in window && process.env.NODE_ENV !== 'test') {
      this.isIndexedDbAvailable = true;
      void this.bootstrapBrowserStorage();
    }
  }

  private async bootstrapBrowserStorage(): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        this.quotaPolicy = calculateAdaptiveEditorQuota(est.quota, est.usage);
      }
    } catch {
      // Retain safe default ceiling
    }

    const db = await this.initDatabase();
    if (db) {
      await this.migrateLegacyLocalStorageMutations(db);
      setTimeout(() => {
        void this.enforceDiskQuota();
      }, 2500);
    }
  }

  private async migrateLegacyLocalStorageMutations(db: IDBDatabase): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(MUTATION_QUEUE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as OfflineMutation[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_MUTATIONS, 'readwrite');
          const store = tx.objectStore(STORE_MUTATIONS);
          for (const item of parsed) {
            if (!item || !item.fileId) continue;
            const entry: OfflineMutation = {
              ...item,
              id: item.id || `mut-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              createdAt: item.createdAt || Date.now(),
              sizeBytes: item.sizeBytes ?? JSON.stringify(item.payload ?? {}).length,
            };
            store.put(entry);
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }
      localStorage.removeItem(MUTATION_QUEUE_STORAGE_KEY);
    } catch {
      // Non-blocking migration error
    }
  }

  /**
   * Initializes native IndexedDB v3 connection with Drafts, ProjectFiles, and OfflineMutations stores.
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

          // Store 3: Offline Mutation Queue
          if (!db.objectStoreNames.contains(STORE_MUTATIONS)) {
            const mutStore = db.createObjectStore(STORE_MUTATIONS, { keyPath: 'id' });
            mutStore.createIndex('projectId', 'projectId', { unique: false });
            mutStore.createIndex('fileId', 'fileId', { unique: false });
            mutStore.createIndex('createdAt', 'createdAt', { unique: false });
            mutStore.createIndex('status', 'status', { unique: false });
          }
        };

        req.onsuccess = () => {
          const db = req.result;
          db.onversionchange = () => {
            try {
              db.close();
            } catch {
              // Ignore
            }
            this.dbPromise = null;
          };
          resolve(db);
        };

        req.onerror = () => {
          console.warn('[DraftStorageService] IndexedDB unavailable, falling back to Memory');
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

  public setQuotaPolicy(partial: Partial<EditorAdaptiveQuotaPolicy>): void {
    this.quotaPolicy = {
      ...this.quotaPolicy,
      ...partial,
    };
  }

  public getQuotaPolicy(): EditorAdaptiveQuotaPolicy {
    return { ...this.quotaPolicy };
  }

  // =========================================================================
  // TIER 1 & TIER 2 & TIER 3: DOCUMENT DRAFT SNAPSHOTS
  // =========================================================================

  /**
   * Immediately updates the transient in-memory draft cache at 0ms latency.
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
      sizeBytes: content.length,
    };
    this.setMemoryDraftBounded(fileId, snapshot);
    return snapshot;
  }

  /**
   * Synchronous emergency LocalStorage save strictly reserved for `window.beforeunload`
   * when the document is within the 512 KB emergency ceiling.
   */
  public saveEmergencyUnloadDraft(
    fileId: string,
    content: string,
    projectId?: string,
    title?: string
  ): boolean {
    if (
      typeof window === 'undefined' ||
      !fileId ||
      content.length > EDITOR_LIMITS.EMERGENCY_UNLOAD_MAX_BYTES
    ) {
      return false;
    }

    const snapshot: DraftSnapshot = {
      fileId,
      content,
      savedAt: Date.now(),
      projectId,
      title,
      sizeBytes: content.length,
    };

    try {
      localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${fileId}`, JSON.stringify(snapshot));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Persists a document snapshot asynchronously to IndexedDB (zero periodic LocalStorage blocking).
   * Falls back to bounded in-memory storage when IndexedDB is unavailable (e.g. test/SSR).
   */
  public async saveDraft(
    fileId: string,
    content: string,
    projectId?: string,
    title?: string
  ): Promise<void> {
    if (!fileId || typeof window === 'undefined') return;

    const snapshot: DraftSnapshot = {
      fileId,
      content,
      savedAt: Date.now(),
      projectId,
      title,
      sizeBytes: content.length,
    };

    const db = await this.initDatabase();
    if (db) {
      const writeToIdb = () =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_DRAFTS, 'readwrite');
          tx.objectStore(STORE_DRAFTS).put(snapshot);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });

      try {
        await writeToIdb();
      } catch (err) {
        if (isQuotaExceededError(err)) {
          await this.enforceDiskQuota({ aggressive: true });
          await writeToIdb().catch(() => {});
        }
      }

      // IndexedDB owns persistence now; drop redundant RAM & emergency localStorage copies
      this.memoryCache.delete(fileId);
      try {
        localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${fileId}`);
      } catch {
        // Ignore
      }
      return;
    }

    // Fallback when IndexedDB is unavailable (e.g. Vitest or restricted context)
    this.setMemoryDraftBounded(fileId, snapshot);
  }

  private readEmergencyLocalDraft(fileId: string): DraftSnapshot | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${fileId}`);
      if (raw) {
        return JSON.parse(raw) as DraftSnapshot;
      }
    } catch {
      // Corrupt JSON or access denied
    }
    return null;
  }

  /**
   * Synchronous quick draft lookup (Memory -> Emergency LocalStorage).
   */
  public getDraftSync(fileId: string): DraftSnapshot | null {
    if (!fileId || typeof window === 'undefined') return null;

    const mem = this.memoryCache.get(fileId) ?? null;
    const ls = this.readEmergencyLocalDraft(fileId);

    if (mem && ls) {
      return mem.savedAt >= ls.savedAt ? mem : ls;
    }
    if (mem) return mem;
    if (ls) {
      if (!this.isIndexedDbAvailable) {
        this.setMemoryDraftBounded(fileId, ls);
      }
      return ls;
    }

    return null;
  }

  /**
   * Asynchronous comprehensive draft lookup comparing Memory, Emergency LocalStorage, and IndexedDB
   * and returning whichever snapshot has the newest `savedAt`.
   */
  public async getDraft(fileId: string): Promise<DraftSnapshot | null> {
    if (!fileId || typeof window === 'undefined') return null;

    const candidates: DraftSnapshot[] = [];
    const mem = this.memoryCache.get(fileId);
    if (mem) candidates.push(mem);

    const ls = this.readEmergencyLocalDraft(fileId);
    if (ls) candidates.push(ls);

    try {
      const db = await this.initDatabase();
      if (db) {
        const snapshot = await new Promise<DraftSnapshot | null>((resolve) => {
          const tx = db.transaction(STORE_DRAFTS, 'readonly');
          const req = tx.objectStore(STORE_DRAFTS).get(fileId);
          req.onsuccess = () => resolve((req.result as DraftSnapshot) || null);
          req.onerror = () => resolve(null);
        });
        if (snapshot) {
          candidates.push(snapshot);
        }
      }
    } catch {
      // Ignore IDB read errors
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.savedAt - a.savedAt);
    return candidates[0];
  }

  /**
   * Clears a draft snapshot across all tiers upon successful remote flush.
   */
  public async clearDraft(fileId: string): Promise<void> {
    if (!fileId || typeof window === 'undefined') return;

    this.memoryCache.delete(fileId);

    try {
      localStorage.removeItem(`${LOCAL_STORAGE_PREFIX}${fileId}`);
    } catch {
      // Ignore
    }

    try {
      const db = await this.initDatabase();
      if (db) {
        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORE_DRAFTS, 'readwrite');
          tx.objectStore(STORE_DRAFTS).delete(fileId);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
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

    for (const [fileId, draft] of this.memoryCache.entries()) {
      if (draft.projectId === projectId) {
        this.memoryCache.delete(fileId);
      }
    }

    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith(LOCAL_STORAGE_PREFIX)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw) as DraftSnapshot;
            if (parsed.projectId === projectId) {
              localStorage.removeItem(key);
            }
          }
        }
      }
    } catch {
      // Ignore
    }

    try {
      const db = await this.initDatabase();
      if (db) {
        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORE_DRAFTS, 'readwrite');
          const index = tx.objectStore(STORE_DRAFTS).index('projectId');
          const req = index.openCursor(IDBKeyRange.only(projectId));

          req.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            }
          };
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Synchronously verifies if a recoverable offline draft exists in Memory or Emergency LocalStorage.
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
   * Retrieves all recent drafts for a specific project across Memory, Emergency LocalStorage, and IndexedDB.
   */
  public async getRecentDraftsForProject(projectId: string): Promise<DraftSnapshot[]> {
    if (!projectId || typeof window === 'undefined') return [];

    const byFileId = new Map<string, DraftSnapshot>();
    const consider = (d: DraftSnapshot | null | undefined) => {
      if (!d || d.projectId !== projectId) return;
      const existing = byFileId.get(d.fileId);
      if (!existing || d.savedAt > existing.savedAt) {
        byFileId.set(d.fileId, d);
      }
    };

    for (const d of this.memoryCache.values()) {
      consider(d);
    }

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(LOCAL_STORAGE_PREFIX)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            consider(JSON.parse(raw) as DraftSnapshot);
          }
        }
      }
    } catch {
      // Ignore
    }

    try {
      const db = await this.initDatabase();
      if (db) {
        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORE_DRAFTS, 'readonly');
          const index = tx.objectStore(STORE_DRAFTS).index('projectId');
          const req = index.openCursor(IDBKeyRange.only(projectId));

          req.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
              consider(cursor.value as DraftSnapshot);
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

    return Array.from(byFileId.values()).sort((a, b) => b.savedAt - a.savedAt);
  }

  // =========================================================================
  // TIER 2 STORE: PROJECT FILES SNAPSHOT CACHE
  // =========================================================================

  /**
   * Saves or updates a project file snapshot to IndexedDB (or Memory fallback when IDB is unavailable).
   */
  public async saveProjectFileSnapshot(file: ProjectFileSnapshot): Promise<void> {
    if (!file?.id) return;
    const enriched: ProjectFileSnapshot = {
      ...file,
      sizeBytes: file.sizeBytes ?? file.content.length,
    };

    const db = await this.initDatabase();
    if (db) {
      const writeToIdb = () =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_PROJECT_FILES, 'readwrite');
          tx.objectStore(STORE_PROJECT_FILES).put(enriched);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });

      try {
        await writeToIdb();
      } catch (err) {
        if (isQuotaExceededError(err)) {
          await this.enforceDiskQuota({ aggressive: true });
          await writeToIdb().catch(() => {});
        }
      }
      this.projectFilesMemoryCache.delete(enriched.id);
      await this.enforceDiskQuota();
      return;
    }

    this.setProjectFileMemoryBounded(enriched.id, enriched);
  }

  /**
   * Batch saves snapshots for multiple project files.
   */
  public async saveProjectFilesSnapshot(files: ProjectFileSnapshot[]): Promise<void> {
    if (!Array.isArray(files) || files.length === 0) return;

    const enrichedList = files
      .filter((f): f is ProjectFileSnapshot => Boolean(f?.id))
      .map((f) => ({
        ...f,
        sizeBytes: f.sizeBytes ?? f.content.length,
      }));
    if (enrichedList.length === 0) return;

    const db = await this.initDatabase();
    if (db) {
      const writeToIdb = () =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_PROJECT_FILES, 'readwrite');
          const store = tx.objectStore(STORE_PROJECT_FILES);
          for (const file of enrichedList) {
            store.put(file);
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });

      try {
        await writeToIdb();
      } catch (err) {
        if (isQuotaExceededError(err)) {
          await this.enforceDiskQuota({ aggressive: true });
          await writeToIdb().catch(() => {});
        }
      }
      for (const file of enrichedList) {
        this.projectFilesMemoryCache.delete(file.id);
      }
      await this.enforceDiskQuota();
      return;
    }

    for (const file of enrichedList) {
      this.setProjectFileMemoryBounded(file.id, file);
    }
  }

  /**
   * Retrieves a cached project file snapshot by fileId.
   */
  public async getProjectFileSnapshot(fileId: string): Promise<ProjectFileSnapshot | null> {
    if (!fileId) return null;

    const mem = this.projectFilesMemoryCache.get(fileId);
    if (mem) return mem;

    try {
      const db = await this.initDatabase();
      if (db) {
        return await new Promise<ProjectFileSnapshot | null>((resolve) => {
          const tx = db.transaction(STORE_PROJECT_FILES, 'readonly');
          const req = tx.objectStore(STORE_PROJECT_FILES).get(fileId);
          req.onsuccess = () => resolve((req.result as ProjectFileSnapshot) || null);
          req.onerror = () => resolve(null);
        });
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

    for (const file of this.projectFilesMemoryCache.values()) {
      if (file.projectId === projectId) {
        fileMap.set(file.id, file);
      }
    }

    try {
      const db = await this.initDatabase();
      if (db) {
        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORE_PROJECT_FILES, 'readonly');
          const index = tx.objectStore(STORE_PROJECT_FILES).index('projectId');
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
        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORE_PROJECT_FILES, 'readwrite');
          tx.objectStore(STORE_PROJECT_FILES).delete(fileId);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Deletes a cached project file snapshot from memory and IndexedDB.
   */
  public async deleteProjectFileSnapshot(fileId: string): Promise<void> {
    return this.clearProjectFileSnapshot(fileId);
  }

  private setWorkspaceTreeMemoryBounded(scopeId: string, snapshot: WorkspaceTreeSnapshot): void {
    if (
      this.workspaceTreeMemoryCache.size >= MAX_MEMORY_DRAFTS &&
      !this.workspaceTreeMemoryCache.has(scopeId)
    ) {
      const oldestKey = this.workspaceTreeMemoryCache.keys().next().value;
      if (oldestKey) this.workspaceTreeMemoryCache.delete(oldestKey);
    }
    this.workspaceTreeMemoryCache.set(scopeId, snapshot);
  }

  private evictOldestWorkspaceTreeLocalStorageEntry(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(WORKSPACE_TREE_STORAGE_PREFIX)) continue;
        const raw = localStorage.getItem(key);
        let updatedAt = 0;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as { updatedAt?: number };
            updatedAt = typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0;
          } catch {
            updatedAt = 0;
          }
        }
        if (updatedAt < oldestTime) {
          oldestTime = updatedAt;
          oldestKey = key;
        }
      }
      if (oldestKey) {
        localStorage.removeItem(oldestKey);
        return true;
      }
    } catch {
      // Ignore storage access errors
    }
    return false;
  }

  /**
   * Persists lightweight workspace & virtual file tree metadata across scopes so
   * offline bootstrap can reconstruct unopened sibling docs, folders, and binary assets.
   */
  public async saveWorkspaceTreeSnapshot(
    scopeIds: string[],
    payload: { workspace: unknown; tree: unknown[] },
  ): Promise<void> {
    if (!Array.isArray(scopeIds) || scopeIds.length === 0 || !payload) return;
    const uniqueScopes = Array.from(
      new Set(scopeIds.map((id) => id?.trim()).filter((id): id is string => Boolean(id))),
    );
    if (uniqueScopes.length === 0) return;

    const entry: WorkspaceTreeSnapshot = {
      workspace: payload.workspace,
      tree: Array.isArray(payload.tree) ? payload.tree : [],
      updatedAt: Date.now(),
    };

    for (const scopeId of uniqueScopes) {
      this.setWorkspaceTreeMemoryBounded(scopeId, entry);
    }

    if (typeof window === 'undefined') return;
    let serialized = '';
    try {
      serialized = JSON.stringify(entry);
    } catch {
      return;
    }
    if (!serialized || serialized.length > EDITOR_LIMITS.EMERGENCY_UNLOAD_MAX_BYTES) {
      return;
    }

    try {
      let existingTreeKeys = 0;
      for (let i = 0; i < localStorage.length; i++) {
        if (localStorage.key(i)?.startsWith(WORKSPACE_TREE_STORAGE_PREFIX)) {
          existingTreeKeys++;
        }
      }

      for (const scopeId of uniqueScopes) {
        const storageKey = `${WORKSPACE_TREE_STORAGE_PREFIX}${scopeId}`;
        if (!localStorage.getItem(storageKey)) {
          while (existingTreeKeys >= MAX_WORKSPACE_TREE_ENTRIES) {
            if (!this.evictOldestWorkspaceTreeLocalStorageEntry()) break;
            existingTreeKeys--;
          }
          existingTreeKeys++;
        }
        try {
          localStorage.setItem(storageKey, serialized);
        } catch (err) {
          if (isQuotaExceededError(err) && this.evictOldestWorkspaceTreeLocalStorageEntry()) {
            try {
              localStorage.setItem(storageKey, serialized);
            } catch {
              // Ignore quota errors after one eviction retry
            }
          }
        }
      }
    } catch {
      // Ignore SSR/restricted localStorage errors
    }
  }

  /**
   * Retrieves lightweight workspace & virtual file tree metadata for a scopeId.
   */
  public async getWorkspaceTreeSnapshot(scopeId: string): Promise<WorkspaceTreeSnapshot | null> {
    if (!scopeId) return null;

    const mem = this.workspaceTreeMemoryCache.get(scopeId);
    if (mem) return mem;

    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(`${WORKSPACE_TREE_STORAGE_PREFIX}${scopeId}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as WorkspaceTreeSnapshot;
      if (parsed && typeof parsed === 'object' && parsed.workspace && Array.isArray(parsed.tree)) {
        this.setWorkspaceTreeMemoryBounded(scopeId, parsed);
        return parsed;
      }
    } catch {
      // Ignore corrupt JSON or storage errors
    }
    return null;
  }

  /**
   * Clears in-memory fallback caches to release memory upon project switch or test teardown.
   */
  public clearMemoryCaches(): void {
    this.memoryCache.clear();
    this.projectFilesMemoryCache.clear();
    this.workspaceTreeMemoryCache.clear();
    this.mutationQueue.length = 0;
    if (process.env.NODE_ENV === 'test' && typeof window !== 'undefined') {
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key?.startsWith(WORKSPACE_TREE_STORAGE_PREFIX)) {
            localStorage.removeItem(key);
          }
        }
      } catch {
        // Ignore
      }
    }
  }

  public clearMemory(): void {
    this.clearMemoryCaches();
  }

  // =========================================================================
  // TIER 2 STORE: PERSISTENT OFFLINE MUTATION QUEUE (INDEXEDDB + MEMORY FALLBACK)
  // =========================================================================

  private async getAllIdbMutations(db: IDBDatabase): Promise<OfflineMutation[]> {
    return await new Promise<OfflineMutation[]>((resolve) => {
      const tx = db.transaction(STORE_MUTATIONS, 'readonly');
      const req = tx.objectStore(STORE_MUTATIONS).getAll();
      req.onsuccess = () => {
        const list = ((req.result as OfflineMutation[]) || []).slice();
        list.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  }

  public async enqueueMutation(
    mutation: Omit<OfflineMutation, 'id' | 'createdAt'> & { id?: string }
  ): Promise<OfflineMutation> {
    const sizeBytes = mutation.sizeBytes ?? JSON.stringify(mutation.payload ?? {}).length;
    const db = await this.initDatabase();

    if (db) {
      if (mutation.type === 'update_content') {
        const existing = await new Promise<OfflineMutation | null>((resolve) => {
          const tx = db.transaction(STORE_MUTATIONS, 'readonly');
          const index = tx.objectStore(STORE_MUTATIONS).index('fileId');
          const req = index.getAll(IDBKeyRange.only(mutation.fileId));
          req.onsuccess = () => {
            const matches = (req.result as OfflineMutation[]) || [];
            const target = matches.find(
              (m) => m.type === 'update_content' && (m.status === 'pending' || !m.status),
            );
            resolve(target || null);
          };
          req.onerror = () => resolve(null);
        });

        if (existing) {
          const mergedPayload = { ...existing.payload, ...mutation.payload };
          const updated: OfflineMutation = {
            ...existing,
            payload: mergedPayload,
            status: 'pending',
            sizeBytes: JSON.stringify(mergedPayload).length,
          };
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_MUTATIONS, 'readwrite');
            tx.objectStore(STORE_MUTATIONS).put(updated);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          });
          return updated;
        }
      }

      const item: OfflineMutation = {
        ...mutation,
        id: mutation.id || `mut-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        status: mutation.status || 'pending',
        retryCount: mutation.retryCount || 0,
        createdAt: Date.now(),
        sizeBytes,
      };
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_MUTATIONS, 'readwrite');
        tx.objectStore(STORE_MUTATIONS).put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return item;
    }

    // In-memory fallback (Vitest / SSR / no IDB — never mirror payloads into localStorage)
    const id = mutation.id || `mut-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const createdAt = Date.now();

    if (mutation.type === 'update_content') {
      const existingIdx = this.mutationQueue.findIndex(
        (m) => m.fileId === mutation.fileId && m.type === 'update_content' && (m.status === 'pending' || !m.status),
      );
      if (existingIdx !== -1) {
        const mergedPayload = { ...this.mutationQueue[existingIdx].payload, ...mutation.payload };
        this.mutationQueue[existingIdx] = {
          ...this.mutationQueue[existingIdx],
          payload: mergedPayload,
          status: 'pending',
          sizeBytes: JSON.stringify(mergedPayload).length,
        };
        return this.mutationQueue[existingIdx];
      }
    }

    const item: OfflineMutation = {
      ...mutation,
      id,
      status: mutation.status || 'pending',
      retryCount: mutation.retryCount || 0,
      createdAt,
      sizeBytes,
    };
    this.mutationQueue.push(item);
    return item;
  }

  public async getPendingMutations(): Promise<OfflineMutation[]> {
    const db = await this.initDatabase();
    if (db) {
      const all = await this.getAllIdbMutations(db);
      return all.filter((m) => m.status === 'pending' || m.status === 'failed' || !m.status);
    }
    return this.mutationQueue.filter((m) => m.status === 'pending' || m.status === 'failed' || !m.status);
  }

  public async updateMutationStatus(
    id: string,
    status: 'pending' | 'processing' | 'failed' | 'completed',
    error?: string
  ): Promise<void> {
    const db = await this.initDatabase();
    if (db) {
      const existing = await new Promise<OfflineMutation | null>((resolve) => {
        const tx = db.transaction(STORE_MUTATIONS, 'readonly');
        const req = tx.objectStore(STORE_MUTATIONS).get(id);
        req.onsuccess = () => resolve((req.result as OfflineMutation) || null);
        req.onerror = () => resolve(null);
      });
      if (!existing) return;
      const updated: OfflineMutation = {
        ...existing,
        status,
        error: error !== undefined ? error : existing.error,
        retryCount: status === 'failed' ? (existing.retryCount || 0) + 1 : existing.retryCount || 0,
      };
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_MUTATIONS, 'readwrite');
        tx.objectStore(STORE_MUTATIONS).put(updated);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
      return;
    }

    const item = this.mutationQueue.find((m) => m.id === id);
    if (!item) return;
    item.status = status;
    if (error !== undefined) {
      item.error = error;
    }
    if (status === 'failed') {
      item.retryCount = (item.retryCount || 0) + 1;
    }
  }

  public async removeMutation(id: string): Promise<void> {
    const db = await this.initDatabase();
    if (db) {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_MUTATIONS, 'readwrite');
        tx.objectStore(STORE_MUTATIONS).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
      return;
    }

    const idx = this.mutationQueue.findIndex((m) => m.id === id);
    if (idx !== -1) {
      this.mutationQueue.splice(idx, 1);
    }
  }

  public async clearMutations(): Promise<void> {
    const db = await this.initDatabase();
    if (db) {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_MUTATIONS, 'readwrite');
        tx.objectStore(STORE_MUTATIONS).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
      return;
    }
    this.mutationQueue.length = 0;
  }

  // =========================================================================
  // TTL & ADAPTIVE DISK QUOTA ENFORCEMENT
  // =========================================================================

  /**
   * Prunes expired drafts (> 30d TTL), evicts LRU `project_files` snapshots above the
   * adaptive count/byte limits, and trims completed / exhausted failed mutations.
   */
  public async enforceDiskQuota(options?: {
    aggressive?: boolean;
    now?: number;
  }): Promise<{ prunedDrafts: number; evictedFiles: number; prunedMutations: number }> {
    const now = options?.now ?? Date.now();
    const policy = this.quotaPolicy;
    const targetFileCount = options?.aggressive
      ? Math.max(0, Math.floor(policy.maxProjectFilesCount * 0.5))
      : policy.maxProjectFilesCount;
    const targetFileBytes = options?.aggressive
      ? Math.max(0, Math.floor(policy.maxProjectFilesBytes * 0.5))
      : policy.maxProjectFilesBytes;
    const targetMutationBytes = options?.aggressive
      ? Math.max(0, Math.floor(policy.maxMutationsBytes * 0.5))
      : policy.maxMutationsBytes;

    let prunedDrafts = 0;
    let evictedFiles = 0;
    let prunedMutations = 0;

    const db = await this.initDatabase();
    if (db) {
      try {
        // 1. Prune stale drafts beyond STALE_DRAFT_TTL_MS
        const drafts = await new Promise<DraftSnapshot[]>((resolve) => {
          const tx = db.transaction(STORE_DRAFTS, 'readonly');
          const req = tx.objectStore(STORE_DRAFTS).getAll();
          req.onsuccess = () => resolve((req.result as DraftSnapshot[]) || []);
          req.onerror = () => resolve([]);
        });
        const expiredDraftIds = drafts
          .filter((d) => now - (d.savedAt || 0) > EDITOR_LIMITS.STALE_DRAFT_TTL_MS)
          .map((d) => d.fileId);
        if (expiredDraftIds.length > 0) {
          await new Promise<void>((resolve) => {
            const tx = db.transaction(STORE_DRAFTS, 'readwrite');
            const store = tx.objectStore(STORE_DRAFTS);
            for (const id of expiredDraftIds) {
              store.delete(id);
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          });
          prunedDrafts = expiredDraftIds.length;
        }

        // 2. Evict oldest project_files snapshots when exceeding targetFileCount or targetFileBytes
        const projectFiles = await new Promise<ProjectFileSnapshot[]>((resolve) => {
          const tx = db.transaction(STORE_PROJECT_FILES, 'readonly');
          const req = tx.objectStore(STORE_PROJECT_FILES).getAll();
          req.onsuccess = () => resolve((req.result as ProjectFileSnapshot[]) || []);
          req.onerror = () => resolve([]);
        });
        projectFiles.sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0));
        let totalFileBytes = projectFiles.reduce(
          (sum, f) => sum + (f.sizeBytes ?? f.content?.length ?? 0),
          0,
        );
        let remainingFiles = projectFiles.length;
        const evictFileIds: string[] = [];
        for (const f of projectFiles) {
          if (remainingFiles <= targetFileCount && totalFileBytes <= targetFileBytes) {
            break;
          }
          evictFileIds.push(f.id);
          totalFileBytes -= f.sizeBytes ?? f.content?.length ?? 0;
          remainingFiles -= 1;
        }
        if (evictFileIds.length > 0) {
          await new Promise<void>((resolve) => {
            const tx = db.transaction(STORE_PROJECT_FILES, 'readwrite');
            const store = tx.objectStore(STORE_PROJECT_FILES);
            for (const id of evictFileIds) {
              store.delete(id);
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          });
          evictedFiles = evictFileIds.length;
        }

        // 3. Prune completed mutations & failed mutations with retryCount >= 3 when over byte ceiling
        const mutations = await this.getAllIdbMutations(db);
        const removeMutIds: string[] = [];
        const survivors: OfflineMutation[] = [];
        for (const m of mutations) {
          if (m.status === 'completed' && m.id) {
            removeMutIds.push(m.id);
          } else {
            survivors.push(m);
          }
        }
        let totalMutBytes = survivors.reduce(
          (sum, m) => sum + (m.sizeBytes ?? JSON.stringify(m.payload ?? {}).length),
          0,
        );
        for (const m of survivors) {
          if (totalMutBytes <= targetMutationBytes) break;
          if (m.status === 'failed' && (m.retryCount ?? 0) >= 3 && m.id) {
            removeMutIds.push(m.id);
            totalMutBytes -= m.sizeBytes ?? JSON.stringify(m.payload ?? {}).length;
          }
        }
        if (removeMutIds.length > 0) {
          await new Promise<void>((resolve) => {
            const tx = db.transaction(STORE_MUTATIONS, 'readwrite');
            const store = tx.objectStore(STORE_MUTATIONS);
            for (const id of removeMutIds) {
              store.delete(id);
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          });
          prunedMutations = removeMutIds.length;
        }
      } catch {
        // Non-blocking IDB cleanup error
      }
      return { prunedDrafts, evictedFiles, prunedMutations };
    }

    // Memory fallback quota/TTL enforcement (used in Vitest & restricted environments)
    for (const [fileId, draft] of Array.from(this.memoryCache.entries())) {
      if (now - (draft.savedAt || 0) > EDITOR_LIMITS.STALE_DRAFT_TTL_MS) {
        this.memoryCache.delete(fileId);
        prunedDrafts += 1;
      }
    }

    const memFiles = Array.from(this.projectFilesMemoryCache.values()).sort(
      (a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0),
    );
    let totalMemFileBytes = memFiles.reduce(
      (sum, f) => sum + (f.sizeBytes ?? f.content.length),
      0,
    );
    let remainingMemFiles = memFiles.length;
    for (const f of memFiles) {
      if (remainingMemFiles <= targetFileCount && totalMemFileBytes <= targetFileBytes) {
        break;
      }
      this.projectFilesMemoryCache.delete(f.id);
      totalMemFileBytes -= f.sizeBytes ?? f.content.length;
      remainingMemFiles -= 1;
      evictedFiles += 1;
    }

    for (let i = this.mutationQueue.length - 1; i >= 0; i--) {
      if (this.mutationQueue[i].status === 'completed') {
        this.mutationQueue.splice(i, 1);
        prunedMutations += 1;
      }
    }
    this.mutationQueue.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    let totalMemMutBytes = this.mutationQueue.reduce(
      (sum, m) => sum + (m.sizeBytes ?? JSON.stringify(m.payload ?? {}).length),
      0,
    );
    for (let i = 0; i < this.mutationQueue.length && totalMemMutBytes > targetMutationBytes; ) {
      const m = this.mutationQueue[i];
      if (m.status === 'failed' && (m.retryCount ?? 0) >= 3) {
        totalMemMutBytes -= m.sizeBytes ?? JSON.stringify(m.payload ?? {}).length;
        this.mutationQueue.splice(i, 1);
        prunedMutations += 1;
      } else {
        i += 1;
      }
    }

    return { prunedDrafts, evictedFiles, prunedMutations };
  }
}

export { DraftStorageService as DraftStorageServiceRegistry };
export const draftStorageService = new DraftStorageService();
