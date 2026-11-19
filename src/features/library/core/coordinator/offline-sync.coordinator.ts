/**
 * Library Offline-First Mutation Outbox & Sync Coordinator
 * (`@/features/library/core/coordinator/offline-sync.coordinator`)
 *
 * Coordinates offline mutation enqueueing, multi-tab single-leader dispatching via W3C Web Locks,
 * exponential backoff retry for transient network errors, poison-pill dead lettering,
 * and TanStack Query cache reconciliation with backend CDC.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError, isApiError } from '@/shared/lib/api';
import { multiTabBus, withWebLock } from '@/shared/lib/multi-tab';
import {
  getOutboxStorage,
  type OutboxMutationEntry,
  type EnqueueMutationInput,
} from '@/features/library/core/adapters/library-outbox-storage.adapter';
import {
  libraryKeys,
  itemKeys,
  collectionKeys,
  tagKeys,
  normalizeSpaceId,
} from '@/features/library/sdk/query-keys';
import { registerOfflineMutationEnqueuer } from '@/features/library/sdk/queries/reader.queries';

export const OFFLINE_SYNC_LOCK_NAME = 'flux:offline:sync:dispatcher';

export interface FlushOptions {
  /** Maximum retry attempts before dropping a non-fatal failing mutation */
  maxRetries?: number;
  /** Custom dispatcher callback (for tests or custom transport override) */
  dispatcher?: (entry: OutboxMutationEntry) => Promise<unknown>;
  /** Progress callback invoked after each mutation attempt */
  onProgress?: (processed: number, total: number) => void;
}

export interface FlushResult {
  flushedCount: number;
  failedCount: number;
  remainingCount: number;
  errors: Array<{ id: string; error: string }>;
}

export interface OfflineSyncStatus {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  lastError: string | null;
}

let isFlushingInCurrentProcess = false;

function notifyOutboxMutated(
  action: 'ENQUEUED' | 'FLUSHED' | 'FAILED' | 'RETRY',
  count: number,
  mutationId?: string,
): void {
  // Broadcast across tabs via BroadcastChannel
  multiTabBus.broadcast({
    type: 'OFFLINE_OUTBOX_MUTATED',
    action,
    count,
    mutationId,
  });

  // Notify listeners within current tab / window
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('flux:outbox:mutated', {
          detail: { action, count, mutationId },
        }),
      );
    } catch {
      // ignore
    }
  }
}

function isTransientNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true;
  }
  if (isApiError(err)) {
    if (err.code === 'NETWORK_ERROR' || err.statusCode === 0) return true;
    if (err.statusCode === 408 || err.statusCode === 429) return true;
    if (err.statusCode >= 500 && err.statusCode <= 599) return true;
    return false;
  }
  if (err instanceof TypeError && err.message.toLowerCase().includes('failed to fetch')) {
    return true;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('network') || msg.includes('timeout') || msg.includes('abort')) {
      return true;
    }
  }
  return false;
}

function isFatalClientError(err: unknown): boolean {
  if (isApiError(err)) {
    // 400 Bad Request, 404 Not Found, 422 Unprocessable Entity
    // These indicate payload or entity state incompatibility that will never succeed on retry.
    return (
      err.statusCode === 400 ||
      err.statusCode === 404 ||
      err.statusCode === 422 ||
      err.statusCode === 403
    );
  }
  return false;
}

/**
 * Default HTTP dispatcher executing an outbox mutation against the backend API.
 * Passes cryptographic idempotency key in the `X-Idempotency-Key` header.
 */
async function defaultMutationDispatcher(entry: OutboxMutationEntry): Promise<unknown> {
  return apiFetch(entry.endpoint, entry.method, entry.payload, {
    headers: {
      'X-Idempotency-Key': entry.idempotencyKey,
    },
  });
}

/**
 * Flushes all pending mutations in the offline outbox FIFO queue.
 *
 * Concurrency Safety:
 * - Uses W3C Web Locks (`flux:offline:sync:dispatcher`) to guarantee that only ONE tab
 *   dispatches requests at any given time across all open browser windows.
 * - If another tab is already flushing, this function safely yields without duplicate HTTP traffic.
 */
export async function flushOfflineOutbox(
  queryClient?: QueryClient,
  options: FlushOptions = {},
): Promise<FlushResult> {
  const { maxRetries = 3, dispatcher = defaultMutationDispatcher, onProgress } = options;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const currentCount = await getOutboxStorage().count();
    return {
      flushedCount: 0,
      failedCount: 0,
      remainingCount: currentCount,
      errors: [{ id: 'network', error: 'Browser is currently offline' }],
    };
  }

  if (isFlushingInCurrentProcess) {
    const count = await getOutboxStorage().count();
    return {
      flushedCount: 0,
      failedCount: 0,
      remainingCount: count,
      errors: [],
    };
  }

  // Multi-Tab Single-Leader Dispatcher via W3C Web Locks
  const lockResult = await withWebLock(
    OFFLINE_SYNC_LOCK_NAME,
    async () => {
      isFlushingInCurrentProcess = true;
      const storage = getOutboxStorage();
      const touchedScopes = new Set<string>();
      let flushedCount = 0;
      let failedCount = 0;
      const errors: Array<{ id: string; error: string }> = [];

      try {
        const queue = await storage.getAll();
        const total = queue.length;

        for (let i = 0; i < queue.length; i++) {
          const entry = queue[i];

          // Abort immediately if network dropped during queue dispatch
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            break;
          }

          try {
            await dispatcher(entry);

            // Successfully processed: remove from persistent outbox
            await storage.remove(entry.id);
            flushedCount++;
            touchedScopes.add(normalizeSpaceId(entry.spaceId));

            const remaining = await storage.count();
            notifyOutboxMutated('FLUSHED', remaining, entry.id);

            onProgress?.(i + 1, total);
          } catch (err: unknown) {
            const errorMsg =
              err instanceof Error
                ? err.message
                : isApiError(err)
                  ? err.message
                  : 'Mutation dispatch failed';

            if (isTransientNetworkError(err)) {
              // Transient failure (network offline, 503, timeout) -> increment retry, persist, and break queue
              entry.retryCount++;
              entry.lastError = errorMsg;
              await storage.update(entry);

              const remaining = await storage.count();
              notifyOutboxMutated('RETRY', remaining, entry.id);

              errors.push({ id: entry.id, error: errorMsg });
              // Stop processing remaining items to preserve FIFO sequence
              break;
            } else if (isFatalClientError(err) || entry.retryCount >= maxRetries) {
              // Non-retryable client error or retry bound exceeded: drop to prevent Head-of-Line poison pill
              await storage.remove(entry.id);
              failedCount++;
              errors.push({ id: entry.id, error: errorMsg });

              const remaining = await storage.count();
              notifyOutboxMutated('FAILED', remaining, entry.id);

              onProgress?.(i + 1, total);
            } else {
              // Generic error, increment retry and stop
              entry.retryCount++;
              entry.lastError = errorMsg;
              await storage.update(entry);
              errors.push({ id: entry.id, error: errorMsg });
              break;
            }
          }
        }

        // Surgical cache reconciliation if any mutations were applied
        if (flushedCount > 0 && queryClient) {
          for (const scope of touchedScopes) {
            void Promise.allSettled([
              queryClient.invalidateQueries({ queryKey: libraryKeys.syncVersion(scope) }),
              queryClient.invalidateQueries({ queryKey: itemKeys.all(scope) }),
              queryClient.invalidateQueries({ queryKey: collectionKeys.all(scope) }),
              queryClient.invalidateQueries({ queryKey: tagKeys.list(scope) }),
              queryClient.invalidateQueries({ queryKey: itemKeys.counts(scope) }),
            ]);
          }
        }

        const remainingCount = await storage.count();
        return {
          flushedCount,
          failedCount,
          remainingCount,
          errors,
        };
      } finally {
        isFlushingInCurrentProcess = false;
      }
    },
    { timeoutMs: 30_000, ifAvailable: true },
  );

  if (!lockResult) {
    // Another tab was actively holding the lock and processing the queue
    const count = await getOutboxStorage().count();
    return {
      flushedCount: 0,
      failedCount: 0,
      remainingCount: count,
      errors: [],
    };
  }

  return lockResult;
}

/**
 * Enqueues a mutation into the offline outbox with UUIDv7 ordering,
 * broadcasts the event to all open browser tabs, and triggers an immediate background flush if online.
 */
export async function enqueueOfflineMutation<T = unknown>(
  input: EnqueueMutationInput<T>,
  queryClient?: QueryClient,
  options?: { flushImmediately?: boolean },
): Promise<OutboxMutationEntry<T>> {
  const storage = getOutboxStorage();
  const entry = await storage.enqueue<T>(input);
  const count = await storage.count();

  notifyOutboxMutated('ENQUEUED', count, entry.id);

  const shouldFlush =
    options?.flushImmediately !== false &&
    typeof navigator !== 'undefined' &&
    navigator.onLine;

  if (shouldFlush) {
    // Fire-and-forget background flush protected by Web Lock
    void flushOfflineOutbox(queryClient).catch(() => {});
  }

  return entry;
}

registerOfflineMutationEnqueuer(enqueueOfflineMutation as unknown as Parameters<typeof registerOfflineMutationEnqueuer>[0]);

/**
 * React Hook for observing offline sync status, pending queue count across all tabs,
 * and triggering manual or auto-sync flushes.
 */
export function useOfflineSyncStatus(queryClient?: QueryClient) {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const queryClientRef = useRef(queryClient);
  useEffect(() => {
    queryClientRef.current = queryClient;
  }, [queryClient]);

  const refreshCount = useCallback(async () => {
    try {
      const count = await getOutboxStorage().count();
      setPendingCount(count);
    } catch {
      // ignore
    }
  }, []);

  const flushNow = useCallback(
    async (options?: FlushOptions): Promise<FlushResult> => {
      setIsSyncing(true);
      try {
        const result = await flushOfflineOutbox(queryClientRef.current, options);
        setLastSyncedAt(Date.now());
        if (result.errors.length > 0) {
          setLastError(result.errors[0].error);
        } else {
          setLastError(null);
        }
        await refreshCount();
        return result;
      } finally {
        setIsSyncing(false);
      }
    },
    [refreshCount],
  );

  useEffect(() => {
    void refreshCount();

    const handleOnline = () => {
      setIsOnline(true);
      void flushNow();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleLocalOutbox = (ev: Event) => {
      const customEv = ev as CustomEvent<{ count: number; action: string }>;
      if (typeof customEv.detail?.count === 'number') {
        setPendingCount(customEv.detail.count);
        if (customEv.detail.action === 'FAILED') {
          setLastError('Some mutations failed to sync');
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      window.addEventListener('flux:outbox:mutated', handleLocalOutbox);
    }

    const unsubBus = multiTabBus.subscribe((msg) => {
      if (msg.type === 'OFFLINE_OUTBOX_MUTATED') {
        setPendingCount(msg.count);
        if (msg.action === 'FAILED') {
          setLastError('Some mutations failed to sync');
        }
      }
    });

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('flux:outbox:mutated', handleLocalOutbox);
      }
      unsubBus();
    };
  }, [flushNow, refreshCount]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncedAt,
    lastError,
    flushNow,
  };
}

/**
 * Initializes a global listener that automatically flushes the outbox
 * whenever the browser comes back online, and syncs queue counts across tabs.
 */
export function initOfflineSyncAutoListener(queryClient: QueryClient): () => void {
  const handleOnline = () => {
    void flushOfflineOutbox(queryClient).catch(() => {});
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
  }

  // Initial check on startup if online
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    void flushOfflineOutbox(queryClient).catch(() => {});
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
    }
  };
}
