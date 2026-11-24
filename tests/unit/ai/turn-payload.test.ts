import { describe, expect, it } from 'vitest';
import type { SourceEntry } from '@/features/ai/context/source.port';
import {
  buildTurnPayload,
  buildWebSearchSites,
} from '@/features/ai/context/turn-payload';

describe('turn-payload helpers', () => {
  describe('buildWebSearchSites', () => {
    it('returns undefined when disabled and no override is provided', () => {
      expect(buildWebSearchSites(false, ['arxiv.org'])).toBeUndefined();
      expect(buildWebSearchSites(false)).toBeUndefined();
    });

    it('returns wildcard ["*"] when enabled with empty or omitted sites', () => {
      expect(buildWebSearchSites(true)).toEqual(['*']);
      expect(buildWebSearchSites(true, [])).toEqual(['*']);
    });

    it('returns a copy of configured sites when enabled', () => {
      const sites = ['arxiv.org', 'nature.com'];
      const result = buildWebSearchSites(true, sites);
      expect(result).toEqual(['arxiv.org', 'nature.com']);
      expect(result).not.toBe(sites);
    });

    it('prioritizes explicit override over enabled/sites flags', () => {
      expect(buildWebSearchSites(false, [], ['ieee.org'])).toEqual(['ieee.org']);
      expect(buildWebSearchSites(true, ['arxiv.org'], null)).toBeUndefined();
      expect(buildWebSearchSites(true, ['arxiv.org'], [])).toBeUndefined();
    });
  });

  describe('buildTurnPayload', () => {
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

    it('assembles chat payload from enabled sources only and omits empty fields', () => {
      const payload = buildTurnPayload({
        mode: 'chat',
        spaceId: 'sp-1',
        chatId: 'chat-1',
        sources: [enabledUpload, disabledUpload, enabledLibraryPaper],
        webSearchEnabled: true,
        webSearchSites: ['arxiv.org'],
      });

      expect(payload.mode).toBe('chat');
      expect(payload.spaceId).toBe('sp-1');
      expect(payload.chatId).toBe('chat-1');
      expect(payload.documentIds).toEqual(['upload-1', 'file-1']);
      expect(payload.attachedSources).toHaveLength(2);
      expect(payload.attachments?.map((a) => a.id)).toEqual([
        'upload-1',
        'item-1',
      ]);
      expect(payload.webSearchSites).toEqual(['arxiv.org']);
    });

    it('omits documentIds, attachedSources, attachments, and webSearchSites when empty/disabled', () => {
      const payload = buildTurnPayload({
        mode: 'chat',
        spaceId: null,
        chatId: null,
        sources: [disabledUpload],
        webSearchEnabled: false,
      });

      expect(payload).toEqual({
        mode: 'chat',
        spaceId: null,
        chatId: null,
        documentIds: undefined,
        attachedSources: undefined,
        attachments: undefined,
        webSearchSites: undefined,
      });
    });

    it('deduplicates extraDocumentIds and supports separate attachmentSources for reader mode', () => {
      const readerPaperSource: SourceEntry = {
        id: 'paper-1',
        name: 'Graph Neural Networks',
        enabled: true,
        sourceType: 'paper',
        ragDocId: 'file-paper-1',
      };

      const payload = buildTurnPayload({
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

      expect(payload.mode).toBe('paper');
      expect(payload.documentIds).toEqual([
        'file-paper-1',
        'extra-doc-9',
        'upload-1',
      ]);
      // attachedSources includes both readerPaperSource and enabledUpload
      expect(payload.attachedSources).toHaveLength(2);
      // attachments only includes explicit attachmentSources (enabledUpload)
      expect(payload.attachments?.map((a) => a.id)).toEqual(['upload-1']);
      expect(payload.webSearchSites).toEqual(['*']);
      expect(payload.paper).toEqual({
        paperId: 'paper-1',
        paperTitle: 'Graph Neural Networks',
        quotedPassage: 'Message passing',
        pageNumber: 3,
      });
    });
  });
});
