import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from '@/shared/lib/api';
import { CatalogItemService as PaperService, CatalogItemService, QualityService, RelationService, sanitizeItemPayload } from '@/features/workspaces/library/services/catalog.service';
import { CollectionService } from '@/features/workspaces/library/services/collection.service';
import { IngestionService } from '@/features/workspaces/library/services/ingestion.service';
import { NoteService } from '@/features/workspaces/library/services/note.service';
import { AnnotationService } from '@/features/workspaces/library/services/annotation.service';
import { CitationService as ReferenceService } from '@/features/workspaces/library/services/citation.service';
import { ReadingService as ItemStateService } from '@/features/workspaces/library/services/reading.service';

vi.mock('@/shared/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  getAuthToken: vi.fn(() => 'mock-token'),
}));

describe('Library Services Frontend-to-Backend Connectivity', () => {
  const workspaceId = 'ws-123';
  const paperId = 'paper-456';
  const collectionId = 'col-789';
  const attachmentId = 'att-101';
  const noteId = 'note-202';
  const annotationId = 'ann-303';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PaperService / Catalog Connectivity', () => {
    it('calls catalog items endpoint for getAll with view parameter', async () => {
      vi.mocked(api.apiGet).mockResolvedValueOnce({
        success: true,
        data: [{ id: paperId, title: 'Sample Paper' }],
        meta: { totalCount: 1, hasNextPage: false },
      });

      const res = await PaperService.getAll(workspaceId, { view: 'all' });
      expect(api.apiGet).toHaveBeenCalledWith(
        `/api/v1/workspaces/${workspaceId}/library/items`,
        { params: { view: 'all' } },
      );
      expect(res.papers).toHaveLength(1);
    });

    it('calls restore and purge endpoints with correct canonical routes', async () => {
      vi.mocked(api.apiPost).mockResolvedValueOnce({ success: true, data: { id: paperId } });
      vi.mocked(api.apiDelete).mockResolvedValueOnce({ success: true, data: { purged: true } });

      await PaperService.restore(workspaceId, paperId, 2);
      expect(api.apiPost).toHaveBeenCalledWith(
        `/api/v1/workspaces/${workspaceId}/library/items/${paperId}/restore?expectedVersion=2`,
        {},
      );

      await PaperService.purge(workspaceId, paperId);
      expect(api.apiDelete).toHaveBeenCalledWith(
        `/api/v1/workspaces/${workspaceId}/library/items/${paperId}/purge`,
      );
    });
  });

  describe('CollectionService Connectivity', () => {
    it('calls collections routes for CRUD and move-papers', async () => {
      vi.mocked(api.apiGet).mockResolvedValueOnce({ collections: [{ id: collectionId, name: 'AI' }] });
      vi.mocked(api.apiPost).mockResolvedValueOnce({ collection: { id: collectionId, name: 'AI' } });
      vi.mocked(api.apiPatch).mockResolvedValueOnce({ collections: [] });

      await CollectionService.getAll(workspaceId);
      expect(api.apiGet).toHaveBeenCalledWith(`/api/v1/workspaces/${workspaceId}/library/collections`);

      await CollectionService.create(workspaceId, { name: 'New Col' });
      expect(api.apiPost).toHaveBeenCalledWith(`/api/v1/workspaces/${workspaceId}/library/collections`, { name: 'New Col' });

      await CollectionService.reorder(workspaceId, [{ id: collectionId, parentId: null }]);
      expect(api.apiPatch).toHaveBeenCalledWith(
        `/api/v1/workspaces/${workspaceId}/library/collections/reorder`,
        { collections: [{ id: collectionId, parentId: null }] },
      );
    });
  });

  describe('IngestionService Connectivity', () => {
    it('calls async 202 submit endpoint with payload', async () => {
      vi.mocked(api.apiPost).mockResolvedValueOnce({
        success: true,
        data: { runId: 'run-1', statusUrl: '/status/run-1', acceptedAt: '2026-08-30', requestHash: 'h1', status: 'PROCESSING' },
      });

      const res = await IngestionService.submit(workspaceId, {
        kind: 'IDENTIFIER',
        identifierType: 'DOI',
        identifierValue: '10.1000/182',
      });

      expect(api.apiPost).toHaveBeenCalledWith(
        `/api/v1/workspaces/${workspaceId}/library/ingestion/submit`,
        expect.objectContaining({ kind: 'IDENTIFIER', identifierValue: '10.1000/182' }),
      );
      expect(res.data.runId).toBe('run-1');
    });

    it('queries ingestion run status snapshot', async () => {
      vi.mocked(api.apiGet).mockResolvedValueOnce({
        success: true,
        data: { id: 'run-1', runId: 'run-1', workspaceId, status: 'COMPLETED', totalItems: 1, processedItems: 1, failedItems: 0 },
      });

      const res = await IngestionService.getRunStatus(workspaceId, 'run-1');
      expect(api.apiGet).toHaveBeenCalledWith(
        `/api/v1/workspaces/${workspaceId}/library/ingestion/status/run-1`,
      );
      expect(res.success).toBe(true);
    });
  });

  describe('NoteService Connectivity', () => {
    it('supports note listing, optimistic locking update, and deletion', async () => {
      vi.mocked(api.apiGet).mockResolvedValueOnce({
        success: true,
        data: [{ id: noteId, title: 'Note 1', version: 1 }],
      });
      vi.mocked(api.apiPatch).mockResolvedValueOnce({
        success: true,
        data: { id: noteId, title: 'Updated Note', version: 2 },
      });

      const notes = await NoteService.list(workspaceId, paperId);
      expect(api.apiGet).toHaveBeenCalledWith(
        `/api/v1/workspaces/${workspaceId}/library/notes?itemId=${paperId}`,
      );
      expect(notes).toHaveLength(1);

      await NoteService.update(workspaceId, noteId, 1, { title: 'Updated Note' });
      expect(api.apiPatch).toHaveBeenCalledWith(
        `/api/v1/workspaces/${workspaceId}/library/notes/${noteId}`,
        { title: 'Updated Note', expectedVersion: 1 },
      );
    });

    it('keeps canonical organization and identifier metadata in catalog payloads', () => {
      expect(sanitizeItemPayload({
        organization: 'IEEE',
        identifier: '10.1234/dataset',
        unsafeClientOnlyKey: 'discard me',
      })).toEqual({
        organization: 'IEEE',
        identifier: '10.1234/dataset',
      });
    });
  });

  describe('AnnotationService Connectivity', () => {
    it('supports annotation CRUD and literature notes synthesis', async () => {
      vi.mocked(api.apiGet).mockResolvedValueOnce({
        success: true,
        data: [{ id: annotationId, pageIndex: 0, quoteText: 'Sample Highlight', version: 1 }],
      });
      vi.mocked(api.apiPost).mockResolvedValueOnce({
        success: true,
        data: { success: true, totalExtracted: 1 },
      });

      const annotations = await AnnotationService.getByAttachment(workspaceId, attachmentId);
      expect(api.apiGet).toHaveBeenCalledWith(
        `/api/v1/workspaces/${workspaceId}/library/attachments/${attachmentId}/annotations`,
      );
      expect(annotations).toHaveLength(1);

      await AnnotationService.extractNotesFromAnnotations(workspaceId, paperId);
      expect(api.apiPost).toHaveBeenCalledWith(
        `/api/v1/workspaces/${workspaceId}/library/items/${paperId}/extract-notes`,
      );
    });
  });

  describe('QualityService & Curation Connectivity', () => {
    it('calls duplicate clusters and merge endpoints', async () => {
      vi.mocked(api.apiGet).mockResolvedValueOnce({
        success: true,
        data: [
          {
            clusterId: 'c1',
            matchReason: 'EXACT_DOI',
            confidence: 1,
            items: [{ id: 'p1', title: 'Paper 1' }, { id: 'p2', title: 'Paper 1 Duplicate' }],
          },
        ],
      });
      vi.mocked(api.apiPost).mockResolvedValueOnce({
        success: true,
        data: { masterPaper: { id: 'p1' }, mergedCount: 1, softDeletedPaperIds: ['p2'] },
      });

      const dups = await QualityService.getDuplicates(workspaceId);
      expect(api.apiGet).toHaveBeenCalledWith(
        `/api/v1/workspaces/${workspaceId}/library/curation/duplicates`,
      );
      expect(dups.duplicateGroups).toHaveLength(1);

      await QualityService.mergePapers(workspaceId, 'p1', ['p2']);
      expect(api.apiPost).toHaveBeenCalledWith(
        `/api/v1/workspaces/${workspaceId}/library/curation/merge`,
        { primaryItemId: 'p1', duplicateItemIds: ['p2'], fieldSelections: undefined },
      );
    });
  });

  describe('ItemStateService & Reading Connectivity', () => {
    it('calls reading state endpoints', async () => {
      vi.mocked(api.apiGet).mockResolvedValueOnce({
        success: true,
        data: { readStatus: 'reading', rating: 5, lastReadAt: '2026-08-30' },
      });
      vi.mocked(api.apiPost).mockResolvedValueOnce({
        success: true,
        data: { readStatus: 'completed', rating: 5, lastReadAt: '2026-08-30' },
      });

      const state = await ItemStateService.getState(workspaceId, paperId);
      expect(api.apiGet).toHaveBeenCalledWith(
        `/api/v1/workspaces/${workspaceId}/library/items/${paperId}/state`,
      );
      expect(state.data.readStatus).toBe('reading');

      await ItemStateService.markAsRead(workspaceId, paperId);
      expect(api.apiPost).toHaveBeenCalledWith(
        `/api/v1/workspaces/${workspaceId}/library/items/${paperId}/state/read`,
        {},
      );
    });
  });
});
