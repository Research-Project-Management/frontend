/**
 * pending-outbox.store.ts
 *
 * Persistent FIFO offline mutation queue (`pending_outbox`) with write coalescing
 * per document so queued edits replay sequentially when connectivity returns while
 * preserving the baseline `expectedRev` for OCC conflict checks.
 */

import {
  OFFLINE_DB_STORES,
  type OfflineDbConnection,
} from './offline-db.connection';

export interface OutboxMutation {
  id?: string;
  fileId: string;
  projectId?: string;
  spaceId?: string;
  pageId?: string;
  type: 'update_content' | 'create_file' | 'delete_file';
  payload: { content?: string; expectedRev?: number; [key: string]: unknown };
  status?: 'pending' | 'processing' | 'failed' | 'completed';
  retryCount?: number;
  error?: string;
  createdAt?: number;
  sizeBytes?: number;
}

const STORE_NAME = OFFLINE_DB_STORES.PENDING_OUTBOX;

function buildCoalescedContentMutation(
  existing: OutboxMutation,
  incoming: Omit<OutboxMutation, 'id' | 'createdAt'> & { id?: string },
): OutboxMutation {
  const baselineExpectedRev =
    existing.payload.expectedRev ?? incoming.payload.expectedRev;
  const mergedPayload = {
    ...existing.payload,
    ...incoming.payload,
    ...(baselineExpectedRev !== undefined
      ? { expectedRev: baselineExpectedRev }
      : {}),
  };
  return {
    ...existing,
    payload: mergedPayload,
    status: 'pending',
    sizeBytes: JSON.stringify(mergedPayload).length,
  };
}

/**
 * Manages the durable FIFO offline mutation outbox across IndexedDB and an
 * in-memory fallback (used in test/SSR contexts without IndexedDB).
 */
export class PendingOutboxStore {
  private readonly memoryQueue: OutboxMutation[] = [];

  constructor(private readonly connection: OfflineDbConnection) {}

  private async getAllIdbMutations(db: IDBDatabase): Promise<OutboxMutation[]> {
    return await new Promise<OutboxMutation[]>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const list = ((req.result as OutboxMutation[]) || []).slice();
        list.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  }

  public async enqueue(
    mutation: Omit<OutboxMutation, 'id' | 'createdAt'> & { id?: string },
  ): Promise<OutboxMutation> {
    const sizeBytes = mutation.sizeBytes ?? JSON.stringify(mutation.payload ?? {}).length;
    const db = await this.connection.getDatabase();

    if (db) {
      if (mutation.type === 'update_content') {
        const existing = await new Promise<OutboxMutation | null>((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const index = tx.objectStore(STORE_NAME).index('fileId');
          const req = index.getAll(IDBKeyRange.only(mutation.fileId));
          req.onsuccess = () => {
            const matches = (req.result as OutboxMutation[]) || [];
            const target = matches.find(
              (m) => m.type === 'update_content' && (m.status === 'pending' || !m.status),
            );
            resolve(target || null);
          };
          req.onerror = () => resolve(null);
        });

        if (existing) {
          const updated = buildCoalescedContentMutation(existing, mutation);
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(updated);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          });
          return updated;
        }
      }

      const item: OutboxMutation = {
        ...mutation,
        id: mutation.id || `mut-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        status: mutation.status || 'pending',
        retryCount: mutation.retryCount || 0,
        createdAt: Date.now(),
        sizeBytes,
      };
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return item;
    }

    if (mutation.type === 'update_content') {
      const existingIdx = this.memoryQueue.findIndex(
        (m) =>
          m.fileId === mutation.fileId &&
          m.type === 'update_content' &&
          (m.status === 'pending' || !m.status),
      );
      if (existingIdx !== -1) {
        const updated = buildCoalescedContentMutation(this.memoryQueue[existingIdx], mutation);
        this.memoryQueue[existingIdx] = updated;
        return updated;
      }
    }

    const item: OutboxMutation = {
      ...mutation,
      id: mutation.id || `mut-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      status: mutation.status || 'pending',
      retryCount: mutation.retryCount || 0,
      createdAt: Date.now(),
      sizeBytes,
    };
    this.memoryQueue.push(item);
    return item;
  }

  public async getPending(): Promise<OutboxMutation[]> {
    const db = await this.connection.getDatabase();
    if (db) {
      const all = await this.getAllIdbMutations(db);
      return all.filter((m) => m.status === 'pending' || m.status === 'failed' || !m.status);
    }
    return this.memoryQueue.filter(
      (m) => m.status === 'pending' || m.status === 'failed' || !m.status,
    );
  }

  public async updateStatus(
    id: string,
    status: 'pending' | 'processing' | 'failed' | 'completed',
    error?: string,
  ): Promise<void> {
    const db = await this.connection.getDatabase();
    if (db) {
      const existing = await new Promise<OutboxMutation | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = () => resolve((req.result as OutboxMutation) || null);
        req.onerror = () => resolve(null);
      });
      if (!existing) return;
      const updated: OutboxMutation = {
        ...existing,
        status,
        error: error !== undefined ? error : existing.error,
        retryCount:
          status === 'failed' ? (existing.retryCount || 0) + 1 : existing.retryCount || 0,
      };
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(updated);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
      return;
    }

    const item = this.memoryQueue.find((m) => m.id === id);
    if (!item) return;
    item.status = status;
    if (error !== undefined) {
      item.error = error;
    }
    if (status === 'failed') {
      item.retryCount = (item.retryCount || 0) + 1;
    }
  }

  public async remove(id: string): Promise<void> {
    const db = await this.connection.getDatabase();
    if (db) {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
      return;
    }

    const idx = this.memoryQueue.findIndex((m) => m.id === id);
    if (idx !== -1) {
      this.memoryQueue.splice(idx, 1);
    }
  }

  public async removeByDocId(fileId: string): Promise<void> {
    if (!fileId) return;
    for (let i = this.memoryQueue.length - 1; i >= 0; i--) {
      if (this.memoryQueue[i].fileId === fileId) {
        this.memoryQueue.splice(i, 1);
      }
    }
    const db = await this.connection.getDatabase();
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const index = store.index('fileId');
          const req = index.openCursor(IDBKeyRange.only(fileId));
          req.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
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

  public async clearAll(): Promise<void> {
    const db = await this.connection.getDatabase();
    if (db) {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
      return;
    }
    this.memoryQueue.length = 0;
  }

  public async pruneCompletedAndExhausted(options?: {
    aggressive?: boolean;
  }): Promise<number> {
    const policy = this.connection.getQuotaPolicy();
    const targetBytes = options?.aggressive
      ? Math.max(0, Math.floor(policy.maxPendingOutboxBytes * 0.5))
      : policy.maxPendingOutboxBytes;

    let pruned = 0;
    const db = await this.connection.getDatabase();

    if (db) {
      try {
        const mutations = await this.getAllIdbMutations(db);
        const removeIds: string[] = [];
        const survivors: OutboxMutation[] = [];
        for (const m of mutations) {
          if (m.status === 'completed' && m.id) {
            removeIds.push(m.id);
          } else {
            survivors.push(m);
          }
        }
        let totalBytes = survivors.reduce(
          (sum, m) => sum + (m.sizeBytes ?? JSON.stringify(m.payload ?? {}).length),
          0,
        );
        for (const m of survivors) {
          if (totalBytes <= targetBytes) break;
          if (m.status === 'failed' && (m.retryCount ?? 0) >= 3 && m.id) {
            removeIds.push(m.id);
            totalBytes -= m.sizeBytes ?? JSON.stringify(m.payload ?? {}).length;
          }
        }
        if (removeIds.length > 0) {
          await new Promise<void>((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            for (const id of removeIds) {
              store.delete(id);
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          });
          pruned = removeIds.length;
        }
      } catch {
        // Ignore IDB prune error
      }
      return pruned;
    }

    for (let i = this.memoryQueue.length - 1; i >= 0; i--) {
      if (this.memoryQueue[i].status === 'completed') {
        this.memoryQueue.splice(i, 1);
        pruned += 1;
      }
    }
    this.memoryQueue.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
    let totalMemBytes = this.memoryQueue.reduce(
      (sum, m) => sum + (m.sizeBytes ?? JSON.stringify(m.payload ?? {}).length),
      0,
    );
    for (let i = 0; i < this.memoryQueue.length && totalMemBytes > targetBytes; ) {
      const m = this.memoryQueue[i];
      if (m.status === 'failed' && (m.retryCount ?? 0) >= 3) {
        totalMemBytes -= m.sizeBytes ?? JSON.stringify(m.payload ?? {}).length;
        this.memoryQueue.splice(i, 1);
        pruned += 1;
      } else {
        i += 1;
      }
    }
    return pruned;
  }

  public clearMemory(): void {
    this.memoryQueue.length = 0;
  }
}
