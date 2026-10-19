import { describe, it, expect, beforeEach } from 'vitest';
import { useFeedsStore } from '@/features/library/core/store/feeds.store';
import { mapFeedEntryToCreateItemPayload, type ParsedFeedEntry } from '@/features/library/domain/feed-parser.domain';

describe('Feeds Enhancements: Read Tracking, Abstract Expand, Direct PDF, Save to Collection, Retention', () => {
  beforeEach(() => {
    // Reset Zustand store state before each test
    useFeedsStore.setState({
      feeds: [],
      activeFeedId: null,
      refreshCounter: 0,
      readEntryIds: new Set<string>(),
    });
  });

  describe('Feature 1: Unread / Read State Tracking and Read Counter', () => {
    it('initializes with an empty read set and correctly checks read state', () => {
      const store = useFeedsStore.getState();
      expect(store.isEntryRead('entry-1')).toBe(false);
      expect(store.readEntryIds.size).toBe(0);
    });

    it('marks a single entry as read', () => {
      const { markEntryAsRead, isEntryRead } = useFeedsStore.getState();
      markEntryAsRead('entry-1');

      expect(isEntryRead('entry-1')).toBe(true);
      expect(isEntryRead('entry-2')).toBe(false);
    });

    it('toggles an entry between read and unread', () => {
      const { toggleEntryRead, isEntryRead } = useFeedsStore.getState();

      toggleEntryRead('entry-1');
      expect(isEntryRead('entry-1')).toBe(true);

      toggleEntryRead('entry-1');
      expect(isEntryRead('entry-1')).toBe(false);
    });

    it('marks all entries as read in batch', () => {
      const { markAllEntriesAsRead, isEntryRead } = useFeedsStore.getState();
      const ids = ['entry-1', 'entry-2', 'entry-3'];

      markAllEntriesAsRead(ids);

      expect(isEntryRead('entry-1')).toBe(true);
      expect(isEntryRead('entry-2')).toBe(true);
      expect(isEntryRead('entry-3')).toBe(true);
      expect(isEntryRead('entry-4')).toBe(false);
    });
  });

  describe('Feature 4: Dropdown "Save to Collection..."', () => {
    const mockFeedEntry: ParsedFeedEntry = {
      id: 'arxiv-2402.17764',
      title: 'The Era of 1-bit LLMs',
      authors: ['Shuming Ma', 'Hongyu Wang'],
      feedFormat: 'atom',
      doi: '10.48550/arXiv.2402.17764',
      arxivId: '2402.17764',
      pdfUrl: 'https://arxiv.org/pdf/2402.17764.pdf',
      abstract: 'Recent research on 1-bit & ternary quantization opens a new scaling paradigm.',
      categories: ['cs.CL', 'cs.AI'],
      year: 2024,
    };

    it('maps feed entry to root library when no collectionId is provided', () => {
      const payload = mapFeedEntryToCreateItemPayload(mockFeedEntry, {
        scopeId: 'user',
      });

      expect(payload.title).toBe('The Era of 1-bit LLMs');
      expect(payload.scopeId).toBe('user');
      expect(payload.collectionId).toBeUndefined();
      expect(payload.collectionIds).toEqual([]);
    });

    it('maps feed entry with specific target collectionId when selected from dropdown', () => {
      const payload = mapFeedEntryToCreateItemPayload(mockFeedEntry, {
        scopeId: 'proj-123',
        collectionId: 'col-deep-learning',
      });

      expect(payload.title).toBe('The Era of 1-bit LLMs');
      expect(payload.scopeId).toBe('proj-123');
      expect(payload.collectionId).toBe('col-deep-learning');
      expect(payload.collectionIds).toEqual(['col-deep-learning']);
    });
  });

  describe('Feature 5: Feed Retention (Filtering and Configuration)', () => {
    it('creates feed with specified retentionDays or defaults to 30', () => {
      const { addFeed } = useFeedsStore.getState();

      const feed1 = addFeed('Nature AI', 'https://www.nature.com/subjects/machine-learning.rss', 14);
      expect(feed1.retentionDays).toBe(14);

      const feed2 = addFeed('arXiv AI', 'https://arxiv.org/rss/cs.AI');
      expect(feed2.retentionDays).toBe(30);
    });

    it('updates retentionDays via updateFeed', () => {
      const { addFeed, updateFeed } = useFeedsStore.getState();
      const feed = addFeed('ArXiv QC', 'https://arxiv.org/rss/quant-ph', 30);

      updateFeed(feed.id, { retentionDays: 7 });

      const updated = useFeedsStore.getState().feeds.find((f) => f.id === feed.id);
      expect(updated?.retentionDays).toBe(7);
    });

    it('filters out entries older than retention cutoff while preserving recent ones', () => {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;

      const entries: ParsedFeedEntry[] = [
        {
          id: 'fresh-1',
          title: 'Paper published 2 days ago',
          authors: ['Author A'],
          feedFormat: 'rss2',
          publishedAt: new Date(now - 2 * dayMs).toISOString(),
        },
        {
          id: 'fresh-2',
          title: 'Paper published 10 days ago',
          authors: ['Author B'],
          feedFormat: 'rss2',
          publishedAt: new Date(now - 10 * dayMs).toISOString(),
        },
        {
          id: 'old-1',
          title: 'Paper published 45 days ago',
          authors: ['Author C'],
          feedFormat: 'rss2',
          publishedAt: new Date(now - 45 * dayMs).toISOString(),
        },
        {
          id: 'undated',
          title: 'Paper with missing published date',
          authors: ['Author D'],
          feedFormat: 'rss2',
        },
      ];

      // Retention: 14 days
      const retentionDays = 14;
      const cutoff = now - retentionDays * dayMs;

      const filtered = entries.filter((e) => {
        if (!e.publishedAt) return true;
        const t = Date.parse(e.publishedAt);
        if (isNaN(t)) return true;
        return t >= cutoff;
      });

      expect(filtered.map((e) => e.id)).toEqual(['fresh-1', 'fresh-2', 'undated']);
    });

    it('retains all entries if retentionDays is 0 or negative (keep forever)', () => {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;

      const entries: ParsedFeedEntry[] = [
        {
          id: 'ancient',
          title: 'Paper from 2 years ago',
          authors: ['Ancient Author'],
          feedFormat: 'rss2',
          publishedAt: new Date(now - 730 * dayMs).toISOString(),
        },
      ];

      const retentionDays = 0; // Never delete
      const filtered = retentionDays && retentionDays > 0
        ? entries.filter((e) => {
            if (!e.publishedAt) return true;
            const t = Date.parse(e.publishedAt);
            if (isNaN(t)) return true;
            return t >= now - retentionDays * dayMs;
          })
        : entries;

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.id).toBe('ancient');
    });
  });
});
