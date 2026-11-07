/**
 * Production-grade LRU Tab Cache with O(1) access, update, and eviction.
 * Backed by a Doubly Linked List and Hash Map.
 * Used by Reader to govern Active, Warm Standby, and Hibernated tab tiers.
 */

import type { ReaderFitMode, ReaderTab, ReaderTheme } from '@/features/library/types/reader.types';

export const DEFAULT_READER_TABS: ReaderTab[] = [
  { id: 'library', title: 'My Library', type: 'library' },
];

export const MAX_READER_TABS = 15;
export const MAX_BOOKMARKED_ITEMS = 200;
export const MIN_READER_ZOOM = 0.25;
export const MAX_READER_ZOOM = 5.0;

/**
 * Evicts the oldest inactive paper tabs when the tab count exceeds MAX_READER_TABS.
 * Always preserves the 'library' tab and the currently active tab.
 */
export function enforceMaxReaderTabs(tabs: ReaderTab[], activeTabId: string): ReaderTab[] {
  if (tabs.length <= MAX_READER_TABS) return tabs;
  const result = [...tabs];
  while (result.length > MAX_READER_TABS) {
    const evictIdx = result.findIndex((t) => t.id !== 'library' && t.id !== activeTabId);
    if (evictIdx === -1) break;
    result.splice(evictIdx, 1);
  }
  return result;
}

/**
 * Evicts the oldest bookmarked items when the bookmark dictionary exceeds MAX_BOOKMARKED_ITEMS.
 */
export function enforceMaxBookmarkedItems(
  bookmarks: Record<string, number[]>,
): Record<string, number[]> {
  const keys = Object.keys(bookmarks);
  if (keys.length <= MAX_BOOKMARKED_ITEMS) return bookmarks;
  const keepKeys = keys.slice(keys.length - MAX_BOOKMARKED_ITEMS);
  const bounded: Record<string, number[]> = {};
  for (const k of keepKeys) {
    if (bookmarks[k] && bookmarks[k].length > 0) {
      bounded[k] = bookmarks[k];
    }
  }
  return bounded;
}

/**
 * Normalizes zoom input whether provided as a float scale (e.g. 1.25)
 * or percentage (e.g. 125) into a clamped float scale in [0.25, 5.0].
 */
export function normalizeReaderZoom(rawZoom?: number | null): number {
  if (typeof rawZoom !== 'number' || Number.isNaN(rawZoom) || rawZoom <= 0) {
    return 1.0;
  }
  const scale = rawZoom > 10 ? rawZoom / 100 : rawZoom;
  return Math.min(MAX_READER_ZOOM, Math.max(MIN_READER_ZOOM, Number(scale.toFixed(4))));
}

export function normalizeReaderFitMode(raw?: string | null): ReaderFitMode {
  if (raw === 'fit-width' || raw === 'page-width') return 'fit-width';
  if (raw === 'fit-page' || raw === 'page-fit') return 'fit-page';
  if (raw === 'manual') return 'custom';
  if (raw === 'auto' || raw === 'custom') return raw;
  return 'fit-width';
}

export function normalizeReaderTheme(raw?: string | null): ReaderTheme {
  if (raw === 'normal' || raw === 'light') return 'normal';
  if (raw === 'sepia' || raw === 'dark' || raw === 'invert') return raw;
  return 'normal';
}

/**
 * Normalizes a ReaderTab record to guarantee valid page, zoom, fitMode, rotation, and theme values.
 */
export function normalizeReaderTab(tab: ReaderTab): ReaderTab {
  if (tab.type === 'library' || tab.id === 'library') {
    return { id: 'library', title: tab.title || 'My Library', type: 'library' };
  }
  return {
    ...tab,
    type: 'paper',
    currentPage: Math.max(1, Math.floor(tab.currentPage ?? 1)),
    scrollTop:
      typeof tab.scrollTop === 'number' && Number.isFinite(tab.scrollTop) && tab.scrollTop >= 0
        ? Math.round(tab.scrollTop)
        : undefined,
    zoom: normalizeReaderZoom(tab.zoom ?? 1.0),
    fitMode: normalizeReaderFitMode(tab.fitMode),
    rotation: (((tab.rotation ?? 0) % 360) + 360) % 360,
    theme: normalizeReaderTheme(tab.theme),
    viewMode:
      tab.viewMode === 'single' || tab.viewMode === 'continuous' || tab.viewMode === 'spread'
        ? tab.viewMode
        : 'continuous',
    splitMode:
      tab.splitMode === 'none' || tab.splitMode === 'horizontal' || tab.splitMode === 'vertical'
        ? tab.splitMode
        : 'none',
    secondaryPage:
      typeof tab.secondaryPage === 'number' && Number.isFinite(tab.secondaryPage) && tab.secondaryPage >= 1
        ? Math.max(1, Math.floor(tab.secondaryPage))
        : 1,
    interactionMode:
      tab.interactionMode === 'select' || tab.interactionMode === 'hand'
        ? tab.interactionMode
        : 'select',
    ...(tab.attachmentId !== undefined ? { attachmentId: tab.attachmentId } : {}),
    ...(tab.fileUrl !== undefined ? { fileUrl: tab.fileUrl } : {}),
    ...(tab.projectId !== undefined ? { projectId: tab.projectId } : {}),
  };
}

/**
 * Resolves the next active tab ID when closing a tab:
 * prefers right neighbor -> left neighbor -> first remaining tab -> 'library'.
 */
export function resolveNextActiveTabOnClose(
  tabs: ReaderTab[],
  closedTabId: string,
  currentActiveId: string,
): string {
  const nextTabs = tabs.filter((t) => t.id !== closedTabId);
  if (currentActiveId !== closedTabId) {
    return nextTabs.some((t) => t.id === currentActiveId)
      ? currentActiveId
      : (nextTabs[0]?.id ?? 'library');
  }
  const idx = tabs.findIndex((t) => t.id === closedTabId);
  const rightNeighbor = tabs[idx + 1];
  if (rightNeighbor) return rightNeighbor.id;
  const leftNeighbor = tabs[idx - 1];
  if (leftNeighbor) return leftNeighbor.id;
  return nextTabs[0]?.id ?? 'library';
}

export class LruNode<T> {
  key: string;
  value: T;
  prev: LruNode<T> | null = null;
  next: LruNode<T> | null = null;

  constructor(key: string, value: T) {
    this.key = key;
    this.value = value;
  }
}

export interface TabPoolEntry {
  id: string;
  title: string;
  isSuspended: boolean;
  lastAccessedAt: number;
}

/**
 * Zotero 7 Baseline & Hardware-Adaptive Tab Pool Sizing:
 * - Each Standby (suspended) tab strips TextLayer spans and zeroes Canvas VRAM (0 MB VRAM),
 *   costing only ~35 placeholder DOM nodes and ~10-12 MB Worker AST RAM per paper.
 * - Zotero 7 (`Zotero.Reader._readers`) maintains 5 warm tabs by default on desktop.
 * - Using `navigator.deviceMemory` (W3C Device Memory API):
 *   - <= 2 GB RAM (low-end mobile/tablet): K = 3 tabs (1 Active + 2 Standby)
 *   - 4 GB RAM or default desktop (Zotero standard): K = 5 tabs (1 Active + 4 Standby)
 *   - >= 8 GB RAM (modern laptop/workstation): K = 8 tabs (1 Active + 7 Standby, ~245 extra DOM nodes)
 */
export const DEFAULT_ZOTERO_WARM_TAB_CAPACITY = 5;

export function calculateAdaptiveTabPoolCapacity(deviceMemoryGb?: number): number {
  const detectedRam =
    typeof deviceMemoryGb === 'number' && Number.isFinite(deviceMemoryGb) && deviceMemoryGb > 0
      ? deviceMemoryGb
      : typeof navigator !== 'undefined' &&
          'deviceMemory' in navigator &&
          typeof (navigator as { deviceMemory?: number }).deviceMemory === 'number'
        ? (navigator as { deviceMemory: number }).deviceMemory
        : undefined;

  if (detectedRam !== undefined) {
    if (detectedRam <= 2) return 3;
    if (detectedRam >= 8) return 8;
  }

  return DEFAULT_ZOTERO_WARM_TAB_CAPACITY;
}

export class LruTabPool<T = TabPoolEntry> {
  private _capacity: number;
  private map = new Map<string, LruNode<T>>();
  private head: LruNode<T> | null = null;
  private tail: LruNode<T> | null = null;

  constructor(capacity = DEFAULT_ZOTERO_WARM_TAB_CAPACITY) {
    if (capacity < 1) throw new Error('Capacity must be at least 1');
    this._capacity = capacity;
  }

  get size(): number {
    return this.map.size;
  }

  get capacity(): number {
    return this._capacity;
  }

  /**
   * Retrieves tab entry and promotes it to Most Recently Used (MRU) (O(1)).
   */
  get(key: string): T | undefined {
    const node = this.map.get(key);
    if (!node) return undefined;
    this.moveToHead(node);
    return node.value;
  }

  /**
   * Peeks entry without altering its LRU position (O(1)).
   */
  peek(key: string): T | undefined {
    return this.map.get(key)?.value;
  }

  /**
   * Checks presence in pool (O(1)).
   */
  has(key: string): boolean {
    return this.map.has(key);
  }

  /**
   * Deletes a specific key from the pool (e.g. when user explicitly closes a tab) (O(1)).
   */
  delete(key: string): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    this.removeNode(node);
    this.map.delete(key);
    return true;
  }

  /**
   * Clears all entries from pool.
   */
  clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
  }

  /**
   * Inserts or touches tab entry. If capacity is exceeded, evicts the LRU candidate (O(1)).
   * Any keys listed in `protectedKeys` (e.g. 'library' or the currently active tab) are skipped during eviction.
   * Returns the evicted key if an eviction took place, or null otherwise.
   */
  put(key: string, value: T, protectedKeys?: Set<string>): string | null {
    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      this.moveToHead(existing);
      return null;
    }

    const newNode = new LruNode(key, value);
    this.map.set(key, newNode);
    this.addToHead(newNode);

    if (this.map.size > this._capacity) {
      return this.evictTail(protectedKeys);
    }
    return null;
  }

  /**
   * Returns keys ordered from MRU (head) to LRU (tail).
   */
  getKeysMruOrder(): string[] {
    const keys: string[] = [];
    let curr = this.head;
    while (curr) {
      keys.push(curr.key);
      curr = curr.next;
    }
    return keys;
  }

  /**
   * Returns values ordered from MRU (head) to LRU (tail).
   */
  getValuesMruOrder(): T[] {
    const values: T[] = [];
    let curr = this.head;
    while (curr) {
      values.push(curr.value);
      curr = curr.next;
    }
    return values;
  }

  private addToHead(node: LruNode<T>): void {
    node.prev = null;
    node.next = this.head;
    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;
    if (!this.tail) {
      this.tail = node;
    }
  }

  private removeNode(node: LruNode<T>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  private moveToHead(node: LruNode<T>): void {
    if (this.head === node) return;
    this.removeNode(node);
    this.addToHead(node);
  }

  private evictTail(protectedKeys?: Set<string>): string | null {
    let curr = this.tail;
    if (protectedKeys && protectedKeys.size > 0) {
      while (curr && protectedKeys.has(curr.key)) {
        curr = curr.prev;
      }
    }

    if (!curr) return null; // All current entries are protected

    this.removeNode(curr);
    this.map.delete(curr.key);
    return curr.key;
  }
}

export interface WarmViewerPoolItem {
  paperId: string;
  title: string;
  blobUrl?: string | null;
  fileUrl?: string;
  scopeId?: string;
  attachmentId?: string;
  scrollTop?: number;
}

export const warmViewerPool = new LruTabPool<WarmViewerPoolItem>(
  calculateAdaptiveTabPoolCapacity(),
);

