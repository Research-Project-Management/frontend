/**
 * yjs-provider-pool.ts
 *
 * Multi-tab resilient singleton pool management for YjsSocketIOProvider instances.
 */

import { applyTextDiff, type YjsSocketIOProviderOptions } from './yjs-awareness-sync';
import { YjsSocketIOProvider } from './yjs-socket-provider';

const providerPool = new Map<string, { provider: YjsSocketIOProvider; refCount: number }>();

export function getOrCreateYjsProvider(
  projectId: string,
  pageId: string,
  options?: YjsSocketIOProviderOptions
): YjsSocketIOProvider {
  const key = `${projectId}:${pageId}`;
  const existing = providerPool.get(key);
  if (existing && !existing.provider.isDestroyed) {
    if (options?.commandBus) {
      existing.provider.setCommandBus(options.commandBus);
    }
    existing.refCount++;
    return existing.provider;
  }
  const provider = new YjsSocketIOProvider(projectId, pageId, undefined, options);
  providerPool.set(key, { provider, refCount: 1 });
  return provider;
}

export function releaseYjsProvider(projectId: string, pageId: string): void {
  const key = `${projectId}:${pageId}`;
  const item = providerPool.get(key);
  if (!item) return;
  item.refCount--;
  if (item.refCount <= 0) {
    item.provider.destroy();
    providerPool.delete(key);
  }
}

/**
 * Notifies every pooled provider for pageId that its content was just persisted over REST.
 */
export function markHttpSavedWhileDisconnected(pageId: string): void {
  for (const { provider } of providerPool.values()) {
    if (provider.pageId === pageId) provider.markHttpSaved();
  }
}

/**
 * Flushes pending Yjs updates for a specific project/document provider if present in the pool.
 */
export function flushYjsProvider(projectId: string | undefined, pageId: string): boolean {
  if (projectId) {
    const item = providerPool.get(projectId + ':' + pageId);
    if (item && !item.provider.isDestroyed) {
      return item.provider.flushPendingUpdates();
    }
  }
  for (const { provider } of providerPool.values()) {
    if (!provider.isDestroyed && provider.pageId === pageId) {
      return provider.flushPendingUpdates();
    }
  }
  return false;
}

/**
 * Flushes pending Yjs updates across all active pooled providers (optionally scoped to projectId).
 */
export function flushYjsProviders(projectId?: string): void {
  for (const { provider } of providerPool.values()) {
    if (!provider.isDestroyed && (!projectId || provider.projectId === projectId)) {
      provider.flushPendingUpdates();
    }
  }
}

/**
 * Returns an active (non-destroyed) pooled Yjs provider for pageId if one exists.
 */
export function getActiveYjsProvider(pageId: string, projectId?: string): YjsSocketIOProvider | null {
  if (projectId) {
    const item = providerPool.get(`${projectId}:${pageId}`);
    if (item && !item.provider.isDestroyed) {
      return item.provider;
    }
  }
  for (const { provider } of providerPool.values()) {
    if (!provider.isDestroyed && provider.pageId === pageId) {
      return provider;
    }
  }
  return null;
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
  for (const item of providerPool.values()) {
    item.provider.destroy();
  }
  providerPool.clear();
}
