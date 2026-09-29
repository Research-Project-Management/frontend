/**
 * library-cache-sync.ts
 *
 * Local Storage & Offline Persistence Seam for Library Subsystem.
 * Caches collections tree, system counts, and recent papers locally
 * so initial app load and folder navigations render in ~0ms offline/low-network.
 */

import type { QueryClient } from '@tanstack/react-query';
import { itemKeys, libraryKeys } from './query-keys';

const PERSISTENCE_VERSION = 'v1';
const PERSIST_PREFIX = `flux_lib_cache_${PERSISTENCE_VERSION}_`;

export const LibraryCacheSync = {
  saveLocal: (key: string, data: unknown): void => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        `${PERSIST_PREFIX}${key}`,
        JSON.stringify({
          timestamp: Date.now(),
          data,
        }),
      );
    } catch {
      // Safe fallback if storage quota exceeded or disabled
    }
  },

  loadLocal: <T>(key: string, maxAgeMs = 1000 * 60 * 60 * 24): T | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(`${PERSIST_PREFIX}${key}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { timestamp?: number; data?: T };
      if (!parsed || typeof parsed.timestamp !== 'number') return null;
      if (Date.now() - parsed.timestamp > maxAgeMs) {
        window.localStorage.removeItem(`${PERSIST_PREFIX}${key}`);
        return null;
      }
      return (parsed.data ?? null) as T | null;
    } catch {
      return null;
    }
  },

  /**
   * Pre-hydrates the QueryClient with offline cached data for a given scope.
   */
  hydrateScopeCache: (queryClient: QueryClient, scopeId?: string): void => {
    const scope = scopeId || 'user';
    const cachedCounts = LibraryCacheSync.loadLocal<{
      total: number;
      unfiled: number;
      starred: number;
      trash: number;
    }>(`counts_${scope}`);
    if (cachedCounts) {
      queryClient.setQueryData(itemKeys.counts(scope), cachedCounts);
    }
    const cachedCollections = LibraryCacheSync.loadLocal<unknown[]>(`cols_${scope}`);
    if (cachedCollections) {
      queryClient.setQueryData(libraryKeys.collections(scope), cachedCollections);
      queryClient.setQueryData(['collections', scope], cachedCollections);
    }
  },

  /**
   * Syncs active query cache to localStorage for offline readiness.
   */
  persistScopeCache: (queryClient: QueryClient, scopeId?: string): void => {
    const scope = scopeId || 'user';
    const counts = queryClient.getQueryData(itemKeys.counts(scope));
    if (counts) {
      LibraryCacheSync.saveLocal(`counts_${scope}`, counts);
    }
    const collections =
      queryClient.getQueryData(libraryKeys.collections(scope)) ||
      queryClient.getQueryData(['collections', scope]);
    if (collections) {
      LibraryCacheSync.saveLocal(`cols_${scope}`, collections);
    }
  },
};
