import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import {
  getOutboxStorage,
  setCustomOutboxStorageProvider,
  type OutboxMutationEntry,
} from '@/features/library/core/adapters/outbox-storage.adapter';
import {
  flushOfflineOutbox,
  enqueueOfflineMutation,
  useOfflineSyncStatus,
  OFFLINE_SYNC_LOCK_NAME,
} from '@/features/library/core/coordinator/offline-sync.coordinator';
import { multiTabBus, withWebLock } from '@/shared/lib/multi-tab';
import { ApiError } from '@/shared/types/api.types';

describe('Library Offline Mutation Outbox & Sync Coordinator', () => {
  let queryClient: QueryClient;

  beforeEach(async () => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    setCustomOutboxStorageProvider(null);
    await getOutboxStorage().clear();
  });

  afterEach(async () => {
    await getOutboxStorage().clear();
    vi.restoreAllMocks();
  });

  it('preserves strict chronological FIFO order via UUIDv7 keys', async () => {
    const storage = getOutboxStorage();

    // Enqueue 3 mutations in sequence
    const m1 = await storage.enqueue({
      spaceId: 'user',
      entityType: 'annotation',
      entityId: 'ann-1',
      action: 'CREATE',
      endpoint: '/api/v1/library/annotations',
      method: 'POST',
      payload: { color: 'yellow', text: 'First highlight' },
    });

    const m2 = await storage.enqueue({
      spaceId: 'user',
      entityType: 'annotation',
      entityId: 'ann-1',
      action: 'UPDATE',
      endpoint: '/api/v1/library/annotations/ann-1',
      method: 'PATCH',
      payload: { color: 'green' },
    });

    const m3 = await storage.enqueue({
      spaceId: 'user',
      entityType: 'item',
      entityId: 'item-1',
      action: 'UPDATE',
      endpoint: '/api/v1/library/items/item-1',
      method: 'PATCH',
      payload: { title: 'Updated Title' },
    });

    const all = await storage.getAll();
    expect(all).toHaveLength(3);
    expect(all[0].id).toBe(m1.id);
    expect(all[1].id).toBe(m2.id);
    expect(all[2].id).toBe(m3.id);

    // peekNext returns the earliest mutation
    const peeked = await storage.peekNext();
    expect(peeked?.id).toBe(m1.id);

    expect(await storage.count()).toBe(3);
  });

  it('dispatches mutations in FIFO sequence with idempotency keys and drains outbox', async () => {
    const dispatched: OutboxMutationEntry[] = [];
    const mockDispatcher = vi.fn().mockImplementation(async (entry: OutboxMutationEntry) => {
      dispatched.push(entry);
      return { success: true };
    });

    await enqueueOfflineMutation(
      {
        spaceId: 'user',
        entityType: 'annotation',
        entityId: 'ann-10',
        action: 'CREATE',
        endpoint: '/api/v1/library/annotations',
        method: 'POST',
        payload: { text: 'Note 1' },
      },
      queryClient,
      { flushImmediately: false },
    );

    await enqueueOfflineMutation(
      {
        spaceId: 'user',
        entityType: 'annotation',
        entityId: 'ann-11',
        action: 'CREATE',
        endpoint: '/api/v1/library/annotations',
        method: 'POST',
        payload: { text: 'Note 2' },
      },
      queryClient,
      { flushImmediately: false },
    );

    const result = await flushOfflineOutbox(queryClient, {
      dispatcher: mockDispatcher,
    });

    expect(result.flushedCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(result.remainingCount).toBe(0);
    expect(dispatched).toHaveLength(2);
    expect(dispatched[0].entityId).toBe('ann-10');
    expect(dispatched[1].entityId).toBe('ann-11');
    expect(dispatched[0].idempotencyKey).toBeDefined();

    // Outbox should be completely drained
    expect(await getOutboxStorage().count()).toBe(0);
  });

  it('stops queue and increments retry count on transient network failure without data loss', async () => {
    await enqueueOfflineMutation(
      {
        spaceId: 'user',
        entityType: 'item',
        entityId: 'item-100',
        action: 'UPDATE',
        endpoint: '/api/v1/library/items/item-100',
        method: 'PATCH',
        payload: { title: 'Network Test' },
      },
      queryClient,
      { flushImmediately: false },
    );

    await enqueueOfflineMutation(
      {
        spaceId: 'user',
        entityType: 'item',
        entityId: 'item-101',
        action: 'UPDATE',
        endpoint: '/api/v1/library/items/item-101',
        method: 'PATCH',
        payload: { title: 'Second In Line' },
      },
      queryClient,
      { flushImmediately: false },
    );

    const transientErrorDispatcher = vi.fn().mockImplementation(async () => {
      throw new ApiError({
        message: 'Network offline: connection refused',
        statusCode: 0,
        code: 'NETWORK_ERROR',
      });
    });

    const result = await flushOfflineOutbox(queryClient, {
      dispatcher: transientErrorDispatcher,
    });

    // Should halt on first error to prevent out-of-order execution
    expect(result.flushedCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.remainingCount).toBe(2);
    expect(transientErrorDispatcher).toHaveBeenCalledTimes(1);

    const remaining = await getOutboxStorage().getAll();
    expect(remaining).toHaveLength(2);
    expect(remaining[0].retryCount).toBe(1);
    expect(remaining[0].lastError).toContain('Network offline');
  });

  it('drops poison pill non-retryable 4xx client errors to prevent head-of-line blocking', async () => {
    // 1st mutation is invalid (e.g. 422 Unprocessable Entity)
    await enqueueOfflineMutation(
      {
        spaceId: 'user',
        entityType: 'item',
        entityId: 'bad-item',
        action: 'UPDATE',
        endpoint: '/api/v1/library/items/bad-item',
        method: 'PATCH',
        payload: { invalidField: true },
      },
      queryClient,
      { flushImmediately: false },
    );

    // 2nd mutation is valid
    await enqueueOfflineMutation(
      {
        spaceId: 'user',
        entityType: 'item',
        entityId: 'good-item',
        action: 'UPDATE',
        endpoint: '/api/v1/library/items/good-item',
        method: 'PATCH',
        payload: { title: 'Good Title' },
      },
      queryClient,
      { flushImmediately: false },
    );

    const dispatcher = vi.fn().mockImplementation(async (entry: OutboxMutationEntry) => {
      if (entry.entityId === 'bad-item') {
        throw new ApiError({
          message: 'Invalid payload format',
          statusCode: 422,
          code: 'UNPROCESSABLE_ENTITY',
        });
      }
      return { ok: true };
    });

    const result = await flushOfflineOutbox(queryClient, {
      dispatcher,
    });

    // Bad item is dropped (failedCount = 1), good item is flushed (flushedCount = 1)
    expect(result.flushedCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.remainingCount).toBe(0);

    const remaining = await getOutboxStorage().getAll();
    expect(remaining).toHaveLength(0);
  });

  it('broadcasts OFFLINE_OUTBOX_MUTATED events when queue mutates', async () => {
    const broadcastSpy = vi.spyOn(multiTabBus, 'broadcast');

    const entry = await enqueueOfflineMutation(
      {
        spaceId: 'user',
        entityType: 'tag',
        entityId: 'tag-1',
        action: 'CREATE',
        endpoint: '/api/v1/library/tags',
        method: 'POST',
        payload: { name: 'Machine Learning' },
      },
      queryClient,
      { flushImmediately: false },
    );

    expect(entry.id).toBeDefined();
    expect(broadcastSpy).toHaveBeenCalledWith({
      type: 'OFFLINE_OUTBOX_MUTATED',
      action: 'ENQUEUED',
      count: 1,
      mutationId: entry.id,
    });

    await flushOfflineOutbox(queryClient, {
      dispatcher: vi.fn().mockResolvedValue({ id: 'tag-1' }),
    });

    expect(broadcastSpy).toHaveBeenCalledWith({
      type: 'OFFLINE_OUTBOX_MUTATED',
      action: 'FLUSHED',
      count: 0,
      mutationId: entry.id,
    });
  });

  it('invalidates TanStack Query cache across affected scopes upon successful flush', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await enqueueOfflineMutation(
      {
        spaceId: 'user',
        entityType: 'item',
        entityId: 'item-sync-1',
        action: 'UPDATE',
        endpoint: '/api/v1/library/items/item-sync-1',
        method: 'PATCH',
        payload: { title: 'Synced Item' },
      },
      queryClient,
      { flushImmediately: false },
    );

    await flushOfflineOutbox(queryClient, {
      dispatcher: vi.fn().mockResolvedValue({ id: 'item-sync-1' }),
    });

    expect(invalidateSpy).toHaveBeenCalled();
    const calls = invalidateSpy.mock.calls.map((c) => (c[0] as { queryKey: readonly unknown[] }).queryKey);
    // Should invalidate syncVersion and items for user scope
    expect(calls.some((k) => k.includes('sync-version'))).toBe(true);
    expect(calls.some((k) => k.includes('items'))).toBe(true);
  });

  it('yields safely when another browser tab already holds the Web Lock', async () => {
    await enqueueOfflineMutation(
      {
        spaceId: 'user',
        entityType: 'tag',
        entityId: 'tag-lock-1',
        action: 'CREATE',
        endpoint: '/api/v1/library/tags',
        method: 'POST',
        payload: { name: 'Concurrent Tag' },
      },
      queryClient,
      { flushImmediately: false },
    );

    // Simulate Tab 1 acquiring and holding the WebLock
    let tab1Release!: () => void;
    const tab1HoldPromise = new Promise<void>((resolve) => {
      tab1Release = resolve;
    });

    // Start Tab 1 holding the lock
    const tab1Running = withWebLock(OFFLINE_SYNC_LOCK_NAME, async () => {
      await tab1HoldPromise;
      return 'tab1-finished';
    });

    // Now Tab 2 attempts to flush while Tab 1 is holding the lock
    // With ifAvailable: true, withWebLock returns null, and flushOfflineOutbox yields safely
    const tab2Result = await flushOfflineOutbox(queryClient, {
      dispatcher: vi.fn(),
    });

    // Tab 2 safely yielded without dispatching duplicate network requests
    expect(tab2Result.flushedCount).toBe(0);
    expect(tab2Result.remainingCount).toBe(1);

    // Release Tab 1 lock
    tab1Release();
    await tab1Running;
  });

  it('updates reactive state in useOfflineSyncStatus upon network transitions and bus events', async () => {
    const { result, unmount } = renderHook(() => useOfflineSyncStatus(queryClient));

    expect(result.current.isOnline).toBe(true);
    expect(result.current.pendingCount).toBe(0);

    // Simulate going offline
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isOnline).toBe(false);

    // Enqueue an item offline
    await act(async () => {
      await enqueueOfflineMutation(
        {
          spaceId: 'user',
          entityType: 'annotation',
          entityId: 'ann-offline',
          action: 'CREATE',
          endpoint: '/api/v1/library/annotations',
          method: 'POST',
          payload: { text: 'Offline note' },
        },
        queryClient,
        { flushImmediately: false },
      );
    });

    expect(result.current.pendingCount).toBe(1);

    // Simulate coming back online
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.isOnline).toBe(true);

    unmount();
  });
});
