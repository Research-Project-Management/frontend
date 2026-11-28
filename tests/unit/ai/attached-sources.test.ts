import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fromPartial } from '@total-typescript/shoehorn';
import {
  getFileCategoryMeta,
  getLibraryReadiness,
  getRagDocumentId,
  sourceEntryToAttachedPayload,
  sourcesToAttachments,
  type SourceEntry,
} from '@/features/ai/context/source.port';
import {
  buildTurnPayload,
  buildWebSearchSites,
} from '@/features/ai/context/turn-payload';
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
    const indexedItem = fromPartial<Item>({
      id: 'item-indexed',
      title: 'Indexed Attention Paper',
      primaryFile: { fileId: 'file-indexed', size: 2048 },
      metadata: { ragStatus: 'indexed', ragDocId: 'file-indexed' },
    });

    const pdfOnlyItem = fromPartial<Item>({
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
    });

    const metadataItem = fromPartial<Item>({
      id: 'item-meta',
      title: 'DOI Metadata Paper',
    });

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
        fromPartial<Item>({
          id: 'item-a',
          title: 'Indexed Paper A',
          metadata: { ragStatus: 'indexed', ragDocId: 'file-a' },
          primaryFile: { fileId: 'file-a', size: 100 },
        }),
        fromPartial<Item>({
          id: 'item-b',
          title: 'Metadata Paper B',
        }),
        fromPartial<Item>({
          id: 'item-c',
          title: 'Over Cap C',
        }),
      ]);

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

  describe('getFileCategoryMeta & Format Normalization', () => {
    it('normalizes research paper titles without extension to PDF when hasPdf is true', () => {
      const meta = getFileCategoryMeta({
        id: 'p-1',
        name: 'Deep Residual Learning for Image Recognition',
        sourceType: 'paper',
        hasPdf: true,
        size: 2500000,
      });

      expect(meta.typeLabel).toBe('PDF');
      expect(meta.sizeText).toBe('2.4 MB');
      expect(meta.iconClassName).toContain('text-red');
      expect(meta.badgeClassName).toContain('bg-red');
    });

    it('identifies library paper without explicit extension or pdf as Paper with BookOpen icon', () => {
      const meta = getFileCategoryMeta({
        id: 'p-2',
        name: 'Attention Is All You Need',
        sourceType: 'library',
        hasPdf: false,
      });

      expect(meta.typeLabel).toBe('Paper');
      expect(meta.iconClassName).toContain('text-sky');
    });

    it('correctly categorizes standard document extensions (pdf, docx, tex, bib, csv, md)', () => {
      expect(getFileCategoryMeta('thesis.pdf').typeLabel).toBe('PDF');
      expect(getFileCategoryMeta('draft.docx').typeLabel).toBe('DOCX');
      expect(getFileCategoryMeta('main.tex').typeLabel).toBe('LaTeX');
      expect(getFileCategoryMeta('references.bib').typeLabel).toBe('BibTeX');
      expect(getFileCategoryMeta('results.csv').typeLabel).toBe('CSV');
      expect(getFileCategoryMeta('readme.md').typeLabel).toBe('Markdown');
    });

    it('never defaults to raw uppercase FILE on unknown titles without extension', () => {
      const meta = getFileCategoryMeta('Untyped Document');
      expect(meta.typeLabel).toBe('Document');
      expect(meta.typeLabel).not.toBe('FILE');
    });

    it('prevents sourcesToAttachments from setting type to full title when filename lacks dot', () => {
      const attachments = sourcesToAttachments([
        {
          id: 'src-1',
          name: 'Deep Residual Learning for Image Recognition',
          enabled: true,
          sourceType: 'paper',
          hasPdf: true,
        },
      ]);

      expect(attachments[0].type).toBe('pdf');
      expect(attachments[0].type).not.toBe('Deep Residual Learning for Image Recognition');
    });
  });

  describe('buildWebSearchSites & buildTurnPayload', () => {
    it('resolves webSearchSites with disabled, wildcard, explicit copy, and override semantics', () => {
      expect(buildWebSearchSites(false, ['arxiv.org'])).toBeUndefined();
      expect(buildWebSearchSites(false)).toBeUndefined();
      expect(buildWebSearchSites(true)).toEqual(['*']);
      expect(buildWebSearchSites(true, [])).toEqual(['*']);

      const sites = ['arxiv.org', 'nature.com'];
      const result = buildWebSearchSites(true, sites);
      expect(result).toEqual(['arxiv.org', 'nature.com']);
      expect(result).not.toBe(sites);

      expect(buildWebSearchSites(false, [], ['ieee.org'])).toEqual(['ieee.org']);
      expect(buildWebSearchSites(true, ['arxiv.org'], null)).toBeUndefined();
      expect(buildWebSearchSites(true, ['arxiv.org'], [])).toBeUndefined();
    });

    it('assembles chat and paper turn payloads from enabled sources, deduplicates extraDocumentIds, and omits empty fields', () => {
      const enabledUpload: SourceEntry = {
        id: 'upload-1',
        name: 'notes.md',
        enabled: true,
        sourceType: 'upload',
        size: 512,
      };
      const disabledUpload: SourceEntry = {
        id: 'upload-disabled',
        name: 'ignored.pdf',
        enabled: false,
        sourceType: 'upload',
      };
      const enabledLibraryPaper: SourceEntry = {
        id: 'item-1',
        name: 'Attention Is All You Need',
        enabled: true,
        sourceType: 'library',
        itemId: 'item-1',
        fileId: 'file-1',
        ragDocId: 'file-1',
        hasPdf: true,
        indexed: true,
      };

      const chatPayload = buildTurnPayload({
        mode: 'chat',
        spaceId: 'sp-1',
        chatId: 'chat-1',
        sources: [enabledUpload, disabledUpload, enabledLibraryPaper],
        webSearchEnabled: true,
        webSearchSites: ['arxiv.org'],
      });
      expect(chatPayload.documentIds).toEqual(['upload-1', 'file-1']);
      expect(chatPayload.attachedSources).toHaveLength(2);
      expect(chatPayload.attachments?.map((a) => a.id)).toEqual(['upload-1', 'item-1']);
      expect(chatPayload.webSearchSites).toEqual(['arxiv.org']);

      const emptyPayload = buildTurnPayload({
        mode: 'chat',
        spaceId: null,
        chatId: null,
        sources: [disabledUpload],
        webSearchEnabled: false,
      });
      expect(emptyPayload).toEqual({
        mode: 'chat',
        spaceId: null,
        chatId: null,
        documentIds: undefined,
        attachedSources: undefined,
        attachments: undefined,
        webSearchSites: undefined,
      });

      const readerPaperSource: SourceEntry = {
        id: 'paper-1',
        name: 'Graph Neural Networks',
        enabled: true,
        sourceType: 'paper',
        ragDocId: 'file-paper-1',
      };
      const paperPayload = buildTurnPayload({
        mode: 'paper',
        spaceId: 'sp-2',
        chatId: 'chat-2',
        sources: [readerPaperSource, enabledUpload],
        attachmentSources: [enabledUpload],
        extraDocumentIds: ['file-paper-1', 'extra-doc-9', ''],
        webSearchEnabled: true,
        webSearchSites: ['arxiv.org'],
        webSearchSitesOverride: ['*'],
        paper: {
          paperId: 'paper-1',
          paperTitle: 'Graph Neural Networks',
          quotedPassage: 'Message passing',
          pageNumber: 3,
        },
      });
      expect(paperPayload.documentIds).toEqual(['file-paper-1', 'extra-doc-9', 'upload-1']);
      expect(paperPayload.attachedSources).toHaveLength(2);
      expect(paperPayload.attachments?.map((a) => a.id)).toEqual(['upload-1']);
      expect(paperPayload.webSearchSites).toEqual(['*']);
      expect(paperPayload.paper?.pageNumber).toBe(3);
    });
  });
});
