import { describe, it, expect } from 'vitest';
import {
  LruTabPool,
  calculateAdaptiveTabPoolCapacity,
  DEFAULT_ZOTERO_WARM_TAB_CAPACITY,
  warmViewerPool,
} from '@/features/library/domain/reader/tab-pool';
import { normalizeReaderTab } from '@/features/library/core/adapters/local-storage.adapter';
import { useReaderStore } from '@/features/library/core/store/reader.store';
import { cleanupReaderResourcesForItems } from '@/features/library/core/coordinator/reader/use-reader';

describe('Reader Tab Pool & Lifecycle Cleanup', () => {
  describe('LruTabPool Capacity & Protected Eviction', () => {
    it('scales warm tab pool capacity from Zotero 5-tab baseline based on device RAM', () => {
      const defaultPool = new LruTabPool();
      expect(defaultPool.capacity).toBe(DEFAULT_ZOTERO_WARM_TAB_CAPACITY);
      expect(calculateAdaptiveTabPoolCapacity(undefined)).toBe(5);
      expect(calculateAdaptiveTabPoolCapacity(4)).toBe(5);
      expect(calculateAdaptiveTabPoolCapacity(2)).toBe(3);
      expect(calculateAdaptiveTabPoolCapacity(8)).toBe(8);
      expect(calculateAdaptiveTabPoolCapacity(16)).toBe(8);
    });

    it('maintains capacity bounds, evicts LRU item, and never evicts protected tabs', () => {
      const pool = new LruTabPool<{ title: string }>(3);
      pool.put('paper-1', { title: 'Deep Learning' });
      pool.put('paper-2', { title: 'Transformers' });
      pool.put('paper-3', { title: 'Diffusion Models' });

      expect(pool.size).toBe(3);
      expect(pool.getKeysMruOrder()).toEqual(['paper-3', 'paper-2', 'paper-1']);

      pool.get('paper-1');
      expect(pool.getKeysMruOrder()).toEqual(['paper-1', 'paper-3', 'paper-2']);

      const evicted = pool.put('paper-4', { title: 'Mamba Architecture' });
      expect(evicted).toBe('paper-2');
      expect(pool.has('paper-2')).toBe(false);
      expect(pool.getKeysMruOrder()).toEqual(['paper-4', 'paper-1', 'paper-3']);

      const protectedPool = new LruTabPool<{ title: string }>(3);
      protectedPool.put('library', { title: 'Library' });
      protectedPool.put('paper-a', { title: 'Paper A' });
      protectedPool.put('paper-b', { title: 'Paper B' });

      const evictedProtected = protectedPool.put(
        'paper-c',
        { title: 'Paper C' },
        new Set(['library', 'paper-a']),
      );
      expect(evictedProtected).toBe('paper-b');
      expect(protectedPool.has('library')).toBe(true);
      expect(protectedPool.has('paper-a')).toBe(true);
      expect(protectedPool.has('paper-c')).toBe(true);
    });
  });

  describe('ScrollTop Normalization & Cross-Module Resource Cleanup', () => {
    it('normalizes scrollTop coordinates and rejects negative values', () => {
      const normalized = normalizeReaderTab({
        id: 'paper-scroll-test',
        title: 'Quantum Computing',
        type: 'paper',
        currentPage: 5,
        scrollTop: 1450.7,
      });
      expect(normalized.scrollTop).toBe(1451);

      const invalid = normalizeReaderTab({
        id: 'paper-scroll-invalid',
        title: 'Quantum Computing',
        type: 'paper',
        currentPage: 1,
        scrollTop: -200,
      });
      expect(invalid.scrollTop).toBeUndefined();
    });

    it('closes open tabs and evicts warmViewerPool entries when items are trashed or purged', () => {
      useReaderStore.getState().openReader('paper-gc-1', 'GC Test Paper 1');
      useReaderStore.getState().updateTabState('paper-gc-1', {
        fileUrl: '/api/v1/library/files/file-gc-1/content',
      });
      warmViewerPool.put('paper-gc-1', {
        paperId: 'paper-gc-1',
        title: 'GC Test Paper 1',
        fileUrl: '/api/v1/library/files/file-gc-1/content',
      });

      expect(useReaderStore.getState().tabs.some((t) => t.id === 'paper-gc-1')).toBe(true);
      expect(warmViewerPool.has('paper-gc-1')).toBe(true);

      cleanupReaderResourcesForItems(['paper-gc-1'], { spaceId: 'user' });

      expect(useReaderStore.getState().tabs.some((t) => t.id === 'paper-gc-1')).toBe(false);
      expect(warmViewerPool.has('paper-gc-1')).toBe(false);
    });
  });
});
