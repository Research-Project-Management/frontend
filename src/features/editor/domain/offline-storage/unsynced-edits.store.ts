/**
 * unsynced-edits.store.ts
 *
 * Dedicated storage for uncommitted local editor changes that have NOT yet been
 * acknowledged by the Server. Cleared immediately once Server persistence confirms
 * synchronization, never mixed with clean server cache entries.
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

export interface UnsyncedDocEdit {
  fileId: string;
  content: string;
  savedAt: number;
  projectId?: string;
  spaceId?: string;
  pageId?: string;
  expectedRev?: number;
  title?: string;
  sizeBytes?: number;
}

const STORE_NAME = OFFLINE_DB_STORES.UNSYNCED_EDITS;
const EMERGENCY_PREFIX = EDITOR_STORAGE_KEYS.EMERGENCY_UNSYNCED_EDIT_PREFIX;

/**
 * Stores uncommitted local edits across transient memory, synchronous `beforeunload`
 * localStorage (<= 512 KB), and durable IndexedDB (`unsynced_edits`).
 */
export class UnsyncedEditsStore {
  private readonly memoryCache = new Map<string, UnsyncedDocEdit>();

  constructor(
    private readonly connection: OfflineDbConnection,
    private readonly onQuotaExceeded?: () => Promise<void>,
  ) {}

  private buildRecord(
    fileId: string,
    content: string,
    projectId?: string,
    title?: string,
    expectedRev?: number,
  ): UnsyncedDocEdit {
    return {
      fileId,
      content,
      savedAt: Date.now(),
      projectId,
      title,
      ...(expectedRev !== undefined ? { expectedRev } : {}),
      sizeBytes: content.length,
    };
  }

  private setMemoryBounded(fileId: string, entry: UnsyncedDocEdit): void {
    if (
      this.memoryCache.size >= EDITOR_LIMITS.MAX_MEMORY_UNSYNCED_EDITS &&
      !this.memoryCache.has(fileId)
    ) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) this.memoryCache.delete(oldestKey);
    }
    this.memoryCache.set(fileId, entry);
  }

  private readEmergencyLocalStorage(fileId: string): UnsyncedDocEdit | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(`${EMERGENCY_PREFIX}${fileId}`);
      if (raw) {
        return JSON.parse(raw) as UnsyncedDocEdit;
      }
    } catch {
      // Ignore corrupt JSON or storage access errors
    }
    return null;
  }

  /**
   * Updates the transient 0ms in-memory unsynced buffer.
   */
  public saveMemory(
    fileId: string,
    content: string,
    projectId?: string,
    title?: string,
    expectedRev?: number,
  ): UnsyncedDocEdit {
    const entry = this.buildRecord(fileId, content, projectId, title, expectedRev);
    this.setMemoryBounded(fileId, entry);
    return entry;
  }

  /**
   * Synchronous emergency LocalStorage save strictly reserved for `window.beforeunload`
   * when the document fits under the 512 KB ceiling.
   */
  public saveEmergencyUnload(
    fileId: string,
    content: string,
    projectId?: string,
    title?: string,
    expectedRev?: number,
  ): boolean {
    if (
      typeof window === 'undefined' ||
      !fileId ||
      content.length > EDITOR_LIMITS.EMERGENCY_UNLOAD_MAX_BYTES
    ) {
      return false;
    }

    const entry = this.buildRecord(fileId, content, projectId, title, expectedRev);
    try {
      localStorage.setItem(`${EMERGENCY_PREFIX}${fileId}`, JSON.stringify(entry));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Persists an unsynced local edit asynchronously to IndexedDB (or memory fallback).
   */
  public async save(
    fileId: string,
    content: string,
    projectId?: string,
    title?: string,
    expectedRev?: number,
  ): Promise<void> {
    if (!fileId || typeof window === 'undefined') return;

    const entry = this.buildRecord(fileId, content, projectId, title, expectedRev);
    const db = await this.connection.getDatabase();

    if (db) {
      const writeToIdb = () =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(entry);
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

      this.memoryCache.delete(fileId);
      try {
        localStorage.removeItem(`${EMERGENCY_PREFIX}${fileId}`);
      } catch {
        // Ignore storage errors
      }
      return;
    }

    this.setMemoryBounded(fileId, entry);
  }

  /**
   * Synchronous quick lookup across Memory and Emergency LocalStorage.
   */
  public getSync(fileId: string): UnsyncedDocEdit | null {
    if (!fileId || typeof window === 'undefined') return null;

    const mem = this.memoryCache.get(fileId) ?? null;
    const ls = this.readEmergencyLocalStorage(fileId);

    if (mem && ls) {
      return mem.savedAt >= ls.savedAt ? mem : ls;
    }
    if (mem) return mem;
    if (ls) {
      if (!this.connection.isIndexedDbAvailable) {
        this.setMemoryBounded(fileId, ls);
      }
      return ls;
    }

    return null;
  }

  /**
   * Asynchronous lookup returning the newest unsynced edit across Memory, Emergency LocalStorage, and IndexedDB.
   */
  public async get(fileId: string): Promise<UnsyncedDocEdit | null> {
    if (!fileId || typeof window === 'undefined') return null;

    const candidates: UnsyncedDocEdit[] = [];
    const mem = this.memoryCache.get(fileId);
    if (mem) candidates.push(mem);

    const ls = this.readEmergencyLocalStorage(fileId);
    if (ls) candidates.push(ls);

    try {
      const db = await this.connection.getDatabase();
      if (db) {
        const stored = await new Promise<UnsyncedDocEdit | null>((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const req = tx.objectStore(STORE_NAME).get(fileId);
          req.onsuccess = () => resolve((req.result as UnsyncedDocEdit) || null);
          req.onerror = () => resolve(null);
        });
        if (stored) {
          candidates.push(stored);
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
   * Deletes the unsynced edit record across all local tiers once Server sync succeeds.
   */
  public async clear(fileId: string): Promise<void> {
    if (!fileId || typeof window === 'undefined') return;

    this.memoryCache.delete(fileId);

    try {
      localStorage.removeItem(`${EMERGENCY_PREFIX}${fileId}`);
    } catch {
      // Ignore
    }

    try {
      const db = await this.connection.getDatabase();
      if (db) {
        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).delete(fileId);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Deletes all unsynced edits scoped to a project/page/space ID.
   */
  public async clearByScope(projectId: string): Promise<void> {
    if (!projectId || typeof window === 'undefined') return;

    for (const [fileId, entry] of this.memoryCache.entries()) {
      if (entry.projectId === projectId) {
        this.memoryCache.delete(fileId);
      }
    }

    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith(EMERGENCY_PREFIX)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw) as UnsyncedDocEdit;
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
      const db = await this.connection.getDatabase();
      if (db) {
        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const index = tx.objectStore(STORE_NAME).index('projectId');
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
   * Retrieves all unsynced local edits belonging to `projectId` sorted newest first.
   */
  public async getAllByScope(projectId: string): Promise<UnsyncedDocEdit[]> {
    if (!projectId || typeof window === 'undefined') return [];

    const byFileId = new Map<string, UnsyncedDocEdit>();
    const consider = (item: UnsyncedDocEdit | null | undefined) => {
      if (!item || item.projectId !== projectId) return;
      const existing = byFileId.get(item.fileId);
      if (!existing || item.savedAt > existing.savedAt) {
        byFileId.set(item.fileId, item);
      }
    };

    for (const item of this.memoryCache.values()) {
      consider(item);
    }

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(EMERGENCY_PREFIX)) {
          const raw = localStorage.getItem(key);
          if (raw) {
            consider(JSON.parse(raw) as UnsyncedDocEdit);
          }
        }
      }
    } catch {
      // Ignore
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
              consider(cursor.value as UnsyncedDocEdit);
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

  public checkRecoverySync(
    fileId: string,
    serverContent: string,
  ): { hasRecoverableEdit: boolean; edit?: UnsyncedDocEdit } {
    const edit = this.getSync(fileId);
    if (!edit) return { hasRecoverableEdit: false };
    if (edit.content && edit.content !== serverContent) {
      return { hasRecoverableEdit: true, edit };
    }
    return { hasRecoverableEdit: false };
  }

  public async checkRecovery(
    fileId: string,
    serverContent: string,
  ): Promise<{ hasRecoverableEdit: boolean; edit?: UnsyncedDocEdit }> {
    const edit = await this.get(fileId);
    if (!edit) return { hasRecoverableEdit: false };
    if (edit.content && edit.content !== serverContent) {
      return { hasRecoverableEdit: true, edit };
    }
    return { hasRecoverableEdit: false };
  }

  public async renamePath(
    oldPath: string,
    newPath: string,
    fileId?: string,
  ): Promise<void> {
    const cleanOld = oldPath.trim().replace(/^\/+/, '');
    const cleanNew = newPath.trim().replace(/^\/+/, '');
    if (!cleanNew) return;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (key === fileId || (cleanOld && entry.title?.replace(/^\/+/, '') === cleanOld)) {
        this.memoryCache.set(key, { ...entry, title: cleanNew });
      }
    }

    const db = await this.connection.getDatabase();
    if (db && fileId) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(fileId);
          req.onsuccess = () => {
            const entry = req.result as UnsyncedDocEdit | undefined;
            if (entry) {
              store.put({ ...entry, title: cleanNew });
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

  /**
   * Prunes abandoned unsynced edits older than STALE_UNSYNCED_EDIT_TTL_MS (30 days).
   */
  public async pruneExpired(now: number = Date.now()): Promise<number> {
    let pruned = 0;
    const db = await this.connection.getDatabase();

    if (db) {
      try {
        const edits = await new Promise<UnsyncedDocEdit[]>((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const req = tx.objectStore(STORE_NAME).getAll();
          req.onsuccess = () => resolve((req.result as UnsyncedDocEdit[]) || []);
          req.onerror = () => resolve([]);
        });
        const expiredIds = edits
          .filter((e) => now - (e.savedAt || 0) > EDITOR_LIMITS.STALE_UNSYNCED_EDIT_TTL_MS)
          .map((e) => e.fileId);
        if (expiredIds.length > 0) {
          await new Promise<void>((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            for (const id of expiredIds) {
              store.delete(id);
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          });
          pruned = expiredIds.length;
        }
      } catch {
        // Ignore IDB prune error
      }
      return pruned;
    }

    for (const [fileId, edit] of Array.from(this.memoryCache.entries())) {
      if (now - (edit.savedAt || 0) > EDITOR_LIMITS.STALE_UNSYNCED_EDIT_TTL_MS) {
        this.memoryCache.delete(fileId);
        pruned += 1;
      }
    }
    return pruned;
  }

  public clearMemory(): void {
    this.memoryCache.clear();
  }
}
