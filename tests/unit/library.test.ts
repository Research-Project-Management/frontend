import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sanitizeItemPayload,
  ItemService,
} from '@/features/library/services/items.service';
import { QualityService } from '@/features/library/services/curation.service';
import * as api from '@/shared/lib/api';

vi.mock('@/shared/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  getAuthToken: vi.fn().mockReturnValue('mock-token'),
}));

describe('Library Module — Client Zero-Trust & Sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sanitizeItemPayload (Client Boundary Filter)', () => {
    it('should strip disallowed / injection keys from payload', () => {
      const rawPayload = {
        title: 'Deep Learning',
        doi: '10.1145/12345',
        itemType: 'journalArticle',
        expectedVersion: 3,
        __proto__: { polluted: true },
        isAdmin: true,
        secretRole: 'superadmin',
        randomInjectedField: 'harmful',
      };

      const cleaned = sanitizeItemPayload(rawPayload);

      expect(cleaned).toHaveProperty('title', 'Deep Learning');
      expect(cleaned).toHaveProperty('doi', '10.1145/12345');
      expect(cleaned).toHaveProperty('itemType', 'journalArticle');
      expect(cleaned).toHaveProperty('expectedVersion', 3);
      expect(cleaned).not.toHaveProperty('isAdmin');
      expect(cleaned).not.toHaveProperty('secretRole');
      expect(cleaned).not.toHaveProperty('randomInjectedField');
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
    it('should pass projectId query parameter when workspaceId is specified', async () => {
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
        '/api/v1/library/curation/duplicates?projectId=workspace-42',
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
});
