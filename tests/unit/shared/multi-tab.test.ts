import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  getTabId,
  multiTabBus,
  withWebLock,
  isUuidV7,
  type MultiTabMessage,
} from '@/shared/lib/multi-tab';
import { tryRefresh, setAuthToken, removeAuthToken } from '@/shared/lib/api';
import {
  setLibraryStorageProvider,
  setLibrarySessionStorageProvider,
  loadReaderStorageState,
  saveReaderTabsToStorage,
  DEFAULT_READER_TABS,
  type StorageLike,
} from '@/features/library/core/adapters/local-storage.adapter';
import {
  patchItemAcrossScopeCaches,
  removeItemsFromScopeCaches,
  registerMultiTabQueryCacheSync,
} from '@/features/library/sdk/queries/cache-patcher.queries';
import { itemKeys, annotationKeys } from '@/features/library/sdk/query-keys';
import type { Item } from '@/features/library/types/core.types';

function createMemoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

function createValidJwt(sub: string, expOffsetSeconds = 3600): string {
  const exp = Math.floor(Date.now() / 1000) + expOffsetSeconds;
  const payload = btoa(JSON.stringify({ sub, exp }));
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.sig_${sub}_${exp}`;
}

describe('Browser Multi-Tab Coordination Architecture', () => {
  beforeEach(() => {
    multiTabBus.resetForTesting();
    setLibraryStorageProvider(null);
    setLibrarySessionStorageProvider(null);
    removeAuthToken();
    vi.restoreAllMocks();
  });

  describe('1. MultiTabBus & W3C Web Locks Coordinator (@/shared/lib/multi-tab)', () => {
    it('generates a stable tabId and filters out self-originated messages', () => {
      const id1 = getTabId();
      const id2 = getTabId();
      expect(id1).toBeTruthy();
      expect(id1).toBe(id2);
      expect(isUuidV7(id1)).toBe(true);

      const received: MultiTabMessage[] = [];
      const unsubscribe = multiTabBus.subscribe((msg) => {
        received.push(msg);
      });

      // Self-message must be ignored
      multiTabBus.dispatchSyntheticMessageForTesting({
        type: 'READER_TABS_SYNC',
        senderTabId: getTabId(),
        timestamp: Date.now(),
      });
      expect(received).toHaveLength(0);

      // Message from another tab must be delivered
      multiTabBus.dispatchSyntheticMessageForTesting({
        type: 'READER_TABS_SYNC',
        senderTabId: 'other-browser-tab-999',
        timestamp: Date.now(),
      });
      expect(received).toHaveLength(1);
      expect(received[0]?.type).toBe('READER_TABS_SYNC');

      unsubscribe();
    });

    it('serializes concurrent critical sections via withWebLock', async () => {
      const executionOrder: string[] = [];

      const task1 = withWebLock('flux:test:mutex', async () => {
        executionOrder.push('start-1');
        await new Promise((r) => setTimeout(r, 25));
        executionOrder.push('end-1');
        return 'res-1';
      });

      const task2 = withWebLock('flux:test:mutex', async () => {
        executionOrder.push('start-2');
        executionOrder.push('end-2');
        return 'res-2';
      });

      const [r1, r2] = await Promise.all([task1, task2]);
      expect(r1).toBe('res-1');
      expect(r2).toBe('res-2');
      // Strict mutual exclusion: task 2 cannot start before task 1 finishes
      expect(executionOrder).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
    });
  });

  describe('2. Auth Token Refresh Cross-Tab Double-Checked Locking (@/shared/lib/api)', () => {
    it('reuses the fresh token already acquired by a sibling tab without calling /auth/refresh again', async () => {
      const staleExpiredToken = createValidJwt('user-1', -60);
      const freshLeaderToken = createValidJwt('user-1', 3600);

      // Simulate Tab 1 having already refreshed and stored freshLeaderToken in localStorage
      // while Tab 2 was waiting for the 'flux:auth:refresh' Web Lock:
      setAuthToken(freshLeaderToken);

      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const result = await tryRefresh(staleExpiredToken);

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe(freshLeaderToken);
      expect(result.isSessionInvalid).toBe(false);
      // Zero network calls made by Follower Tab 2!
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('3. Reader & Library Storage Split-Brain Prevention', () => {
    it('prevents a stale browser tab from clobbering tabs opened in another browser tab (Read-Modify-Write Merge)', () => {
      const sharedLocalStorage = createMemoryStorage();
      const tab1SessionStorage = createMemoryStorage();
      const tab2SessionStorage = createMemoryStorage();

      setLibraryStorageProvider(sharedLocalStorage);

      // 1. Browser Tab 1 opens Paper A
      const tab1Initial = [
        DEFAULT_READER_TABS[0],
        {
          id: 'paper-a',
          title: 'Paper A',
          type: 'paper' as const,
          currentPage: 1,
          zoom: 1,
          fitMode: 'fit-width' as const,
          rotation: 0,
          theme: 'normal' as const,
        },
      ];
      saveReaderTabsToStorage(tab1Initial, 'paper-a', sharedLocalStorage, {
        sessionStorage: tab1SessionStorage,
      });

      // 2. Browser Tab 2 opens Paper B (persisted to shared localStorage)
      const tab2Tabs = [
        ...tab1Initial,
        {
          id: 'paper-b',
          title: 'Paper B',
          type: 'paper' as const,
          currentPage: 1,
          zoom: 1,
          fitMode: 'fit-width' as const,
          rotation: 0,
          theme: 'normal' as const,
        },
      ];
      saveReaderTabsToStorage(tab2Tabs, 'paper-b', sharedLocalStorage, {
        sessionStorage: tab2SessionStorage,
      });

      // 3. Browser Tab 1 (whose in-memory array still only knows about 'paper-a') scrolls to page 5
      const tab1StaleScrollUpdate = [
        DEFAULT_READER_TABS[0],
        {
          id: 'paper-a',
          title: 'Paper A',
          type: 'paper' as const,
          currentPage: 5,
          zoom: 1,
          fitMode: 'fit-width' as const,
          rotation: 0,
          theme: 'normal' as const,
        },
      ];
      const mergedAfterTab1Save = saveReaderTabsToStorage(
        tab1StaleScrollUpdate,
        'paper-a',
        sharedLocalStorage,
        { sessionStorage: tab1SessionStorage },
      );

      // Paper B opened in Tab 2 must NOT be lost!
      expect(mergedAfterTab1Save.map((t) => t.id)).toEqual(['library', 'paper-a', 'paper-b']);
      expect(mergedAfterTab1Save.find((t) => t.id === 'paper-a')?.currentPage).toBe(5);

      // 4. Window-scoped activeTabId via sessionStorage:
      // Tab 1 stays focused on 'paper-a' while Tab 2 stays focused on 'paper-b'!
      const hydratedTab1 = loadReaderStorageState(sharedLocalStorage, tab1SessionStorage);
      const hydratedTab2 = loadReaderStorageState(sharedLocalStorage, tab2SessionStorage);
      expect(hydratedTab1.activeTabId).toBe('paper-a');
      expect(hydratedTab2.activeTabId).toBe('paper-b');
    });
  });

  describe('4. Surgical Cross-Tab TanStack Query Cache Synchronization', () => {
    it('propagates item patches, deletions, and annotation invalidations across browser tabs', () => {
      const tab2QueryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      const spaceId = 'user';
      const paper1: Item = {
        id: 'item-1',
        title: 'Attention Is All You Need',
        itemType: 'journalArticle',
        isStarred: false,
      } as Item;
      const paper2: Item = {
        id: 'item-2',
        title: 'ResNet',
        itemType: 'journalArticle',
        isStarred: false,
      } as Item;

      tab2QueryClient.setQueryData(itemKeys.byId(spaceId, 'item-1'), paper1);
      tab2QueryClient.setQueryData(itemKeys.byView(spaceId, 'all'), {
        items: [paper1, paper2],
        total: 2,
      });

      const cleanup = registerMultiTabQueryCacheSync(tab2QueryClient);

      // 1. Simulate Tab 1 starring 'item-1'
      multiTabBus.dispatchSyntheticMessageForTesting({
        type: 'LIBRARY_ITEM_PATCHED',
        spaceId,
        itemId: 'item-1',
        patch: { isStarred: true, title: 'Attention Is All You Need (Updated)' },
        senderTabId: 'tab-1',
        timestamp: Date.now(),
      });

      const updatedInTab2 = tab2QueryClient.getQueryData<Item>(itemKeys.byId(spaceId, 'item-1'));
      expect(updatedInTab2?.isStarred).toBe(true);
      expect(updatedInTab2?.title).toBe('Attention Is All You Need (Updated)');

      // 2. Simulate Tab 1 deleting 'item-1'
      multiTabBus.dispatchSyntheticMessageForTesting({
        type: 'LIBRARY_ITEMS_DELETED',
        spaceId,
        itemIds: ['item-1'],
        senderTabId: 'tab-1',
        timestamp: Date.now(),
      });

      const listInTab2 = tab2QueryClient.getQueryData<{ items: Item[]; total: number }>(
        itemKeys.byView(spaceId, 'all'),
      );
      expect(listInTab2?.items.map((i) => i.id)).toEqual(['item-2']);
      expect(listInTab2?.total).toBe(1);

      // 3. Simulate Tab 1 mutating annotations on 'att-99'
      const invalidateSpy = vi.spyOn(tab2QueryClient, 'invalidateQueries');
      multiTabBus.dispatchSyntheticMessageForTesting({
        type: 'READER_ANNOTATIONS_CHANGED',
        spaceId,
        attachmentId: 'att-99',
        senderTabId: 'tab-1',
        timestamp: Date.now(),
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: annotationKeys.byAttachment(spaceId, 'att-99'),
      });

      cleanup();
    });

    it('publishes cross-tab events when local patchItemAcrossScopeCaches or removeItemsFromScopeCaches runs', () => {
      const tab1QueryClient = new QueryClient();
      const publishSpy = vi.spyOn(multiTabBus, 'publish');

      patchItemAcrossScopeCaches(tab1QueryClient, 'user', 'item-77', { isStarred: true });
      expect(publishSpy).toHaveBeenCalledWith({
        type: 'LIBRARY_ITEM_PATCHED',
        spaceId: 'user',
        itemId: 'item-77',
        patch: { isStarred: true },
      });

      removeItemsFromScopeCaches(tab1QueryClient, 'user', ['item-77']);
      expect(publishSpy).toHaveBeenCalledWith({
        type: 'LIBRARY_ITEMS_DELETED',
        spaceId: 'user',
        itemIds: ['item-77'],
        permanent: undefined,
      });
    });
  });
});
