import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sanitizeItemPayload,
  ItemsService as ItemService,
  CurationService as QualityService,
  SyncService,
  FeedsService,
} from '@/features/library/sdk/library.client';
import * as api from '@/shared/lib/api';

describe('Library Module — Client Zero-Trust & Sanitization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'apiGet').mockImplementation(vi.fn() as any);
    vi.spyOn(api, 'apiPost').mockImplementation(vi.fn() as any);
    vi.spyOn(api, 'apiPatch').mockImplementation(vi.fn() as any);
    vi.spyOn(api, 'apiPut').mockImplementation(vi.fn() as any);
    vi.spyOn(api, 'apiDelete').mockImplementation(vi.fn() as any);
    vi.spyOn(api, 'getAuthToken').mockReturnValue('mock-token');
  });

  describe('sanitizeItemPayload (Client Boundary Filter)', () => {
    it('should strip client-internal underscore keys and functions from payload', () => {
      const rawPayload = {
        title: 'Deep Learning',
        doi: '10.1145/12345',
        itemType: 'journalArticle',
        expectedVersion: 3,
        _isProcessing: true,
        _optimisticId: 'temp-1',
        onClick: () => {},
      };

      const cleaned = sanitizeItemPayload(rawPayload);

      expect(cleaned).toHaveProperty('title', 'Deep Learning');
      expect(cleaned).toHaveProperty('doi', '10.1145/12345');
      expect(cleaned).toHaveProperty('itemType', 'journalArticle');
      expect(cleaned).toHaveProperty('expectedVersion', 3);
      expect(cleaned).not.toHaveProperty('_isProcessing');
      expect(cleaned).not.toHaveProperty('_optimisticId');
      expect(cleaned).not.toHaveProperty('onClick');
    });

    it('should strip undefined values but preserve null/false/0', () => {
      const rawPayload = {
        title: 'Valid Paper',
        year: 2024,
        citationCount: 0,
        abstract: undefined,
        collectionId: null,
      };

      const cleaned = sanitizeItemPayload(rawPayload);

      expect(cleaned).toHaveProperty('title', 'Valid Paper');
      expect(cleaned).toHaveProperty('year', 2024);
      expect(cleaned).toHaveProperty('citationCount', 0);
      expect(cleaned).toHaveProperty('collectionId', null);
      expect(cleaned).not.toHaveProperty('abstract');
    });

    it('should handle empty, null, or non-object inputs gracefully', () => {
      expect(sanitizeItemPayload(null as any)).toEqual({});
      expect(sanitizeItemPayload(undefined as any)).toEqual({});
      expect(sanitizeItemPayload('string' as any)).toEqual({});
    });
  });

  describe('ItemService — Scope Routing & Optimistic Concurrency', () => {
    it('should route personal library item requests to user endpoint', async () => {
      vi.mocked(api.apiGet).mockResolvedValueOnce({
        items: [{ id: 'item-1', title: 'Paper 1' }],
        pagination: { totalCount: 1 },
      });

      await ItemService.getAll('user');

      expect(api.apiGet).toHaveBeenCalledWith(
        '/api/v1/library/items',
        expect.anything(),
      );
    });

    it('should route project library item requests to project scoped endpoint', async () => {
      const projectId = 'proj-999';
      vi.mocked(api.apiGet).mockResolvedValueOnce({
        items: [{ id: 'item-2', title: 'Paper 2' }],
        pagination: { totalCount: 1 },
      });

      await ItemService.getAll(projectId);

      expect(api.apiGet).toHaveBeenCalledWith(
        `/api/v1/projects/${projectId}/library/items`,
        expect.anything(),
      );
    });

    it('should forward sorting, filter, and cursor parameters in query params', async () => {
      vi.mocked(api.apiGet).mockResolvedValueOnce({
        items: [{ id: 'item-3', title: 'Paper 3', year: 2024 }],
        pagination: {
          totalCount: 150,
          limit: 50,
          hasNextPage: true,
          nextCursor: 'cursor-abc',
        },
      });

      const res = await ItemService.getAll('user', {
        orderBy: 'year',
        orderDirection: 'desc',
        fromYear: 2020,
        toYear: 2025,
        readStatus: 'unread',
        cursor: 'cursor-xyz',
      });

      expect(api.apiGet).toHaveBeenCalledWith(
        '/api/v1/library/items',
        {
          params: expect.objectContaining({
            orderBy: 'year',
            orderDirection: 'desc',
            fromYear: 2020,
            toYear: 2025,
            readStatus: 'unread',
            cursor: 'cursor-xyz',
          }),
        },
      );
      expect(res.total).toBe(150);
      expect(res.pagination?.hasNextPage).toBe(true);
      expect(res.pagination?.nextCursor).toBe('cursor-abc');
      expect(res.items).toHaveLength(1);
    });

    it('should include expectedVersion in update payload for optimistic locking', async () => {
      vi.mocked(api.apiPatch).mockResolvedValueOnce({
        id: 'item-1',
        title: 'Updated Paper',
        version: 5,
      });

      await ItemService.update('user', 'item-1', { title: 'Updated Paper' }, 4);

      expect(api.apiPatch).toHaveBeenCalledWith(
        '/api/v1/library/items/item-1',
        expect.objectContaining({
          title: 'Updated Paper',
          expectedVersion: 4,
        }),
      );
    });
  });

  describe('QualityService (Duplicate Detection)', () => {
    it('should route to project curation duplicates endpoint when workspaceId is specified', async () => {
      vi.mocked(api.apiGet).mockResolvedValueOnce([
        {
          clusterId: 'doi-10-1038',
          matchReason: 'EXACT_DOI',
          confidence: 1.0,
          items: [
            { id: 'p1', title: 'Paper A', doi: '10.1038/1' },
            { id: 'p2', title: 'Paper A Copy', doi: '10.1038/1' },
          ],
        },
      ]);

      const res = await QualityService.getDuplicates('workspace-42');

      expect(api.apiGet).toHaveBeenCalledWith(
        '/api/v1/projects/workspace-42/library/curation/duplicates',
      );
      expect(res.duplicateGroups).toHaveLength(1);
      expect(res.duplicateGroups[0].matchType).toBe('DOI');
      expect(res.duplicateGroups[0].confidence).toBe('high');
      expect(res.totalDuplicates).toBe(2);
    });

    it('should not pass projectId when workspaceId is user or empty', async () => {
      vi.mocked(api.apiGet).mockResolvedValueOnce([]);

      await QualityService.getDuplicates('user');

      expect(api.apiGet).toHaveBeenCalledWith(
        '/api/v1/library/curation/duplicates',
      );
    });
  });

  describe('ItemService — Academic Metadata Provenance', () => {
    it('should query metadata sources endpoint for personal item', async () => {
      vi.mocked(api.apiGet).mockResolvedValueOnce({
        itemId: 'item-123',
        count: 2,
        sources: [
          {
            id: 'src-1',
            sourceProvider: 'arXiv',
            sourceUri: 'arxiv:2301.00001',
            fetchedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      });

      const res = await ItemService.getMetadataSources('user', 'item-123');

      expect(api.apiGet).toHaveBeenCalledWith(
        '/api/v1/library/items/item-123/metadata-sources',
      );
      expect(res.count).toBe(2);
      expect(res.sources[0].sourceProvider).toBe('arXiv');
    });

    it('should query metadata sources endpoint with project scope', async () => {
      vi.mocked(api.apiGet).mockResolvedValueOnce({
        itemId: 'item-456',
        count: 1,
        sources: [],
      });

      await ItemService.getMetadataSources('proj-777', 'item-456');

      expect(api.apiGet).toHaveBeenCalledWith(
        '/api/v1/projects/proj-777/library/items/item-456/metadata-sources',
      );
    });
  });

  describe('SyncService — Distributed Replication CDC', () => {
    it('should fetch sync version for user scope', async () => {
      vi.mocked(api.apiGet).mockResolvedValueOnce({
        version: '42',
        scope: 'user',
        scopeId: 'user-1',
      });

      const res = await SyncService.getVersion('user');

      expect(api.apiGet).toHaveBeenCalledWith(
        '/api/v1/library/sync/version',
      );
      expect(res.version).toBe('42');
    });

    it('should fetch sync version for project scope', async () => {
      vi.mocked(api.apiGet).mockResolvedValueOnce({
        version: '100',
        scope: 'project',
        scopeId: 'proj-42',
      });

      await SyncService.getVersion('proj-42');

      expect(api.apiGet).toHaveBeenCalledWith(
        '/api/v1/projects/proj-42/library/sync/version',
      );
    });

    it('should fetch CDC changes with since and limit parameters', async () => {
      vi.mocked(api.apiGet).mockResolvedValueOnce({
        since: '5',
        count: 1,
        hasMore: false,
        changes: [
          {
            id: 'ch-1',
            seq: '6',
            entityType: 'item',
            entityId: 'item-1',
            action: 'create',
            version: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      });

      const res = await SyncService.getChanges('proj-42', { since: '5', limit: 50 });

      expect(api.apiGet).toHaveBeenCalledWith(
        '/api/v1/projects/proj-42/library/sync/changes',
        {
          params: {
            since: '5',
            limit: 50,
          },
        },
      );
      expect(res.changes).toHaveLength(1);
      expect(res.changes[0].action).toBe('create');
    });

    it('should fetch tombstones with since parameter', async () => {
      vi.mocked(api.apiGet).mockResolvedValueOnce({
        since: '10',
        count: 1,
        hasMore: false,
        tombstones: [
          {
            id: 'tb-1',
            seq: '11',
            entityType: 'item',
            entityId: 'item-99',
            deletedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      });

      const res = await SyncService.getTombstones('user', { since: '10' });

      expect(api.apiGet).toHaveBeenCalledWith(
        '/api/v1/library/sync/tombstones',
        {
          params: {
            since: '10',
            limit: 100,
          },
        },
      );
      expect(res.tombstones).toHaveLength(1);
      expect(res.tombstones[0].entityId).toBe('item-99');
    });
  });

  describe('FeedsService — API Prefix & Scope Resolution', () => {
    it('should include /api/v1/library/feeds prefix for all feed operations', async () => {
      vi.mocked(api.apiGet).mockResolvedValueOnce({ data: [] });
      await FeedsService.getSubscriptions();
      expect(api.apiGet).toHaveBeenCalledWith(
        '/api/v1/library/feeds/subscriptions',
      );

      vi.mocked(api.apiPost).mockResolvedValueOnce({ data: { id: 'sub-1' } });
      await FeedsService.subscribe({ url: 'https://arxiv.org/rss/cs.AI' });
      expect(api.apiPost).toHaveBeenCalledWith(
        '/api/v1/library/feeds/subscriptions',
        { url: 'https://arxiv.org/rss/cs.AI' },
      );

      vi.mocked(api.apiPost).mockResolvedValueOnce({ success: true });
      await FeedsService.markItemRead('feed-item-1', true);
      expect(api.apiPost).toHaveBeenCalledWith(
        '/api/v1/library/feeds/items/feed-item-1/read',
        { isRead: true },
      );
    });
  });

  describe('LDE3 Domain, Store & SDK Architectural Invariants', () => {
    it('recognizes item.isMyPublication in isItemInMyPublications and projects it in mapBackendItem', async () => {
      const { isItemInMyPublications } = await import('@/features/library/domain/system-views.policy');
      const { mapBackendItem } = await import('@/features/library/domain/metadata-mapper');

      expect(isItemInMyPublications({ id: '1', title: 'A', isMyPublication: true })).toBe(true);
      expect(isItemInMyPublications({ id: '2', title: 'B', isInMyPublications: true })).toBe(true);
      expect(isItemInMyPublications({ id: '3', title: 'C', isMyPublication: false })).toBe(false);

      const mapped = mapBackendItem({
        id: 'pub-1',
        title: 'My Authored Paper',
        itemType: 'journalArticle',
        isMyPublication: true,
      });
      expect(mapped.isMyPublication).toBe(true);
      expect(mapped.isInMyPublications).toBe(true);
      expect(isItemInMyPublications(mapped)).toBe(true);
    });

    it('normalizes canonical CSL citation style IDs across domain and CitationService', async () => {
      const { normalizeCitationStyleId, CANONICAL_CSL_STYLE_IDS } = await import(
        '@/features/library/domain/citations'
      );
      const { CitationService } = await import(
        '@/features/library/sdk/clients/citation-extraction.client'
      );

      expect(CANONICAL_CSL_STYLE_IDS).toContain('apa-7th');
      expect(CANONICAL_CSL_STYLE_IDS).toContain('chicago-author-date');
      expect(normalizeCitationStyleId('apa')).toBe('apa-7th');
      expect(normalizeCitationStyleId('chicago')).toBe('chicago-author-date');
      expect(normalizeCitationStyleId(undefined)).toBe('apa-7th');

      vi.mocked(api.apiGet).mockResolvedValueOnce({
        itemId: 'item-1',
        style: 'apa-7th',
        citation: 'Formatted APA 7th',
      });
      await CitationService.formatCitation('user', 'item-1', 'apa');
      expect(api.apiGet).toHaveBeenCalledWith(
        '/api/v1/library/citation/items/item-1/citation?style=apa-7th&index=1',
      );
    });

    it('toggles inspector closed when toggleInspectorTab is called with the already-open tab and enforces unified width bounds', async () => {
      const {
        useLibraryUIStore,
        MIN_INSPECTOR_WIDTH,
        MAX_INSPECTOR_WIDTH,
      } = await import('@/features/library/core/store/library-ui.store');

      expect(MIN_INSPECTOR_WIDTH).toBe(260);
      expect(MAX_INSPECTOR_WIDTH).toBe(640);

      useLibraryUIStore.setState({ isInspectorOpen: true, activeInspectorTab: 'info' });
      useLibraryUIStore.getState().toggleInspectorTab('info');
      expect(useLibraryUIStore.getState().isInspectorOpen).toBe(false);

      useLibraryUIStore.getState().toggleInspectorTab('info');
      expect(useLibraryUIStore.getState().isInspectorOpen).toBe(true);
      expect(useLibraryUIStore.getState().activeInspectorTab).toBe('info');

      useLibraryUIStore.getState().toggleInspectorTab('notes');
      expect(useLibraryUIStore.getState().isInspectorOpen).toBe(true);
      expect(useLibraryUIStore.getState().activeInspectorTab).toBe('notes');

      useLibraryUIStore.getState().setInspectorWidth(100);
      expect(useLibraryUIStore.getState().inspectorWidth).toBe(260);
      useLibraryUIStore.getState().setInspectorWidth(900);
      expect(useLibraryUIStore.getState().inspectorWidth).toBe(640);
    });

    it('eliminates N+1 getById calls in CurationService.getDuplicates by hydrating from cachedItemsById or batch getAll', async () => {
      const cachedMap = new Map<string, any>([
        ['item-a', { id: 'item-a', title: 'Cached Paper A', itemType: 'journalArticle' }],
        ['item-b', { id: 'item-b', title: 'Cached Paper B', itemType: 'journalArticle' }],
      ]);

      vi.mocked(api.apiGet).mockResolvedValueOnce({
        clusters: [
          {
            clusterId: 'dup-1',
            matchReason: 'EXACT_DOI',
            confidence: 0.99,
            items: [{ itemId: 'item-a' }, { itemId: 'item-b' }],
          },
        ],
      });

      const res = await QualityService.getDuplicates('user', { cachedItemsById: cachedMap });
      expect(res.duplicateGroups).toHaveLength(1);
      expect(res.duplicateGroups[0].items.map((i) => i.id)).toEqual(['item-a', 'item-b']);
      expect(res.duplicateGroups[0].items.map((i) => i.title)).toEqual([
        'Cached Paper A',
        'Cached Paper B',
      ]);
      // Only 1 GET call to /duplicates, zero N+1 /items/:id calls
      expect(api.apiGet).toHaveBeenCalledTimes(1);
    });
  });
});


