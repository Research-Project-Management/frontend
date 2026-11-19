/**
 * editor-tab-pool.domain.ts
 *
 * Production-grade Tri-State Editor Tab Pool & Tab Governance Domain (1:1 Reader Architecture Parity).
 * Backed by a Doubly Linked List and Hash Map for O(1) MRU access, update, and eviction:
 * - State 1 (Active): Mounted CodeMirrorView(s) (1 primary, or 2 in split pane) + live Yjs binding.
 * - State 2 (Warm Standby): Unmounted from DOM (0 DOM nodes), retains serialized EditorState + history + fold state.
 * - State 3 (Hibernated): Evicted from warmEditorStatePool, retains lightweight metadata + LRU text/IndexedDB.
 */

import {
  EDITOR_LIMITS,
  isMainTexTabOrFile,
} from '@/features/editor/domain/constants/editor.constants';
import {
  normalizeVirtualPath,
  splitVirtualPath,
} from '@/features/editor/domain/document/document-naming';
import type { WorkspaceTab } from '@/features/editor/domain/types/workspace.types';

export const MAX_EDITOR_TABS = EDITOR_LIMITS.MAX_EDITOR_TABS;
export const MAX_PERSISTED_EDITOR_PAGES = EDITOR_LIMITS.MAX_PERSISTED_EDITOR_PAGES;
export const DEFAULT_WARM_EDITOR_TAB_CAPACITY = 5;

/**
 * Hardware-adaptive warm standby capacity matching Zotero/Reader's 3/5/8 curve:
 * - <= 2 GB RAM: K = 3 warm states
 * - 4 GB / unknown RAM: K = 5 warm states
 * - >= 8 GB RAM: K = 8 warm states
 */
export function calculateAdaptiveEditorTabPoolCapacity(deviceMemoryGb?: number): number {
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

  return DEFAULT_WARM_EDITOR_TAB_CAPACITY;
}

class LruEditorNode<T> {
  key: string;
  value: T;
  prev: LruEditorNode<T> | null = null;
  next: LruEditorNode<T> | null = null;

  constructor(key: string, value: T) {
    this.key = key;
    this.value = value;
  }
}

export interface WarmFoldRange {
  from: number;
  to: number;
}

export interface WarmEditorStateSnapshot {
  fileId: string;
  content: string;
  stateJson: unknown;
  foldedRanges: WarmFoldRange[];
  savedAt: number;
}

/**
 * O(1) MRU/LRU Doubly-Linked Pool for Warm CodeMirror EditorState snapshots.
 */
export class LruEditorTabPool<T = WarmEditorStateSnapshot> {
  private _capacity: number;
  private map = new Map<string, LruEditorNode<T>>();
  private head: LruEditorNode<T> | null = null;
  private tail: LruEditorNode<T> | null = null;

  constructor(capacity = DEFAULT_WARM_EDITOR_TAB_CAPACITY) {
    if (capacity < 1) throw new Error('Capacity must be at least 1');
    this._capacity = capacity;
  }

  get size(): number {
    return this.map.size;
  }

  get capacity(): number {
    return this._capacity;
  }

  public get(key: string): T | undefined {
    const node = this.map.get(key);
    if (!node) return undefined;
    this.moveToHead(node);
    return node.value;
  }

  public peek(key: string): T | undefined {
    return this.map.get(key)?.value;
  }

  public has(key: string): boolean {
    return this.map.has(key);
  }

  public delete(key: string): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    this.removeNode(node);
    this.map.delete(key);
    return true;
  }

  public clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
  }

  public put(key: string, value: T, protectedKeys?: Set<string>): string | null {
    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      this.moveToHead(existing);
      return null;
    }

    const newNode = new LruEditorNode(key, value);
    this.map.set(key, newNode);
    this.addToHead(newNode);

    if (this.map.size > this._capacity) {
      return this.evictTail(protectedKeys);
    }
    return null;
  }

  public getKeysMruOrder(): string[] {
    const keys: string[] = [];
    let curr = this.head;
    while (curr) {
      keys.push(curr.key);
      curr = curr.next;
    }
    return keys;
  }

  public getValuesMruOrder(): T[] {
    const values: T[] = [];
    let curr = this.head;
    while (curr) {
      values.push(curr.value);
      curr = curr.next;
    }
    return values;
  }

  private addToHead(node: LruEditorNode<T>): void {
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

  private removeNode(node: LruEditorNode<T>): void {
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

  private moveToHead(node: LruEditorNode<T>): void {
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

    if (!curr) return null;

    this.removeNode(curr);
    this.map.delete(curr.key);
    return curr.key;
  }
}

export const warmEditorStatePool = new LruEditorTabPool<WarmEditorStateSnapshot>(
  calculateAdaptiveEditorTabPoolCapacity(),
);

export interface EnforceMaxEditorTabsOptions {
  maxTabs?: number;
  activeTabId?: string | null;
  secondaryTabId?: string | null;
  rootPageId?: string | null;
  isDirtyFn?: (id: string) => boolean;
}

export function isProtectedRootTab(tab: WorkspaceTab, rootPageId?: string | null): boolean {
  if (tab.isRoot) return true;
  if (rootPageId && (tab.id === rootPageId || tab.id === `${rootPageId}-main`)) return true;
  return Boolean(rootPageId && isMainTexTabOrFile(tab, rootPageId));
}

function isTabProtectedFromEviction(
  tab: WorkspaceTab,
  options: EnforceMaxEditorTabsOptions,
): boolean {
  if (isProtectedRootTab(tab, options.rootPageId)) return true;
  if (options.activeTabId && tab.id === options.activeTabId) return true;
  if (options.secondaryTabId && tab.id === options.secondaryTabId) return true;
  const dirty = Boolean(options.isDirtyFn?.(tab.id)) || Boolean(tab.isDirty);
  return dirty;
}

function pickOldestCandidateIndex(
  tabs: readonly WorkspaceTab[],
  predicate: (tab: WorkspaceTab) => boolean,
): number {
  let bestIdx = -1;
  let bestTimestamp = Infinity;
  for (let i = 0; i < tabs.length; i++) {
    const candidate = tabs[i];
    if (!predicate(candidate)) continue;
    const accessed = candidate.lastAccessedAt ?? 0;
    if (accessed < bestTimestamp) {
      bestTimestamp = accessed;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Enforces MAX_EDITOR_TABS while strictly protecting root doc, active/secondary tabs,
 * and all dirty unsaved buffers (Zero Data Loss). Evicts unpinned preview tabs first,
 * then the oldest clean unprotected tab by `lastAccessedAt`.
 */
export function enforceMaxEditorTabs(
  tabs: readonly WorkspaceTab[],
  options: EnforceMaxEditorTabsOptions = {},
): WorkspaceTab[] {
  if (options.maxTabs === undefined || !Number.isFinite(options.maxTabs)) {
    return [...tabs];
  }
  const maxTabs = Math.max(1, options.maxTabs);
  if (tabs.length <= maxTabs) return [...tabs];

  const result = [...tabs];
  while (result.length > maxTabs) {
    let evictIdx = pickOldestCandidateIndex(
      result,
      (t) => Boolean(t.isPreview && !t.isPinned) && !isTabProtectedFromEviction(t, options),
    );
    if (evictIdx === -1) {
      evictIdx = pickOldestCandidateIndex(
        result,
        (t) => !isTabProtectedFromEviction(t, options),
      );
    }
    if (evictIdx === -1) break;
    result.splice(evictIdx, 1);
  }

  return result;
}

/**
 * Resolves the next active tab ID when closing a tab:
 * prefers right neighbor -> left neighbor -> first remaining tab -> rootPageId -> null.
 */
export function resolveNextActiveEditorTabOnClose(
  tabs: readonly WorkspaceTab[],
  closedTabId: string,
  currentActiveId: string | null | undefined,
  rootPageId?: string | null,
): string | null {
  const nextTabs = tabs.filter((t) => t.id !== closedTabId);
  if (currentActiveId && currentActiveId !== closedTabId) {
    return nextTabs.some((t) => t.id === currentActiveId)
      ? currentActiveId
      : (nextTabs[0]?.id ?? rootPageId ?? null);
  }

  const idx = tabs.findIndex((t) => t.id === closedTabId);
  if (idx !== -1) {
    const rightNeighbor = tabs[idx + 1];
    if (rightNeighbor && rightNeighbor.id !== closedTabId) return rightNeighbor.id;
    const leftNeighbor = tabs[idx - 1];
    if (leftNeighbor && leftNeighbor.id !== closedTabId) return leftNeighbor.id;
  }

  return nextTabs[0]?.id ?? rootPageId ?? null;
}

export interface EditorTabDisplayLabel {
  leafTitle: string;
  disambiguationDir: string | null;
  fullPath: string;
}

/**
 * Computes leaf display titles and disambiguates tabs that share the same filename
 * across different folders (e.g. `setup.tex` in `chapters` vs `appendix`), without
 * mutating the canonical stored tab data.
 */
export function computeEditorTabDisplayLabels(
  tabs: readonly WorkspaceTab[],
): Map<string, EditorTabDisplayLabel> {
  const parsed = tabs.map((tab) => {
    const rawPath = tab.path || tab.title || tab.id;
    const fullPath = normalizeVirtualPath(rawPath) || tab.title || tab.id;
    const { dir, leaf } = splitVirtualPath(fullPath);
    const leafTitle = leaf || tab.title || fullPath;
    return {
      tab,
      fullPath,
      leafTitle,
      parentDir: dir,
    };
  });

  const leafCounts = new Map<string, number>();
  for (const item of parsed) {
    const key = item.leafTitle.toLowerCase();
    leafCounts.set(key, (leafCounts.get(key) ?? 0) + 1);
  }

  const labels = new Map<string, EditorTabDisplayLabel>();
  for (const item of parsed) {
    const count = leafCounts.get(item.leafTitle.toLowerCase()) ?? 0;
    labels.set(item.tab.id, {
      leafTitle: item.leafTitle,
      disambiguationDir: count > 1 ? (item.parentDir || '/') : null,
      fullPath: item.fullPath,
    });
  }

  return labels;
}
