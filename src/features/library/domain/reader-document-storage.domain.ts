/**
 * Tier 4 Client-Side Document Binary Storage (OPFS with IndexedDB Fallback).
 * Provides zero-network instant loading across tab switching, page reloads (F5),
 * and offline sessions for academic papers (PDFs).
 */

const STORAGE_DB_NAME = 'flux:library:doc_storage:v1';
const STORAGE_STORE_NAME = 'pdf_binaries';

/**
 * Empirical Benchmarks & W3C Browser Quota Survey Constants:
 * 1. Academic PDF Distribution (arXiv / IEEE / PubMed):
 *    - Median: 0.5 MB - 1.5 MB | Mean: ~3.0 MB | Heavy CV/ML P95: 5 MB - 10 MB.
 * 2. Browser Engine Per-Origin Quotas (W3C Storage Standard):
 *    - Chromium (Chrome/Edge): 60% of total disk space.
 *    - WebKit (Safari): 60% browser / 15% WebView (7-day ITP eviction unless persistent).
 *    - Gecko (Firefox Best-Effort Group Limit): ~2 GB cap per eTLD+1 (or 10% disk).
 *      Exceeding best-effort triggers ALL-OR-NOTHING origin wipe!
 * 3. Zotero Standard Baseline: 300 MB attachment tier (~100 papers at 3 MB mean).
 * 4. Multi-Subsystem Allocation: Reader binary cache is capped at 20% of the origin's
 *    available quota, clamped between a 64 MB mobile floor and a 300 MB safe ceiling
 *    (strictly <= 15% of Firefox's 2 GB group limit).
 */
export const ARXIV_MEAN_PAPER_BYTES = 3 * 1024 * 1024; // 3 MB empirical mean
export const MIN_READER_DISK_FLOOR_BYTES = 64 * 1024 * 1024; // 64 MB (~21 papers)
export const MAX_READER_DISK_CEILING_BYTES = 300 * 1024 * 1024; // 300 MB (~100 papers, Zotero tier)
export const READER_ORIGIN_QUOTA_SHARE = 0.2; // 20% of origin quota allocated to Reader PDFs

export interface AdaptiveQuotaPolicy {
  maxDiskBytes: number;
  maxCachedDocs: number;
  originQuotaBytes?: number;
}

/**
 * Computes the Reader's disk quota dynamically from `navigator.storage.estimate()`
 * rather than relying on a single static magic number.
 */
export function calculateAdaptiveReaderQuota(
  originQuotaBytes?: number,
  originUsageBytes?: number,
): AdaptiveQuotaPolicy {
  let maxDiskBytes = MAX_READER_DISK_CEILING_BYTES;

  if (
    typeof originQuotaBytes === 'number' &&
    Number.isFinite(originQuotaBytes) &&
    originQuotaBytes > 0
  ) {
    const usedBytes =
      typeof originUsageBytes === 'number' && Number.isFinite(originUsageBytes) && originUsageBytes > 0
        ? originUsageBytes
        : 0;
    const availableBytes = Math.max(0, originQuotaBytes - usedBytes);
    const proportionalShare = Math.floor(availableBytes * READER_ORIGIN_QUOTA_SHARE);
    maxDiskBytes = Math.max(
      MIN_READER_DISK_FLOOR_BYTES,
      Math.min(MAX_READER_DISK_CEILING_BYTES, proportionalShare),
    );
  }

  const maxCachedDocs = Math.max(
    20,
    Math.min(100, Math.floor(maxDiskBytes / ARXIV_MEAN_PAPER_BYTES)),
  );

  return {
    maxDiskBytes,
    maxCachedDocs,
    originQuotaBytes,
  };
}

/**
 * Extracts a stable user namespace from an authentication token (e.g. JWT `sub` / `userId`).
 * Unlike slicing the last 16 chars of a JWT signature (which changes on every token refresh),
 * extracting the user's immutable subject ID prevents false IndexedDB Cache Misses and
 * orphaned disk entries across sessions while strictly isolating multi-user shared devices.
 */
export function extractStableUserNamespace(token?: string | null): string {
  if (!token || typeof token !== 'string') return 'anon';
  const trimmed = token.trim();
  if (!trimmed) return 'anon';

  const parts = trimmed.split('.');
  if (parts.length === 3 && parts[1]) {
    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
      const jsonStr =
        typeof atob === 'function'
          ? atob(padded)
          : typeof Buffer !== 'undefined'
            ? Buffer.from(padded, 'base64').toString('utf-8')
            : '';
      if (jsonStr) {
        const payload = JSON.parse(jsonStr) as Record<string, unknown>;
        const rawUserId = payload.sub ?? payload.userId ?? payload.user_id ?? payload.id;
        if (
          (typeof rawUserId === 'string' || typeof rawUserId === 'number') &&
          String(rawUserId).trim().length > 0
        ) {
          return `usr_${String(rawUserId).trim()}`;
        }
      }
    } catch {
      // Fallback for non-standard JWT payload
    }
  }

  return `tok_${trimmed.slice(-16)}`;
}

/**
 * Checks whether an ArrayBuffer contains the ISO 32000-1 `%PDF-` magic header
 * within the first 1024 bytes.
 */
export function hasPdfMagicBytes(buffer: ArrayBuffer): boolean {
  if (!buffer || buffer.byteLength < 5) return false;
  const scanLength = Math.min(buffer.byteLength, 1024);
  const bytes = new Uint8Array(buffer, 0, scanLength);
  // '%PDF-' => [0x25, 0x50, 0x44, 0x46, 0x2D]
  for (let i = 0; i <= scanLength - 5; i++) {
    if (
      bytes[i] === 0x25 &&
      bytes[i + 1] === 0x50 &&
      bytes[i + 2] === 0x44 &&
      bytes[i + 3] === 0x46 &&
      bytes[i + 4] === 0x2d
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Pre-write validation gate to prevent poisoning persistent disk storage
 * with 0-byte files, captive portal HTML pages, or JSON error responses.
 */
export function isValidDocumentBinary(
  buffer: ArrayBuffer | null | undefined,
  mimeType = 'application/pdf',
): boolean {
  if (!buffer || buffer.byteLength <= 0) return false;

  if (mimeType.toLowerCase().includes('pdf')) {
    const sampleLength = Math.min(buffer.byteLength, 256);
    const sampleBytes = new Uint8Array(buffer, 0, sampleLength);
    let prefix = '';
    for (let i = 0; i < sampleBytes.length; i++) {
      prefix += String.fromCharCode(sampleBytes[i]);
    }
    const normalizedPrefix = prefix.trimStart().toLowerCase();
    if (
      normalizedPrefix.startsWith('<!doctype') ||
      normalizedPrefix.startsWith('<html') ||
      normalizedPrefix.startsWith('<head') ||
      normalizedPrefix.startsWith('<body') ||
      normalizedPrefix.startsWith('{"error"') ||
      normalizedPrefix.startsWith('{"message"') ||
      normalizedPrefix.startsWith('{"statuscode"')
    ) {
      return false;
    }
  }

  return true;
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

export interface StoredDocumentMeta {
  key: string;
  sizeBytes: number;
  lastAccessedAt: number;
  createdAt: number;
  mimeType: string;
}

export interface StorageStats {
  count: number;
  totalBytes: number;
  maxBytes: number;
  maxCachedDocs: number;
  quotaBytes?: number;
  usageBytes?: number;
}

class DocumentStorageService {
  private memoryFallback = new Map<string, { buffer: ArrayBuffer; meta: StoredDocumentMeta }>();
  private idbPromise: Promise<IDBDatabase | null> | null = null;
  private maxDiskBytes = MAX_READER_DISK_CEILING_BYTES;
  private maxCachedDocs = Math.floor(MAX_READER_DISK_CEILING_BYTES / ARXIV_MEAN_PAPER_BYTES);
  private isOpfsSupported = false;
  private opfsRootDir: FileSystemDirectoryHandle | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      void this.initStorageEngine();
    }
  }

  private async initStorageEngine(): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage) {
        if (typeof navigator.storage.persist === 'function') {
          void navigator.storage.persist().catch(() => false);
        }
        if (typeof navigator.storage.estimate === 'function') {
          const est = await navigator.storage.estimate();
          const policy = calculateAdaptiveReaderQuota(est.quota, est.usage);
          this.maxDiskBytes = policy.maxDiskBytes;
          this.maxCachedDocs = policy.maxCachedDocs;
        }
        if (typeof navigator.storage.getDirectory === 'function') {
          this.opfsRootDir = await navigator.storage.getDirectory();
          this.isOpfsSupported = Boolean(this.opfsRootDir);
        }
      }
    } catch {
      this.isOpfsSupported = false;
      this.opfsRootDir = null;
    }
  }

  private openIndexedDb(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
      return Promise.resolve(null);
    }
    if (this.idbPromise) return this.idbPromise;

    this.idbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(STORAGE_DB_NAME, 1);
        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORAGE_STORE_NAME)) {
            const store = db.createObjectStore(STORAGE_STORE_NAME, { keyPath: 'key' });
            store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });

    return this.idbPromise;
  }

  /**
   * Stores binary payload into persistent client storage (OPFS / IndexedDB / Memory).
   * Enforces pre-write integrity gate, QuotaExceededError emergency eviction,
   * and LRU quota bounds on total size and document count.
   */
  async saveDocumentBinary(
    key: string,
    data: Blob | ArrayBuffer,
    mimeType = 'application/pdf',
  ): Promise<void> {
    if (!key || typeof key !== 'string') return;
    const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
    if (!isValidDocumentBinary(buffer, mimeType)) {
      return;
    }

    const sizeBytes = buffer.byteLength;
    const now = Date.now();
    const meta: StoredDocumentMeta = {
      key,
      sizeBytes,
      lastAccessedAt: now,
      createdAt: now,
      mimeType,
    };

    // 1. Try OPFS (Tier 4A: Fast NVMe/SSD direct access)
    if (this.isOpfsSupported && this.opfsRootDir) {
      try {
        const safeName = encodeURIComponent(key);
        const fileHandle = await this.opfsRootDir.getFileHandle(safeName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(buffer);
        await writable.close();
        // Record metadata in IDB for fast index & quota management
        await this.saveMetaToIndexedDb(meta);
        await this.enforceQuota();
        return;
      } catch (opfsErr) {
        if (isQuotaExceededError(opfsErr)) {
          await this.evictOldestFraction(0.5);
        }
        // Fallback to IndexedDB
      }
    }

    // 2. Try IndexedDB (Tier 4B)
    const db = await this.openIndexedDb();
    if (db) {
      const writeToIdb = () =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORAGE_STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORAGE_STORE_NAME);
          store.put({ ...meta, buffer });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });

      try {
        await writeToIdb();
        await this.enforceQuota();
        return;
      } catch (idbErr) {
        if (isQuotaExceededError(idbErr)) {
          try {
            await this.evictOldestFraction(0.5);
            await writeToIdb();
            await this.enforceQuota();
            return;
          } catch {
            // Fall through to memory fallback
          }
        }
      }
    }

    // 3. Volatile In-Memory fallback (Node/JSDOM/SSR/Incognito Quota Full)
    this.memoryFallback.set(key, { buffer, meta });
    await this.enforceMemoryQuota();
  }

  /**
   * Retrieves binary document from storage. Returns null on Cache Miss.
   * Touches `lastAccessedAt` for LRU ordering on Hit.
   */
  async getDocumentBinary(key: string): Promise<Blob | null> {
    // 1. Try OPFS
    if (this.isOpfsSupported && this.opfsRootDir) {
      try {
        const safeName = encodeURIComponent(key);
        const fileHandle = await this.opfsRootDir.getFileHandle(safeName);
        const file = await fileHandle.getFile();
        const meta = await this.getMetaFromIndexedDb(key);
        void this.touchAccess(key);
        return new Blob([await file.arrayBuffer()], { type: meta?.mimeType || 'application/pdf' });
      } catch {
        // Continue to IDB
      }
    }

    // 2. Try IndexedDB
    const db = await this.openIndexedDb();
    if (db) {
      try {
        const record = await new Promise<{ buffer: ArrayBuffer; mimeType?: string } | null>((resolve) => {
          const tx = db.transaction(STORAGE_STORE_NAME, 'readonly');
          const req = tx.objectStore(STORAGE_STORE_NAME).get(key);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        });

        if (record && record.buffer) {
          void this.touchAccess(key);
          return new Blob([record.buffer], { type: record.mimeType || 'application/pdf' });
        }
      } catch {
        // Fallback to memory
      }
    }

    // 3. Try In-Memory Fallback
    const mem = this.memoryFallback.get(key);
    if (mem) {
      mem.meta.lastAccessedAt = Date.now();
      return new Blob([mem.buffer], { type: mem.meta.mimeType });
    }

    return null;
  }

  async has(key: string): Promise<boolean> {
    return this.hasDocumentBinary(key);
  }

  async hasDocumentBinary(key: string): Promise<boolean> {
    if (this.memoryFallback.has(key)) return true;
    if (this.isOpfsSupported && this.opfsRootDir) {
      try {
        const safeName = encodeURIComponent(key);
        await this.opfsRootDir.getFileHandle(safeName);
        return true;
      } catch {
        // Not in OPFS
      }
    }
    const db = await this.openIndexedDb();
    if (db) {
      return new Promise<boolean>((resolve) => {
        const tx = db.transaction(STORAGE_STORE_NAME, 'readonly');
        const req = tx.objectStore(STORAGE_STORE_NAME).count(IDBKeyRange.only(key));
        req.onsuccess = () => resolve(req.result > 0);
        req.onerror = () => resolve(false);
      });
    }
    return false;
  }

  async deleteDocumentBinary(key: string): Promise<boolean> {
    const memoryDeleted = this.memoryFallback.delete(key);
    let deleted = memoryDeleted;

    if (this.isOpfsSupported && this.opfsRootDir) {
      try {
        const safeName = encodeURIComponent(key);
        await this.opfsRootDir.removeEntry(safeName);
        deleted = true;
      } catch {
        // Ignore
      }
    }

    const db = await this.openIndexedDb();
    if (db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORAGE_STORE_NAME, 'readwrite');
          tx.objectStore(STORAGE_STORE_NAME).delete(key);
          tx.oncomplete = () => { deleted = true; resolve(); };
          tx.onerror = () => reject(tx.error);
        });
      } catch {
        // Ignore
      }
    }

    return deleted;
  }

  /**
   * Purges all cached binaries belonging to a specific user namespace prefix
   * (e.g. `usr_12345`) on logout or account switch, leaving other users' cache intact.
   */
  async clearUserScope(userNamespace: string): Promise<number> {
    if (!userNamespace || typeof userNamespace !== 'string') return 0;
    const prefix = userNamespace.endsWith(':') ? userNamespace : `${userNamespace}:`;
    let purgedCount = 0;

    for (const key of Array.from(this.memoryFallback.keys())) {
      if (key.startsWith(prefix)) {
        this.memoryFallback.delete(key);
        purgedCount += 1;
      }
    }

    const metas = await this.getAllMetas();
    for (const item of metas) {
      if (item.key.startsWith(prefix)) {
        const wasDeleted = await this.deleteDocumentBinary(item.key);
        if (wasDeleted) purgedCount += 1;
      }
    }

    return purgedCount;
  }

  /**
   * Completely clears all cached document binaries across OPFS, IndexedDB, and Memory.
   * Used for explicit "Clear Local Document Cache" user actions or shared-device security reset.
   */
  async clearAll(): Promise<void> {
    this.memoryFallback.clear();

    const metas = await this.getAllMetas();
    for (const item of metas) {
      await this.deleteDocumentBinary(item.key);
    }

    const db = await this.openIndexedDb();
    if (db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORAGE_STORE_NAME, 'readwrite');
          tx.objectStore(STORAGE_STORE_NAME).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Emergency self-healing eviction when disk throws `QuotaExceededError`.
   * Evicts the oldest `fraction` (default 50%) of stored documents by LRU `lastAccessedAt`.
   */
  async evictOldestFraction(fraction = 0.5): Promise<number> {
    const clampedFraction = Math.min(1, Math.max(0.1, fraction));
    let evicted = 0;

    const metas = await this.getAllMetas();
    if (metas.length > 0) {
      metas.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
      const targetEvictCount = Math.max(1, Math.ceil(metas.length * clampedFraction));
      for (let i = 0; i < targetEvictCount && i < metas.length; i++) {
        await this.deleteDocumentBinary(metas[i].key);
        evicted += 1;
      }
      return evicted;
    }

    if (this.memoryFallback.size > 0) {
      const entries = Array.from(this.memoryFallback.entries());
      entries.sort((a, b) => a[1].meta.lastAccessedAt - b[1].meta.lastAccessedAt);
      const targetEvictCount = Math.max(1, Math.ceil(entries.length * clampedFraction));
      for (let i = 0; i < targetEvictCount && i < entries.length; i++) {
        this.memoryFallback.delete(entries[i][0]);
        evicted += 1;
      }
    }

    return evicted;
  }

  async getStorageStats(): Promise<StorageStats> {
    let count = this.memoryFallback.size;
    let totalBytes = Array.from(this.memoryFallback.values()).reduce((s, m) => s + m.meta.sizeBytes, 0);

    const db = await this.openIndexedDb();
    if (db) {
      try {
        const metas = await this.getAllMetas();
        count = metas.length;
        totalBytes = metas.reduce((s, m) => s + (m.sizeBytes || 0), 0);
      } catch {
        // Ignore
      }
    }

    let quotaBytes: number | undefined;
    let usageBytes: number | undefined;
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      try {
        const est = await navigator.storage.estimate();
        quotaBytes = est.quota;
        usageBytes = est.usage;
        if (typeof quotaBytes === 'number' && quotaBytes > 0) {
          const policy = calculateAdaptiveReaderQuota(quotaBytes, usageBytes);
          this.maxDiskBytes = policy.maxDiskBytes;
          this.maxCachedDocs = policy.maxCachedDocs;
        }
      } catch {
        // Ignore
      }
    }

    return {
      count,
      totalBytes,
      maxBytes: this.maxDiskBytes,
      maxCachedDocs: this.maxCachedDocs,
      quotaBytes,
      usageBytes,
    };
  }

  private async saveMetaToIndexedDb(meta: StoredDocumentMeta): Promise<void> {
    const db = await this.openIndexedDb();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORAGE_STORE_NAME, 'readwrite');
      tx.objectStore(STORAGE_STORE_NAME).put(meta);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private async getMetaFromIndexedDb(key: string): Promise<StoredDocumentMeta | null> {
    const db = await this.openIndexedDb();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(STORAGE_STORE_NAME, 'readonly');
      const req = tx.objectStore(STORAGE_STORE_NAME).get(key);
      req.onsuccess = () => resolve((req.result as StoredDocumentMeta) || null);
      req.onerror = () => resolve(null);
    });
  }

  private async getAllMetas(): Promise<StoredDocumentMeta[]> {
    const db = await this.openIndexedDb();
    if (!db) return [];
    return new Promise((resolve) => {
      const tx = db.transaction(STORAGE_STORE_NAME, 'readonly');
      const req = tx.objectStore(STORAGE_STORE_NAME).getAll();
      req.onsuccess = () => resolve((req.result as StoredDocumentMeta[]) || []);
      req.onerror = () => resolve([]);
    });
  }

  private async touchAccess(key: string): Promise<void> {
    const now = Date.now();
    const mem = this.memoryFallback.get(key);
    if (mem) mem.meta.lastAccessedAt = now;

    const db = await this.openIndexedDb();
    if (!db) return;
    try {
      const tx = db.transaction(STORAGE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORAGE_STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        if (req.result) {
          req.result.lastAccessedAt = now;
          store.put(req.result);
        }
      };
    } catch {
      // Ignore
    }
  }

  private async enforceQuota(): Promise<void> {
    const metas = await this.getAllMetas();
    if (metas.length <= this.maxCachedDocs) {
      const total = metas.reduce((s, m) => s + (m.sizeBytes || 0), 0);
      if (total <= this.maxDiskBytes) return;
    }

    // Sort by LRU (oldest lastAccessedAt first)
    metas.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);

    let currentTotal = metas.reduce((s, m) => s + (m.sizeBytes || 0), 0);
    let currentCount = metas.length;

    for (const item of metas) {
      if (currentCount <= this.maxCachedDocs && currentTotal <= this.maxDiskBytes) {
        break;
      }
      await this.deleteDocumentBinary(item.key);
      currentTotal -= item.sizeBytes || 0;
      currentCount -= 1;
    }
  }

  private async enforceMemoryQuota(): Promise<void> {
    if (this.memoryFallback.size <= this.maxCachedDocs) return;
    const entries = Array.from(this.memoryFallback.entries());
    entries.sort((a, b) => a[1].meta.lastAccessedAt - b[1].meta.lastAccessedAt);
    while (this.memoryFallback.size > this.maxCachedDocs && entries.length > 0) {
      const oldest = entries.shift();
      if (oldest) this.memoryFallback.delete(oldest[0]);
    }
  }
}

export const documentStorage = new DocumentStorageService();
export const readerDocumentStorage = documentStorage;
