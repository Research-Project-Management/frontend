/**
 * offline-quota.governor.ts
 *
 * Coordinates disk quota enforcement and memory resets across the separated offline stores:
 * `UnsyncedEditsStore`, `SyncedDocCacheStore`, and `PendingOutboxStore`.
 */

import { OfflineDbConnection } from './offline-db.connection';
import { UnsyncedEditsStore } from './unsynced-edits.store';
import { SyncedDocCacheStore } from './synced-doc-cache.store';
import { PendingOutboxStore } from './pending-outbox.store';

export interface OfflineQuotaReport {
  prunedUnsyncedEdits: number;
  evictedCachedDocs: number;
  prunedOutboxMutations: number;
}

export interface EditorOfflineStorageBundle {
  connection: OfflineDbConnection;
  unsyncedEdits: UnsyncedEditsStore;
  syncedDocCache: SyncedDocCacheStore;
  pendingOutbox: PendingOutboxStore;
  quotaGovernor: OfflineQuotaGovernor;
}

/**
 * Applies adaptive quota policies across all three offline stores in one pass.
 */
export class OfflineQuotaGovernor {
  constructor(
    private readonly unsyncedEdits: UnsyncedEditsStore,
    private readonly syncedDocCache: SyncedDocCacheStore,
    private readonly pendingOutbox: PendingOutboxStore,
  ) {}

  public async enforceDiskQuota(options?: {
    aggressive?: boolean;
    now?: number;
  }): Promise<OfflineQuotaReport> {
    const [prunedUnsyncedEdits, evictedCachedDocs, prunedOutboxMutations] =
      await Promise.all([
        this.unsyncedEdits.pruneExpired(options?.now),
        this.syncedDocCache.evictOverflow({ aggressive: options?.aggressive }),
        this.pendingOutbox.pruneCompletedAndExhausted({
          aggressive: options?.aggressive,
        }),
      ]);

    return {
      prunedUnsyncedEdits,
      evictedCachedDocs,
      prunedOutboxMutations,
    };
  }

  public clearAllMemory(): void {
    this.unsyncedEdits.clearMemory();
    this.syncedDocCache.clearMemory();
    this.pendingOutbox.clearMemory();
  }
}

/**
 * Factory creating a self-contained set of offline storage stores sharing one
 * connection and quota governor (ideal for isolated unit tests).
 */
export function createEditorOfflineStorage(): EditorOfflineStorageBundle {
  const connection = new OfflineDbConnection();
  let quotaGovernor!: OfflineQuotaGovernor;
  const onQuotaExceeded = () =>
    quotaGovernor.enforceDiskQuota({ aggressive: true }).then(() => undefined);

  const unsyncedEdits = new UnsyncedEditsStore(connection, onQuotaExceeded);
  const syncedDocCache = new SyncedDocCacheStore(connection, onQuotaExceeded);
  const pendingOutbox = new PendingOutboxStore(connection);
  quotaGovernor = new OfflineQuotaGovernor(unsyncedEdits, syncedDocCache, pendingOutbox);

  if (connection.isIndexedDbAvailable) {
    void (async () => {
      await connection.estimateBrowserQuota();
      const db = await connection.getDatabase();
      if (db) {
        const timer = setTimeout(() => {
          void quotaGovernor.enforceDiskQuota();
        }, 2500);
        if (typeof timer === 'object' && typeof (timer as NodeJS.Timeout).unref === 'function') {
          (timer as NodeJS.Timeout).unref();
        }
      }
    })();
  }

  return {
    connection,
    unsyncedEdits,
    syncedDocCache,
    pendingOutbox,
    quotaGovernor,
  };
}

const defaultStorage = createEditorOfflineStorage();

export const offlineDbConnection = defaultStorage.connection;
export const unsyncedEditsStore = defaultStorage.unsyncedEdits;
export const syncedDocCacheStore = defaultStorage.syncedDocCache;
export const pendingOutboxStore = defaultStorage.pendingOutbox;
export const offlineQuotaGovernor = defaultStorage.quotaGovernor;

export function clearAllOfflineMemory(): void {
  offlineQuotaGovernor.clearAllMemory();
}
