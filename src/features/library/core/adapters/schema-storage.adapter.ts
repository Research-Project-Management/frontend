/**
 * Centralized Storage Adapter for Zotero Schema v42 Client-Side Bootstrap Cache.
 * Isolates browser localStorage side effects away from pure domain/types modules.
 */
export const SCHEMA_CACHE_KEY = 'flux:library:schema-v42:cache';
export const SCHEMA_VERSION = 42;
export const SCHEMA_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

let memorySchemaSnapshot: unknown | null | undefined = undefined;

export function saveSchemaCache(data: unknown): void {
  if (!data) return;
  memorySchemaSnapshot = data;
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(
      SCHEMA_CACHE_KEY,
      JSON.stringify({
        version: SCHEMA_VERSION,
        timestamp: Date.now(),
        data,
      }),
    );
  } catch {
    // Gracefully handle storage quota or private browsing mode
  }
}

export function loadSchemaCache(): unknown | null {
  if (memorySchemaSnapshot !== undefined && memorySchemaSnapshot !== null) {
    return memorySchemaSnapshot;
  }
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(SCHEMA_CACHE_KEY);
    if (!raw) {
      memorySchemaSnapshot = null;
      return null;
    }
    const parsed = JSON.parse(raw) as {
      version?: number;
      timestamp?: number;
      data?: unknown;
    } | null;

    const isValid =
      parsed !== null &&
      typeof parsed === 'object' &&
      parsed.version === SCHEMA_VERSION &&
      Boolean(parsed.data) &&
      typeof parsed.timestamp === 'number' &&
      Date.now() - parsed.timestamp <= SCHEMA_MAX_AGE_MS;

    if (!isValid) {
      window.localStorage.removeItem(SCHEMA_CACHE_KEY);
      memorySchemaSnapshot = null;
      return null;
    }

    memorySchemaSnapshot = parsed.data;
    return memorySchemaSnapshot;
  } catch {
    try {
      window.localStorage.removeItem(SCHEMA_CACHE_KEY);
    } catch {
      // ignore
    }
    memorySchemaSnapshot = null;
    return null;
  }
}

import {
  updateLibrarySchemaRegistry,
  setSchemaPersistenceListener,
} from '@/features/library/domain/types/library.types';

// Register storage persistence listener with domain layer
setSchemaPersistenceListener(saveSchemaCache);

// Immediately hydrate domain registry from cached schema if available
if (isBrowser()) {
  const cached = loadSchemaCache();
  if (cached) {
    updateLibrarySchemaRegistry(cached, { persist: false });
  }
}
