/**
 * offline-db.connection.ts
 *
 * Shared IndexedDB connection (`flux_editor_offline_v1`), store schema definitions,
 * and adaptive browser storage quota calculation for the editor's offline stores.
 */

import {
  EDITOR_LIMITS,
  EDITOR_STORAGE_KEYS,
} from '@/features/editor/domain/constants/editor.constants';

export const OFFLINE_DB_STORES = {
  UNSYNCED_EDITS: 'unsynced_edits',
  SYNCED_DOC_CACHE: 'synced_doc_cache',
  PENDING_OUTBOX: 'pending_outbox',
} as const;

const OFFLINE_DB_VERSION = 1;

export interface EditorAdaptiveQuotaPolicy {
  maxTotalDiskBytes: number;
  maxUnsyncedEditsBytes: number;
  maxSyncedDocCacheBytes: number;
  maxPendingOutboxBytes: number;
  maxSyncedDocCacheCount: number;
  originQuotaBytes?: number;
}

/**
 * Computes Editor IndexedDB disk quota dynamically from `navigator.storage.estimate()`,
 * allocating 8% of available origin quota clamped to [24 MB, 100 MB] so Reader (<= 300 MB)
 * and Editor (<= 100 MB) coexist safely under Firefox's 2 GB eTLD+1 limit.
 */
export function calculateAdaptiveEditorQuota(
  originQuotaBytes?: number,
  originUsageBytes?: number,
): EditorAdaptiveQuotaPolicy {
  let maxTotalDiskBytes: number = EDITOR_LIMITS.MAX_EDITOR_DISK_CEILING_BYTES;

  if (
    typeof originQuotaBytes === 'number' &&
    Number.isFinite(originQuotaBytes) &&
    originQuotaBytes > 0
  ) {
    const usedBytes =
      typeof originUsageBytes === 'number' &&
      Number.isFinite(originUsageBytes) &&
      originUsageBytes > 0
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
    maxUnsyncedEditsBytes: Math.floor(maxTotalDiskBytes * 0.25),
    maxSyncedDocCacheBytes: Math.floor(maxTotalDiskBytes * 0.6),
    maxPendingOutboxBytes: Math.floor(maxTotalDiskBytes * 0.15),
    maxSyncedDocCacheCount: EDITOR_LIMITS.MAX_SYNCED_DOC_CACHE_COUNT,
    originQuotaBytes,
  };
}

/**
 * Returns true when a storage write failure was caused by exceeding browser quota.
 */
export function isQuotaExceededError(err: unknown): boolean {
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

/**
 * Manages the lazy IndexedDB connection, schema upgrades, legacy outbox migration,
 * and shared adaptive quota policy for all editor offline stores.
 */
export class OfflineDbConnection {
  public readonly isIndexedDbAvailable: boolean;
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private legacyMigrationDone = false;
  private quotaPolicy: EditorAdaptiveQuotaPolicy = calculateAdaptiveEditorQuota();

  constructor() {
    this.isIndexedDbAvailable =
      typeof window !== 'undefined' &&
      'indexedDB' in window &&
      process.env.NODE_ENV !== 'test';
  }

  public getQuotaPolicy(): EditorAdaptiveQuotaPolicy {
    return { ...this.quotaPolicy };
  }

  public setQuotaPolicy(partial: Partial<EditorAdaptiveQuotaPolicy>): void {
    this.quotaPolicy = {
      ...this.quotaPolicy,
      ...partial,
    };
  }

  public async estimateBrowserQuota(): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        this.quotaPolicy = calculateAdaptiveEditorQuota(est.quota, est.usage);
      }
    } catch {
      // Retain default ceiling when storage estimate is unavailable
    }
  }

  /**
   * Opens (or reuses) the editor IndexedDB database and runs one-time legacy outbox migration.
   */
  public async getDatabase(): Promise<IDBDatabase | null> {
    const db = await this.openDatabase();
    if (db && !this.legacyMigrationDone) {
      this.legacyMigrationDone = true;
      await this.migrateLegacyLocalStorageOutbox(db);
    }
    return db;
  }

  private openDatabase(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;

    if (
      typeof window === 'undefined' ||
      !this.isIndexedDbAvailable ||
      process.env.NODE_ENV === 'test'
    ) {
      return Promise.resolve(null);
    }

    this.dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(
          EDITOR_STORAGE_KEYS.EDITOR_OFFLINE_DB,
          OFFLINE_DB_VERSION,
        );

        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;

          if (!db.objectStoreNames.contains(OFFLINE_DB_STORES.UNSYNCED_EDITS)) {
            const store = db.createObjectStore(OFFLINE_DB_STORES.UNSYNCED_EDITS, {
              keyPath: 'fileId',
            });
            store.createIndex('projectId', 'projectId', { unique: false });
            store.createIndex('savedAt', 'savedAt', { unique: false });
          }

          if (!db.objectStoreNames.contains(OFFLINE_DB_STORES.SYNCED_DOC_CACHE)) {
            const cacheStore = db.createObjectStore(OFFLINE_DB_STORES.SYNCED_DOC_CACHE, {
              keyPath: 'id',
            });
            cacheStore.createIndex('projectId', 'projectId', { unique: false });
            cacheStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          }

          if (!db.objectStoreNames.contains(OFFLINE_DB_STORES.PENDING_OUTBOX)) {
            const outboxStore = db.createObjectStore(OFFLINE_DB_STORES.PENDING_OUTBOX, {
              keyPath: 'id',
            });
            outboxStore.createIndex('projectId', 'projectId', { unique: false });
            outboxStore.createIndex('fileId', 'fileId', { unique: false });
            outboxStore.createIndex('createdAt', 'createdAt', { unique: false });
            outboxStore.createIndex('status', 'status', { unique: false });
          }
        };

        req.onsuccess = () => {
          const db = req.result;
          db.onversionchange = () => {
            try {
              db.close();
            } catch {
              // Ignore close errors during version upgrade
            }
            this.dbPromise = null;
          };
          resolve(db);
        };

        req.onerror = () => {
          console.warn('[OfflineDbConnection] IndexedDB unavailable, falling back to memory');
          resolve(null);
        };

        req.onblocked = () => {
          console.warn('[OfflineDbConnection] IndexedDB open blocked');
          resolve(null);
        };
      } catch (err) {
        console.warn('[OfflineDbConnection] Failed to open IndexedDB:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  private async migrateLegacyLocalStorageOutbox(db: IDBDatabase): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(EDITOR_STORAGE_KEYS.LEGACY_OUTBOX_QUEUE);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Array<{
        id?: string;
        fileId?: string;
        createdAt?: number;
        sizeBytes?: number;
        payload?: Record<string, unknown>;
        [key: string]: unknown;
      }>;
      if (Array.isArray(parsed) && parsed.length > 0) {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(OFFLINE_DB_STORES.PENDING_OUTBOX, 'readwrite');
          const store = tx.objectStore(OFFLINE_DB_STORES.PENDING_OUTBOX);
          for (const item of parsed) {
            if (!item || !item.fileId) continue;
            const entry = {
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
      localStorage.removeItem(EDITOR_STORAGE_KEYS.LEGACY_OUTBOX_QUEUE);
    } catch {
      // Non-blocking migration error
    }
  }
}
