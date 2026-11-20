import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getLibraryReadiness,
  getRagDocumentId,
  sourceEntryToAttachedPayload,
} from '@/features/ai/context/source.port';
import {
  librarySourceAdapter,
  loadCollectionSources,
} from '@/features/ai/context/library';
import { FluxHttpTransport } from '@/features/ai/transport/flux';
import { messageAttachmentSchema } from '@/features/ai/types/session';
import { ItemsService } from '@/features/library/sdk/clients/items.client';
import type { Item } from '@/features/library/types/core.types';

function createEmptySseResponse() {
  const encoder = new TextEncoder();
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'x-chat-id': 'chat-123' }),
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    }),
  };
}

describe('Attached Sources, ID Separation, Collection Loading & Storage Removal', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('separates item_id, file_id, and Qdrant source_id across indexed, pdf, and metadata-only papers', () => {
    const indexedItem = {
      id: 'item-indexed',
      title: 'Indexed Attention Paper',
      primaryFile: { fileId: 'file-indexed', size: 2048 },
      metadata: { ragStatus: 'indexed', ragDocId: 'file-indexed' },
    } as unknown as Item;

    const pdfOnlyItem = {
      id: 'item-pdf',
      title: 'Unindexed PDF Paper',
      attachments: [
        {
          id: 'att-1',
          fileId: 'file-pdf',
          attachmentType: 'primary_pdf',
          mimeType: 'application/pdf',
          filename: 'paper.pdf',
          size: 4096,
        },
      ],
    } as unknown as Item;

    const metadataItem = {
      id: 'item-meta',
      title: 'DOI Metadata Paper',
    } as unknown as Item;

    const indexedEntry = librarySourceAdapter.toSourceEntry(indexedItem)!;
    const pdfEntry = librarySourceAdapter.toSourceEntry(pdfOnlyItem)!;
    const metaEntry = librarySourceAdapter.toSourceEntry(metadataItem)!;

    expect(indexedEntry.id).toBe('item-indexed');
    expect(getLibraryReadiness(indexedEntry)).toBe('indexed');
    expect(getRagDocumentId(indexedEntry)).toBe('file-indexed');
    expect(sourceEntryToAttachedPayload(indexedEntry)).toEqual({
      kind: 'library',
      title: 'Indexed Attention Paper',
      source_id: 'file-indexed',
      source_type: 'file',
      item_id: 'item-indexed',
      file_id: 'file-indexed',
      has_pdf: true,
      indexed: true,
    });

    expect(pdfEntry.id).toBe('item-pdf');
    expect(getLibraryReadiness(pdfEntry)).toBe('pdf');
    expect(getRagDocumentId(pdfEntry)).toBe('file-pdf');
    expect(sourceEntryToAttachedPayload(pdfEntry)).toEqual({
      kind: 'library',
      title: 'Unindexed PDF Paper',
      source_id: 'file-pdf',
      source_type: 'file',
      item_id: 'item-pdf',
      file_id: 'file-pdf',
      has_pdf: true,
      indexed: false,
    });

    // Metadata-only items must NEVER pass item_id into Qdrant documentIds / source_id
    expect(metaEntry.id).toBe('item-meta');
    expect(getLibraryReadiness(metaEntry)).toBe('metadata');
    expect(getRagDocumentId(metaEntry)).toBeNull();
    expect(sourceEntryToAttachedPayload(metaEntry)).toEqual({
      kind: 'library',
      title: 'DOI Metadata Paper',
      source_id: null,
      source_type: null,
      item_id: 'item-meta',
      file_id: null,
      has_pdf: false,
      indexed: false,
    });

    const uploadPayload = sourceEntryToAttachedPayload({
      id: 'upload-99',
      name: 'notes.md',
      enabled: true,
      sourceType: 'upload',
    });
    expect(uploadPayload).toEqual({
      kind: 'upload',
      title: 'notes.md',
      source_id: 'upload-99',
      source_type: 'upload',
      indexed: true,
    });
  });

  it('loads all collection papers (indexed, unindexed PDF, and metadata-only) with max cap', async () => {
    const mockGet = vi
      .spyOn(ItemsService, 'getByCollection')
      .mockResolvedValue([
        {
          id: 'item-a',
          title: 'Indexed Paper A',
          metadata: { ragStatus: 'indexed', ragDocId: 'file-a' },
          primaryFile: { fileId: 'file-a', size: 100 },
        },
        {
          id: 'item-b',
          title: 'Metadata Paper B',
        },
        {
          id: 'item-c',
          title: 'Over Cap C',
        },
      ] as unknown as Item[]);

    const entries = await loadCollectionSources('col-1', 'space-1', {
      maxItems: 2,
    });

    expect(mockGet).toHaveBeenCalledWith('space-1', 'col-1');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      id: 'item-a',
      itemId: 'item-a',
      ragDocId: 'file-a',
      indexed: true,
    });
    expect(entries[1]).toMatchObject({
      id: 'item-b',
      itemId: 'item-b',
      hasPdf: false,
      indexed: false,
    });
  });

  it('transports context.attached_sources alongside documentIds in FluxHttpTransport.stream', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createEmptySseResponse());
    global.fetch = fetchMock;

    const transport = new FluxHttpTransport();
    await transport.stream({
      messages: [{ role: 'user', content: 'Summarize attached papers' }],
      context: {
        mode: 'chat',
        spaceId: 'sp-1',
        documentIds: ['file-pdf'],
        attachedSources: [
          {
            kind: 'library',
            title: 'Unindexed PDF',
            item_id: 'item-pdf',
            file_id: 'file-pdf',
            source_id: 'file-pdf',
            source_type: 'file',
            has_pdf: true,
            indexed: false,
          },
          {
            kind: 'library',
            title: 'Metadata Paper',
            item_id: 'item-meta',
            file_id: null,
            source_id: null,
            source_type: null,
            has_pdf: false,
            indexed: false,
          },
        ],
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedBody = JSON.parse(String(init.body));
    expect(parsedBody.documentIds).toEqual(['file-pdf']);
    expect(parsedBody.context).toEqual({
      attached_sources: expect.arrayContaining([
        expect.objectContaining({
          kind: 'library',
          item_id: 'item-pdf',
          file_id: 'file-pdf',
          source_id: 'file-pdf',
        }),
        expect.objectContaining({
          kind: 'library',
          item_id: 'item-meta',
          source_id: null,
        }),
      ]),
    });
  });

  it('safely coerces legacy storage attachments in persisted history into upload', () => {
    const legacy = messageAttachmentSchema.parse({
      id: 'legacy-1',
      name: 'old.pdf',
      sourceType: 'storage',
    });
    expect(legacy.sourceType).toBe('upload');
  });
});
