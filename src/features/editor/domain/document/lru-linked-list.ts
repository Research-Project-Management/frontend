/**
 * lru-linked-list.ts
 *
 * Pure O(1) Doubly Linked List + UTF-8 byte measurement helpers for LRUDocumentCache.
 */

export interface LRUNode {
  fileId: string;
  prev: LRUNode | null;
  next: LRUNode | null;
}

/**
 * Computes exact UTF-8 byte length of a UTF-16 string without allocating temporary buffers.
 */
export function measureUtf8Bytes(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

export class LRULinkedList {
  private readonly nodes = new Map<string, LRUNode>();
  private head: LRUNode | null = null; // Most Recently Used (MRU)
  private tail: LRUNode | null = null; // Least Recently Used (LRU)

  public get(fileId: string): LRUNode | undefined {
    return this.nodes.get(fileId);
  }

  public has(fileId: string): boolean {
    return this.nodes.has(fileId);
  }

  public values(): IterableIterator<LRUNode> {
    return this.nodes.values();
  }

  public getMruId(): string | null {
    return this.head?.fileId ?? null;
  }

  public getLruId(): string | null {
    return this.tail?.fileId ?? null;
  }

  public getTail(): LRUNode | null {
    return this.tail;
  }

  public insertAtHead(fileId: string): LRUNode {
    const node: LRUNode = { fileId, prev: null, next: null };
    this.nodes.set(fileId, node);
    this.attachToHead(node);
    return node;
  }

  public touch(fileId: string): void {
    const node = this.nodes.get(fileId);
    if (!node || node === this.head) return;

    this.detach(node);
    this.attachToHead(node);
  }

  public attachToHead(node: LRUNode): void {
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

  public detach(node: LRUNode): void {
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

    node.prev = null;
    node.next = null;
  }

  public remove(fileId: string): LRUNode | undefined {
    const node = this.nodes.get(fileId);
    if (!node) return undefined;
    this.detach(node);
    this.nodes.delete(fileId);
    return node;
  }

  public getEvictionCandidate(protectedFileId: string | null): LRUNode | null {
    let candidate = this.tail;
    if (candidate && candidate.fileId === protectedFileId) {
      candidate = candidate.prev;
    }
    return candidate;
  }

  public clear(): void {
    this.nodes.clear();
    this.head = null;
    this.tail = null;
  }
}
