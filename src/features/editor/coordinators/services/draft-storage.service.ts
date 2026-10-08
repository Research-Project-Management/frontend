/**
 * draft-storage.service.ts
 *
 * Resilient Multi-Tier Offline Draft Storage for Flux (Zero Data Loss Architecture).
 *
 * Tier 1: In-Memory Map (0ms instant access, survives component remounts within tab).
 * Tier 2: Native IndexedDB (Unlimited capacity, asynchronous, persistent across browser crashes & restarts).
 * Tier 3: LocalStorage Fallback (Synchronous fallback for beforeunload event & legacy browsers).
 */

export interface DraftSnapshot {
  fileId: string;
  content: string;
  savedAt: number;
  projectId?: string;
  title?: string;
}

const DB_NAME = 'flux_offline_drafts_v1';
const STORE_NAME = 'drafts';
const DB_VERSION = 1;
const LOCAL_STORAGE_PREFIX = 'flux_draft:';

class DraftStorageServiceRegistry {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private readonly memoryCache = new Map<string, DraftSnapshot>();
  private isIndexedDbAvailable = false;

  constructor() {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.isIndexedDbAvailable = true;
      this.initDatabase();
    }
  }

  /**
   * Initializes native IndexedDB connection.
   */
  private initDatabase(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;

    if (typeof window === 'undefined' || !this.isIndexedDbAvailable) {
      return Promise.resolve(null);
    }

    this.dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'fileId' });
            store.createIndex('projectId', 'projectId', { unique: false });
            store.createIndex('savedAt', 'savedAt', { unique: false });
          }
        };

        req.onsuccess = () => {
          resolve(req.result);
        };

        req.onerror = () => {
          console.warn('[DraftStorageService] IndexedDB unavailable, falling back to LocalStorage');
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

    const snapshot: DraftSnapshot = {
      fileId,
      content,
      savedAt: Date.now(),
      projectId,
      title,
    };

    // 1. In-memory cache
    this.memoryCache.set(fileId, snapshot);

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
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(snapshot);
      }
    } catch (err) {
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
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
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
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
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
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
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

  /**
   * Clears memory cache (useful for testing or cache reset).
   */
  public clearMemory(): void {
    this.memoryCache.clear();
  }
}

export const draftStorageService = new DraftStorageServiceRegistry();
