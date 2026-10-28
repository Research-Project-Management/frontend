/**
 * yjs-provider-pool.ts
 *
 * Multi-tab resilient singleton pool management for YjsSocketIOProvider instances.
 * Implements Object Pool / Ref-Counted Registry pattern with O(1) secondary index
 * by `projectId:pageId` and `pageId` so lookups without `userId` never miss the fast path.
 */

import { applyTextDiff, type YjsSocketIOProviderOptions } from './yjs-awareness-sync';
import { YjsSocketIOProvider } from './yjs-socket-provider';

interface PooledYjsEntry {
  key: string;
  projectKey: string;
  pageId: string;
  projectId: string;
  userId?: string;
  provider: YjsSocketIOProvider;
  refCount: number;
}

/**
 * Ref-Counted Object Pool for `YjsSocketIOProvider` instances with secondary indices
 * by `projectId:pageId` and `pageId` to guarantee O(1) lookup regardless of whether
 * the caller supplies `userId`.
 */
export class YjsProviderPool {
  private readonly byKey = new Map<string, PooledYjsEntry>();
  private readonly byProjectPage = new Map<string, Set<PooledYjsEntry>>();
  private readonly byPage = new Map<string, Set<PooledYjsEntry>>();
  private readonly clearedListeners = new Set<() => void>();
  private poolEpoch = 0;

  public static buildKey(projectId: string, pageId: string, userId?: string): string {
    const userPrefix = userId ? `${userId}:` : '';
    return `${userPrefix}${projectId}:${pageId}`;
  }

  public static buildProjectPageKey(projectId: string, pageId: string): string {
    return `${projectId}:${pageId}`;
  }

  public subscribeCleared = (listener: () => void): (() => void) => {
    this.clearedListeners.add(listener);
    return () => {
      this.clearedListeners.delete(listener);
    };
  };

  public getEpoch = (): number => {
    return this.poolEpoch;
  };

  private indexEntry(entry: PooledYjsEntry): void {
    this.byKey.set(entry.key, entry);

    let projSet = this.byProjectPage.get(entry.projectKey);
    if (!projSet) {
      projSet = new Set();
      this.byProjectPage.set(entry.projectKey, projSet);
    }
    projSet.add(entry);

    let pageSet = this.byPage.get(entry.pageId);
    if (!pageSet) {
      pageSet = new Set();
      this.byPage.set(entry.pageId, pageSet);
    }
    pageSet.add(entry);
  }

  private unindexEntry(entry: PooledYjsEntry): void {
    this.byKey.delete(entry.key);

    const projSet = this.byProjectPage.get(entry.projectKey);
    if (projSet) {
      projSet.delete(entry);
      if (projSet.size === 0) {
        this.byProjectPage.delete(entry.projectKey);
      }
    }

    const pageSet = this.byPage.get(entry.pageId);
    if (pageSet) {
      pageSet.delete(entry);
      if (pageSet.size === 0) {
        this.byPage.delete(entry.pageId);
      }
    }
  }

  public getOrCreate(
    projectId: string,
    pageId: string,
    options?: YjsSocketIOProviderOptions
  ): YjsSocketIOProvider {
    const userId = options?.user?.id;
    const key = YjsProviderPool.buildKey(projectId, pageId, userId);
    const existing = this.byKey.get(key);
    if (existing && !existing.provider.isDestroyed) {
      if (options?.commandBus) {
        existing.provider.setCommandBus(options.commandBus);
      }
      if (options?.initialContent) {
        existing.provider.setInitialContent(options.initialContent);
      }
      existing.refCount++;
      return existing.provider;
    }
    if (existing) {
      this.unindexEntry(existing);
    }
    const provider = new YjsSocketIOProvider(projectId, pageId, undefined, options);
    const entry: PooledYjsEntry = {
      key,
      projectKey: YjsProviderPool.buildProjectPageKey(projectId, pageId),
      pageId,
      projectId,
      userId,
      provider,
      refCount: 1,
    };
    this.indexEntry(entry);
    return provider;
  }

  public release(
    projectId: string,
    pageId: string,
    targetProvider?: YjsSocketIOProvider,
    userId?: string
  ): void {
    const key = YjsProviderPool.buildKey(projectId, pageId, userId);
    let item = this.byKey.get(key);

    if (!item && userId) {
      item = this.byKey.get(YjsProviderPool.buildKey(projectId, pageId));
    }
    if (!item) {
      const projEntries = this.byProjectPage.get(
        YjsProviderPool.buildProjectPageKey(projectId, pageId)
      );
      if (projEntries) {
        for (const candidate of projEntries) {
          if (!targetProvider || candidate.provider === targetProvider) {
            item = candidate;
            break;
          }
        }
      }
    }

    if (!item) {
      if (targetProvider && !targetProvider.isDestroyed) {
        targetProvider.destroy();
      }
      return;
    }

    if (targetProvider && item.provider !== targetProvider) {
      if (!targetProvider.isDestroyed) {
        targetProvider.destroy();
      }
      return;
    }

    item.refCount--;
    if (item.refCount <= 0) {
      item.provider.destroy();
      this.unindexEntry(item);
    }
  }

  public findActive(pageId: string, projectId?: string): YjsSocketIOProvider | null {
    if (projectId) {
      const projKey = YjsProviderPool.buildProjectPageKey(projectId, pageId);
      const direct = this.byKey.get(projKey);
      if (direct && !direct.provider.isDestroyed) {
        return direct.provider;
      }
      const projSet = this.byProjectPage.get(projKey);
      if (projSet) {
        for (const entry of projSet) {
          if (!entry.provider.isDestroyed) {
            return entry.provider;
          }
        }
      }
    }

    const pageSet = this.byPage.get(pageId);
    if (pageSet) {
      for (const entry of pageSet) {
        if (!entry.provider.isDestroyed) {
          return entry.provider;
        }
      }
    }
    return null;
  }

  public markHttpSaved(pageId: string): void {
    const pageSet = this.byPage.get(pageId);
    if (!pageSet) return;
    for (const { provider } of pageSet) {
      if (!provider.isDestroyed) {
        provider.markHttpSaved();
      }
    }
  }

  public flushOne(projectId: string | undefined, pageId: string): boolean {
    const provider = this.findActive(pageId, projectId);
    return provider ? provider.flushPendingUpdates() : false;
  }

  public flushAll(projectId?: string): number {
    let count = 0;
    for (const { provider } of this.byKey.values()) {
      if (!provider.isDestroyed && (!projectId || provider.projectId === projectId)) {
        provider.flushPendingUpdates();
        count++;
      }
    }
    return count;
  }

  public clear(): void {
    for (const item of this.byKey.values()) {
      item.provider.destroy();
    }
    this.byKey.clear();
    this.byProjectPage.clear();
    this.byPage.clear();
    this.poolEpoch++;
    for (const listener of this.clearedListeners) {
      try {
        listener();
      } catch {
        // Ignore listener error
      }
    }
  }
}

export const yjsProviderPool = new YjsProviderPool();

export function subscribeYjsPoolCleared(listener: () => void): () => void {
  return yjsProviderPool.subscribeCleared(listener);
}

export function getYjsPoolEpoch(): number {
  return yjsProviderPool.getEpoch();
}

export function getOrCreateYjsProvider(
  projectId: string,
  pageId: string,
  options?: YjsSocketIOProviderOptions
): YjsSocketIOProvider {
  return yjsProviderPool.getOrCreate(projectId, pageId, options);
}

export function releaseYjsProvider(
  projectId: string,
  pageId: string,
  targetProvider?: YjsSocketIOProvider,
  userId?: string
): void {
  yjsProviderPool.release(projectId, pageId, targetProvider, userId);
}

/**
 * Safe handle-based acquisition preventing double-release or race conditions in React effects.
 */
export function acquireYjsProvider(
  projectId: string,
  pageId: string,
  options?: YjsSocketIOProviderOptions
): { provider: YjsSocketIOProvider; release: () => void } {
  const provider = getOrCreateYjsProvider(projectId, pageId, options);
  let released = false;
  return {
    provider,
    release: () => {
      if (released) return;
      released = true;
      releaseYjsProvider(projectId, pageId, provider, options?.user?.id);
    },
  };
}

/**
 * Notifies every pooled provider for pageId that its content was just persisted over REST.
 */
export function markHttpSavedWhileDisconnected(pageId: string): void {
  yjsProviderPool.markHttpSaved(pageId);
}

/**
 * Flushes pending Yjs updates for a specific project/document provider if present in the pool.
 */
export function flushYjsProvider(projectId: string | undefined, pageId: string): boolean {
  return yjsProviderPool.flushOne(projectId, pageId);
}

/**
 * Flushes pending Yjs updates across all active pooled providers (optionally scoped to projectId).
 */
export function flushYjsProviders(projectId?: string): number {
  return yjsProviderPool.flushAll(projectId);
}

/**
 * Returns an active (non-destroyed) pooled Yjs provider for pageId if one exists.
 */
export function getActiveYjsProvider(pageId: string, projectId?: string): YjsSocketIOProvider | null {
  return yjsProviderPool.findActive(pageId, projectId);
}

/**
 * Updates live Yjs document content in-place if an active pooled provider exists for pageId.
 * Returns true if an active provider was found and updated.
 */
export function updateActiveYjsDocContent(
  pageId: string,
  nextContent: string,
  projectId?: string,
  origin: unknown = 'local-set-content',
): boolean {
  const provider = getActiveYjsProvider(pageId, projectId);
  if (!provider) return false;
  applyTextDiff(provider.yText, nextContent, origin);
  provider.flushPendingUpdates();
  return true;
}

/**
 * Destroys all pooled providers and clears the pool.
 */
export function clearYjsProviderPool(): void {
  yjsProviderPool.clear();
}
