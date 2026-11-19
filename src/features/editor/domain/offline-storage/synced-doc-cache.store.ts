/**
 * synced-doc-cache.store.ts
 *
 * Local-first IndexedDB read cache of clean, Server-authoritative documents (validated
 * by `rev` and `hash`) plus lightweight workspace tree snapshots. Never holds dirty
 * uncommitted offline edits so local server baselines remain intact for diff/discard.
 */

import {
  EDITOR_LIMITS,
  EDITOR_STORAGE_KEYS,
} from '@/features/editor/domain/constants/editor.constants';
import {
  OFFLINE_DB_STORES,
  isQuotaExceededError,
  type OfflineDbConnection,
} from './offline-db.connection';

export interface SyncedDocCacheEntry {
  id: string;
  projectId: string;
  title: string;
  content: string;
  filePath?: string;
  type?: string;
  rev?: number;
  hash?: string | null;
  updatedAt: number;
  sizeBytes?: number;
}

export interface CachedWorkspaceTree {
  workspace: unknown;
  tree: unknown[];
  updatedAt: number;
}

const STORE_NAME = OFFLINE_DB_STORES.SYNCED_DOC_CACHE;
const TREE_STORAGE_PREFIX = EDITOR_STORAGE_KEYS.WORKSPACE_TREE_CACHE_PREFIX;

/**
 * Persists clean Server-synced document copies and workspace tree manifests for fast
 * reload hydration and offline read access, bounded by LRU count and byte caps.
 */
export class SyncedDocCacheStore {
  private readonly docMemoryCache = new Map<string, SyncedDocCacheEntry>();
  private readonly treeMemoryCache = new Map<string, CachedWorkspaceTree>();

  constructor(
    private readonly connection: OfflineDbConnection,
    private readonly onQuotaExceeded?: () => Promise<void>,
  ) {}

  private setDocMemoryBounded(docId: string, entry: SyncedDocCacheEntry): void {
    if (
      this.docMemoryCache.size >= EDITOR_LIMITS.MAX_MEMORY_SYNCED_DOC_CACHE &&
      !this.docMemoryCache.has(docId)
    ) {
      const oldestKey = this.docMemoryCache.keys().next().value;
      if (oldestKey) this.docMemoryCache.delete(oldestKey);
    }
    this.docMemoryCache.set(docId, entry);
  }

  private setTreeMemoryBounded(targetId: string, entry: CachedWorkspaceTree): void {
    if (
      this.treeMemoryCache.size >= EDITOR_LIMITS.MAX_MEMORY_UNSYNCED_EDITS &&
      !this.treeMemoryCache.has(targetId)
    ) {
      const oldestKey = this.treeMemoryCache.keys().next().value;
      if (oldestKey) this.treeMemoryCache.delete(oldestKey);
    }
    this.treeMemoryCache.set(targetId, entry);
  }

  private evictOldestWorkspaceTreeLocalStorageEntry(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(TREE_STORAGE_PREFIX)) continue;
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

  public async put(entry: SyncedDocCacheEntry): Promise<void> {
    if (!entry?.id) return;
    const enriched: SyncedDocCacheEntry = {
      ...entry,
      sizeBytes: entry.sizeBytes ?? entry.content.length,
    };

    const db = await this.connection.getDatabase();
    if (db) {
      const writeToIdb = () =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(enriched);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });

      try {
        await writeToIdb();
      } catch (err) {
        if (isQuotaExceededError(err)) {
          await this.onQuotaExceeded?.();
          await writeToIdb().catch(() => {});
        }
      }
      this.docMemoryCache.delete(enriched.id);
      await this.evictOverflow();
      return;
    }

    this.setDocMemoryBounded(enriched.id, enriched);
  }

  public async putMany(entries: SyncedDocCacheEntry[]): Promise<void> {
    if (!Array.isArray(entries) || entries.length === 0) return;

    const enrichedList = entries
      .filter((e): e is SyncedDocCacheEntry => Boolean(e?.id))
      .map((e) => ({
        ...e,
        sizeBytes: e.sizeBytes ?? e.content.length,
      }));
    if (enrichedList.length === 0) return;

    const db = await this.connection.getDatabase();
    if (db) {
      const writeToIdb = () =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          for (const entry of enrichedList) {
            store.put(entry);
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });

      try {
        await writeToIdb();
      } catch (err) {
        if (isQuotaExceededError(err)) {
          await this.onQuotaExceeded?.();
          await writeToIdb().catch(() => {});
        }
      }
      for (const entry of enrichedList) {
        this.docMemoryCache.delete(entry.id);
      }
      await this.evictOverflow();
      return;
    }

    for (const entry of enrichedList) {
      this.setDocMemoryBounded(entry.id, entry);
    }
  }

  public async get(docId: string): Promise<SyncedDocCacheEntry | null> {
    if (!docId) return null;

    const mem = this.docMemoryCache.get(docId);
    if (mem) return mem;

    try {
      const db = await this.connection.getDatabase();
      if (db) {
        return await new Promise<SyncedDocCacheEntry | null>((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const req = tx.objectStore(STORE_NAME).get(docId);
          req.onsuccess = () => resolve((req.result as SyncedDocCacheEntry) || null);
          req.onerror = () => resolve(null);
        });
      }
    } catch {
      // Ignore
    }

    return null;
  }

  public async getByScope(projectId: string): Promise<SyncedDocCacheEntry[]> {
    if (!projectId) return [];

    const docMap = new Map<string, SyncedDocCacheEntry>();
    for (const entry of this.docMemoryCache.values()) {
      if (entry.projectId === projectId) {
        docMap.set(entry.id, entry);
      }
    }

    try {
      const db = await this.connection.getDatabase();
      if (db) {
        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const index = tx.objectStore(STORE_NAME).index('projectId');
          const req = index.openCursor(IDBKeyRange.only(projectId));

          req.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
              const entry = cursor.value as SyncedDocCacheEntry;
              if (entry && !docMap.has(entry.id)) {
                docMap.set(entry.id, entry);
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

    return Array.from(docMap.values());
  }

  public async delete(docId: string): Promise<void> {
    if (!docId) return;
    this.docMemoryCache.delete(docId);

    try {
      const db = await this.connection.getDatabase();
      if (db) {
        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).delete(docId);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      }
    } catch {
      // Ignore
    }
  }

  public async renamePath(
    oldPath: string,
    newPath: string,
    docId?: string,
  ): Promise<void> {
    const cleanOld = oldPath.trim().replace(/^\/+/, '');
    const cleanNew = newPath.trim().replace(/^\/+/, '');
    if (!cleanNew) return;

    for (const [key, entry] of this.docMemoryCache.entries()) {
      const entryPath = (entry.filePath || entry.title || '').replace(/^\/+/, '');
      if (key === docId || (cleanOld && entryPath === cleanOld)) {
        this.docMemoryCache.set(key, {
          ...entry,
          title: cleanNew,
          filePath: cleanNew,
          updatedAt: Date.now(),
        });
      }
    }

    const db = await this.connection.getDatabase();
    if (db && docId) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(docId);
          req.onsuccess = () => {
            const entry = req.result as SyncedDocCacheEntry | undefined;
            if (entry) {
              store.put({
                ...entry,
                title: cleanNew,
                filePath: cleanNew,
                updatedAt: Date.now(),
              });
            }
          };
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  }

  public async saveWorkspaceTree(
    targetIds: string[],
    payload: { workspace: unknown; tree: unknown[] },
  ): Promise<void> {
    if (!Array.isArray(targetIds) || targetIds.length === 0 || !payload) return;
    const uniqueTargets = Array.from(
      new Set(targetIds.map((id) => id?.trim()).filter((id): id is string => Boolean(id))),
    );
    if (uniqueTargets.length === 0) return;

    const entry: CachedWorkspaceTree = {
      workspace: payload.workspace,
      tree: Array.isArray(payload.tree) ? payload.tree : [],
      updatedAt: Date.now(),
    };

    for (const targetId of uniqueTargets) {
      this.setTreeMemoryBounded(targetId, entry);
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
        if (localStorage.key(i)?.startsWith(TREE_STORAGE_PREFIX)) {
          existingTreeKeys++;
        }
      }

      for (const targetId of uniqueTargets) {
        const storageKey = `${TREE_STORAGE_PREFIX}${targetId}`;
        if (!localStorage.getItem(storageKey)) {
          while (existingTreeKeys >= EDITOR_LIMITS.MAX_WORKSPACE_TREE_CACHE_ENTRIES) {
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

  public async getWorkspaceTree(targetId: string): Promise<CachedWorkspaceTree | null> {
    if (!targetId) return null;

    const mem = this.treeMemoryCache.get(targetId);
    if (mem) return mem;

    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(`${TREE_STORAGE_PREFIX}${targetId}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedWorkspaceTree;
      if (parsed && typeof parsed === 'object' && parsed.workspace && Array.isArray(parsed.tree)) {
        this.setTreeMemoryBounded(targetId, parsed);
        return parsed;
      }
    } catch {
      // Ignore corrupt JSON or storage errors
    }
    return null;
  }

  /**
   * Evicts oldest cached clean documents exceeding count or byte limits.
   */
  public async evictOverflow(options?: { aggressive?: boolean }): Promise<number> {
    const policy = this.connection.getQuotaPolicy();
    const targetCount = options?.aggressive
      ? Math.max(0, Math.floor(policy.maxSyncedDocCacheCount * 0.5))
      : policy.maxSyncedDocCacheCount;
    const targetBytes = options?.aggressive
      ? Math.max(0, Math.floor(policy.maxSyncedDocCacheBytes * 0.5))
      : policy.maxSyncedDocCacheBytes;

    let evicted = 0;
    const db = await this.connection.getDatabase();

    if (db) {
      try {
        const entries = await new Promise<SyncedDocCacheEntry[]>((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const req = tx.objectStore(STORE_NAME).getAll();
          req.onsuccess = () => resolve((req.result as SyncedDocCacheEntry[]) || []);
          req.onerror = () => resolve([]);
        });
        entries.sort((a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0));
        let totalBytes = entries.reduce(
          (sum, f) => sum + (f.sizeBytes ?? f.content?.length ?? 0),
          0,
        );
        let remaining = entries.length;
        const evictIds: string[] = [];
        for (const f of entries) {
          if (remaining <= targetCount && totalBytes <= targetBytes) {
            break;
          }
          evictIds.push(f.id);
          totalBytes -= f.sizeBytes ?? f.content?.length ?? 0;
          remaining -= 1;
        }
        if (evictIds.length > 0) {
          await new Promise<void>((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            for (const id of evictIds) {
              store.delete(id);
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          });
          evicted = evictIds.length;
        }
      } catch {
        // Ignore IDB eviction errors
      }
      return evicted;
    }

    const memEntries = Array.from(this.docMemoryCache.values()).sort(
      (a, b) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0),
    );
    let totalMemBytes = memEntries.reduce(
      (sum, f) => sum + (f.sizeBytes ?? f.content.length),
      0,
    );
    let remainingMem = memEntries.length;
    for (const f of memEntries) {
      if (remainingMem <= targetCount && totalMemBytes <= targetBytes) {
        break;
      }
      this.docMemoryCache.delete(f.id);
      totalMemBytes -= f.sizeBytes ?? f.content.length;
      remainingMem -= 1;
      evicted += 1;
    }
    return evicted;
  }

  public clearMemory(): void {
    this.docMemoryCache.clear();
    this.treeMemoryCache.clear();
    if (process.env.NODE_ENV === 'test' && typeof window !== 'undefined') {
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key?.startsWith(TREE_STORAGE_PREFIX)) {
            localStorage.removeItem(key);
          }
        }
      } catch {
        // Ignore
      }
    }
  }
}
