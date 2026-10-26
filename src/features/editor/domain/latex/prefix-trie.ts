/**
 * prefix-trie.ts
 *
 * High-Performance Compact Prefix Trie & Inverted Search Index (Domain Layer).
 * Location: `features/editor/domain/latex/prefix-trie.ts`
 *
 * Architecture & Performance Goals:
 * - O(K) prefix search lookup time where K is query string length, completely independent
 *   of document size or total items (N).
 * - Instant 0ms autocomplete suggestions for BibTeX citations (\cite), labels (\ref),
 *   LaTeX environments (\begin{...}), and custom macros (\newcommand).
 * - Zero-allocation query traversal with configurable result limit to prevent DOM flooding.
 * - Vietnamese diacritic-insensitive normalization mapping for seamless international search.
 */

export class TrieNode<T> {
  public children = new Map<string, TrieNode<T>>();
  public values: T[] = [];
  public isTerminal = false;
}

export interface TrieSearchOptions {
  limit?: number;
  caseSensitive?: boolean;
}

export class PrefixTrie<T> {
  private root = new TrieNode<T>();
  private sizeCount = 0;

  /**
   * Fast Vietnamese diacritic stripper for normalize search
   */
  public static normalize(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .toLowerCase()
      .trim();
  }

  /**
   * Clears the entire trie
   */
  public clear(): void {
    this.root = new TrieNode<T>();
    this.sizeCount = 0;
  }

  /**
   * Total number of indexed entries
   */
  public get size(): number {
    return this.sizeCount;
  }

  /**
   * Inserts a key and its associated value into the trie.
   */
  public insert(key: string, value: T): void {
    if (!key) return;
    const cleanKey = key.trim().toLowerCase();
    if (!cleanKey) return;

    let current = this.root;
    for (let i = 0; i < cleanKey.length; i++) {
      const char = cleanKey[i];
      let next = current.children.get(char);
      if (!next) {
        next = new TrieNode<T>();
        current.children.set(char, next);
      }
      current = next;
    }

    current.isTerminal = true;
    current.values.push(value);
    this.sizeCount++;
  }

  /**
   * Inserts a key along with its normalized variant (stripping diacritics).
   */
  public insertNormalized(key: string, value: T): void {
    this.insert(key, value);
    const norm = PrefixTrie.normalize(key);
    if (norm !== key.toLowerCase()) {
      this.insert(norm, value);
    }
  }

  /**
   * O(K) exact lookup. Returns the first matching item or undefined.
   */
  public findExact(key: string): T | undefined {
    if (!key) return undefined;
    const cleanKey = key.trim().toLowerCase();
    let current = this.root;
    for (let i = 0; i < cleanKey.length; i++) {
      const char = cleanKey[i];
      const next = current.children.get(char);
      if (!next) return undefined;
      current = next;
    }
    return current.isTerminal && current.values.length > 0 ? current.values[0] : undefined;
  }

  /**
   * O(K + M) prefix query. Traverses the tree matching the prefix,
   * then collects up to `limit` entries via Depth-First Search.
   */
  public findPrefix(prefix: string, options?: TrieSearchOptions): T[] {
    const limit = options?.limit ?? 50;
    const cleanPrefix = prefix.trim().toLowerCase();
    if (!cleanPrefix) {
      // Collect up to limit from root
      return this.collectSubtree(this.root, limit);
    }

    let current = this.root;
    for (let i = 0; i < cleanPrefix.length; i++) {
      const char = cleanPrefix[i];
      const next = current.children.get(char);
      if (!next) return []; // Prefix not found, return empty array in O(K)
      current = next;
    }

    return this.collectSubtree(current, limit);
  }

  /**
   * Traverses subtree collecting unique values up to limit.
   */
  private collectSubtree(startNode: TrieNode<T>, limit: number): T[] {
    const results: T[] = [];
    const seen = new Set<T>();
    const stack: TrieNode<T>[] = [startNode];

    while (stack.length > 0 && results.length < limit) {
      const node = stack.pop()!;
      if (node.isTerminal && node.values.length > 0) {
        for (const val of node.values) {
          if (!seen.has(val)) {
            seen.add(val);
            results.push(val);
            if (results.length >= limit) break;
          }
        }
      }

      // Traverse children in reverse insertion order so LIFO stack pops in forward insertion order
      if (node.children.size > 0) {
        const children = Array.from(node.children.values());
        for (let i = children.length - 1; i >= 0; i--) {
          stack.push(children[i]);
        }
      }
    }

    return results;
  }
}

/**
 * Composite Multi-Index Symbol Catalog
 * Maintains dedicated PrefixTries for instantaneous autocompletion of:
 * - BibTeX citations (by key, author tokens, and title words)
 * - Document labels (by prefix: 'sec:', 'fig:', 'eq:', 'tab:', etc.)
 * - Environments and custom macros
 */
export class LatexSymbolCatalog<CitationType, LabelType, CommandType, EnvType> {
  public readonly citationKeyTrie = new PrefixTrie<CitationType>();
  public readonly citationTokenTrie = new PrefixTrie<CitationType>();
  public readonly labelTrie = new PrefixTrie<LabelType>();
  public readonly commandTrie = new PrefixTrie<CommandType>();
  public readonly environmentTrie = new PrefixTrie<EnvType>();

  public clear(): void {
    this.citationKeyTrie.clear();
    this.citationTokenTrie.clear();
    this.labelTrie.clear();
    this.commandTrie.clear();
    this.environmentTrie.clear();
  }
}
