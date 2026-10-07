/**
 * yjs-persistence-adapter.ts
 *
 * Local-First IndexedDB Persistence Adapter for Yjs (IO / Adapters Layer - Block 3).
 *
 * Conforms to ADR-0002 & local-first offline resilience:
 * - Persists binary Yjs document state updates into native browser IndexedDB.
 * - On document load: hydrates Y.Doc from IndexedDB in O(1) batch transaction.
 * - On keystroke / remote sync: debounces state writes (250ms) to ensure 60fps typing.
 * - Survives browser crashes, tab reloads, and offline work.
 */

import * as Y from 'yjs';

const DB_NAME = 'flux_yjs_store_v1';
const STORE_NAME = 'documents';
const DB_VERSION = 1;

export class YjsPersistenceAdapter {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private syncDebounceMap = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.initDB();
    }
  }

  private initDB(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'docName' });
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          console.warn('[YjsPersistence] IndexedDB open error');
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  /**
   * Hydrates Y.Doc state from IndexedDB.
   */
  public async loadDocument(docName: string, ydoc: Y.Doc): Promise<boolean> {
    const db = await this.initDB();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(docName);

        req.onsuccess = () => {
          if (req.result && req.result.state) {
            const uint8Array = new Uint8Array(req.result.state);
            Y.applyUpdate(ydoc, uint8Array);
            resolve(true);
          } else {
            resolve(false);
          }
        };

        req.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * Binds Y.Doc update events to debounced IndexedDB persistence.
   */
  public bind(docName: string, ydoc: Y.Doc): () => void {
    const handleUpdate = () => {
      const existing = this.syncDebounceMap.get(docName);
      if (existing) {
        clearTimeout(existing);
      }

      const timer = setTimeout(() => {
        void this.saveDocument(docName, ydoc);
        this.syncDebounceMap.delete(docName);
      }, 250);

      this.syncDebounceMap.set(docName, timer);
    };

    ydoc.on('update', handleUpdate);

    return () => {
      ydoc.off('update', handleUpdate);
      const existing = this.syncDebounceMap.get(docName);
      if (existing) {
        clearTimeout(existing);
        this.syncDebounceMap.delete(docName);
      }
    };
  }

  /**
   * Flushes current Y.Doc binary state snapshot to IndexedDB.
   */
  public async saveDocument(docName: string, ydoc: Y.Doc): Promise<void> {
    const db = await this.initDB();
    if (!db) return;

    try {
      const stateVector = Y.encodeStateAsUpdate(ydoc);
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      store.put({
        docName,
        state: stateVector.buffer,
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.warn(`[YjsPersistence] Error saving document "${docName}":`, err);
    }
  }
}

export const yjsPersistence = new YjsPersistenceAdapter();
