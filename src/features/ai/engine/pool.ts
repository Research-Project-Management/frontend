import {
  type ThreadEngine,
  type ThreadEngineInit,
} from './engine.port';
import { createFluxThreadEngine } from './flux-engine';

const DEFAULT_MAX_THREADS = 12;

export class ThreadPool {
  private readonly entries = new Map<string, ThreadEngine>();
  private readonly maxSize: number;

  constructor(maxSize = DEFAULT_MAX_THREADS) {
    this.maxSize = maxSize;
  }

  get(threadKey: string): ThreadEngine | undefined {
    const existing = this.entries.get(threadKey);
    if (!existing) return undefined;
    // Refresh LRU order
    this.entries.delete(threadKey);
    this.entries.set(threadKey, existing);
    return existing;
  }

  getOrCreate(threadKey: string, init: Omit<ThreadEngineInit, 'threadKey'>): ThreadEngine {
    const existing = this.get(threadKey);
    if (existing) {
      return existing;
    }

    const engine = createFluxThreadEngine({
      ...init,
      threadKey,
    });
    this.entries.set(threadKey, engine);
    this.evictIfNeeded(threadKey);
    return engine;
  }

  rebind(oldKey: string, newKey: string): ThreadEngine | undefined {
    if (!oldKey || !newKey || oldKey === newKey) {
      return this.entries.get(newKey);
    }

    const engine = this.entries.get(oldKey);
    if (!engine) return this.entries.get(newKey);

    const displaced = this.entries.get(newKey);
    if (displaced && displaced !== engine) {
      void displaced.dispose();
    }

    this.entries.delete(oldKey);
    engine.rebindKey(newKey);
    this.entries.set(newKey, engine);
    return engine;
  }

  delete(threadKey: string): void {
    const engine = this.entries.get(threadKey);
    if (!engine) return;
    this.entries.delete(threadKey);
    void engine.dispose();
  }

  clearAll(): void {
    for (const engine of this.entries.values()) {
      void engine.dispose();
    }
    this.entries.clear();
  }

  size(): number {
    return this.entries.size;
  }

  private evictIfNeeded(protectedKey: string): void {
    if (this.entries.size <= this.maxSize) return;

    for (const [key, engine] of this.entries) {
      if (this.entries.size <= this.maxSize) break;
      if (key === protectedKey) continue;

      const status = engine.getSnapshot().status;
      if (
        status === 'streaming' ||
        status === 'waiting_approval' ||
        status === 'cancelling'
      ) {
        continue;
      }

      this.entries.delete(key);
      void engine.dispose();
    }
  }
}

export const threadPool = new ThreadPool();
