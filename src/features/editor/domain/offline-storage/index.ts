/**
 * offline-storage/index.ts
 *
 * Public seam for Editor offline persistence: separates uncommitted local edits
 * (`unsyncedEditsStore`), clean server-synced cache (`syncedDocCacheStore`),
 * and offline replay queue (`pendingOutboxStore`).
 */

export {
  calculateAdaptiveEditorQuota,
  type EditorAdaptiveQuotaPolicy,
} from './offline-db.connection';

export {
  UnsyncedEditsStore,
  type UnsyncedDocEdit,
} from './unsynced-edits.store';

export {
  SyncedDocCacheStore,
  type SyncedDocCacheEntry,
  type CachedWorkspaceTree,
} from './synced-doc-cache.store';

export {
  PendingOutboxStore,
  type OutboxMutation,
} from './pending-outbox.store';

export {
  OfflineQuotaGovernor,
  createEditorOfflineStorage,
  unsyncedEditsStore,
  syncedDocCacheStore,
  pendingOutboxStore,
  offlineQuotaGovernor,
  clearAllOfflineMemory,
  type OfflineQuotaReport,
  type EditorOfflineStorageBundle,
} from './offline-quota.governor';

import type { UnsyncedDocEdit } from './unsynced-edits.store';
import type { SyncedDocCacheEntry } from './synced-doc-cache.store';
import { unsyncedEditsStore, syncedDocCacheStore } from './offline-quota.governor';

/**
 * Seam connecting `LRUDocumentCache` to durable storage when documents spill out of RAM
 * or hydrate on cold open.
 */
export interface IDocumentSpillSink {
  saveUnsyncedEdit(
    fileId: string,
    content: string,
    projectId?: string,
    title?: string,
    expectedRev?: number,
  ): Promise<void>;
  getUnsyncedEdit(fileId: string): Promise<UnsyncedDocEdit | null>;
  clearUnsyncedEdit(fileId: string): Promise<void>;
  putSyncedDoc?(entry: SyncedDocCacheEntry): Promise<void>;
  getSyncedDoc?(docId: string): Promise<SyncedDocCacheEntry | null>;
  deleteSyncedDoc?(docId: string): Promise<void>;
}

export const defaultDocumentSpillSink: IDocumentSpillSink = {
  saveUnsyncedEdit(fileId, content, projectId, title, expectedRev) {
    return expectedRev !== undefined
      ? unsyncedEditsStore.save(fileId, content, projectId, title, expectedRev)
      : unsyncedEditsStore.save(fileId, content, projectId, title);
  },
  getUnsyncedEdit(fileId) {
    return unsyncedEditsStore.get(fileId);
  },
  clearUnsyncedEdit(fileId) {
    return unsyncedEditsStore.clear(fileId);
  },
  putSyncedDoc(entry) {
    return syncedDocCacheStore.put(entry);
  },
  getSyncedDoc(docId) {
    return syncedDocCacheStore.get(docId);
  },
  deleteSyncedDoc(docId) {
    return syncedDocCacheStore.delete(docId);
  },
};
