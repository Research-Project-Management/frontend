/**
 * Production-grade LRU Tab Cache with O(1) access, update, and eviction.
 * Backed by a Doubly Linked List and Hash Map.
 * Used by Reader to govern Active, Warm Standby, and Hibernated tab tiers.
 */

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

export class LruTabPool<T = TabPoolEntry> {
  private _capacity: number;
  private map = new Map<string, LruNode<T>>();
  private head: LruNode<T> | null = null;
  private tail: LruNode<T> | null = null;

  constructor(capacity = 3) {
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
  put(key: string, value: T, protectedKeys: Set<string> = new Set()): string | null {
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

  private evictTail(protectedKeys: Set<string>): string | null {
    let curr = this.tail;
    while (curr && protectedKeys.has(curr.key)) {
      curr = curr.prev;
    }

    if (!curr) return null; // All current entries are protected

    this.removeNode(curr);
    this.map.delete(curr.key);
    return curr.key;
  }
}
