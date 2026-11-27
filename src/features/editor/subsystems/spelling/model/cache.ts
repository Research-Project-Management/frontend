/**
 * subsystems/spelling/model/cache.ts
 *
 * Pure TypeScript True-LRU spelling result cache, Singleflight deduplicator,
 * and scoped invalidation pub/sub. Zero CodeMirror or React dependencies.
 */

import type { SpellErrorRange } from '../extensions/decorations';

export type CacheInvalidationListener = (removedWord?: string) => void;

const DEFAULT_MAX_ENTRIES = 32;

export function hashSpellingInput(projectId: string, language: string, text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${projectId}|${language}|${text.length}:${hash >>> 0}`;
}

export class SpellingCache {
  private readonly results = new Map<string, SpellErrorRange[]>();
  private readonly inFlight = new Map<string, Promise<SpellErrorRange[] | null>>();
  private readonly listeners = new Set<CacheInvalidationListener>();
  private epoch = 0;

  constructor(private readonly maxEntries = DEFAULT_MAX_ENTRIES) {}

  public getEpoch(): number {
    return this.epoch;
  }

  public get(key: string): SpellErrorRange[] | undefined {
    const hit = this.results.get(key);
    if (!hit) return undefined;
    // Refresh LRU recency in O(1)
    this.results.delete(key);
    this.results.set(key, hit);
    return hit;
  }

  public getOrCompute(
    key: string,
    requestEpoch: number,
    compute: () => Promise<SpellErrorRange[] | null>,
  ): Promise<SpellErrorRange[] | null> {
    let pending = this.inFlight.get(key);
    if (!pending) {
      pending = compute()
        .then((ranges) => {
          if (ranges !== null && this.epoch === requestEpoch) {
            if (this.results.size >= this.maxEntries) {
              const oldestKey = this.results.keys().next().value;
              if (oldestKey !== undefined) this.results.delete(oldestKey);
            }
            this.results.set(key, ranges);
          }
          return ranges;
        })
        .finally(() => {
          if (this.inFlight.get(key) === pending) {
            this.inFlight.delete(key);
          }
        });
      this.inFlight.set(key, pending);
    }
    return pending;
  }

  public invalidate(removedWord?: string, projectId?: string): void {
    this.epoch++;
    if (projectId) {
      const prefix = `${projectId}|`;
      for (const key of this.results.keys()) {
        if (key.startsWith(prefix)) this.results.delete(key);
      }
      for (const key of this.inFlight.keys()) {
        if (key.startsWith(prefix)) this.inFlight.delete(key);
      }
    } else {
      this.results.clear();
      this.inFlight.clear();
    }
    for (const listener of this.listeners) {
      listener(removedWord);
    }
  }

  public subscribe(listener: CacheInvalidationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const spellingCache = new SpellingCache();
