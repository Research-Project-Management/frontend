import { describe, it, expect } from 'vitest';
import { resolveEpubOrSnapshot } from '@/features/library/domain/reader.domain';
import type { Item } from '@/features/library/domain/types/library.types';

describe('resolveEpubOrSnapshot - Attachment and Format Resolution', () => {
  it('does NOT resolve PDF with linkMode="imported_url" as snapshot (prevents raw binary PDF rendering)', () => {
    const paper: Partial<Item> = {
      id: 'paper-vit',
      title: 'An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale (ViT)',
      attachments: [
        {
          id: 'att-pdf-1',
          itemId: 'paper-vit',
          filename: 'vit-paper.pdf',
          mimeType: 'application/pdf',
          linkMode: 'imported_url',
          attachmentType: 'imported_file',
          url: 'https://arxiv.org/pdf/2010.11929.pdf',
        },
      ],
    };

    const result = resolveEpubOrSnapshot(paper, 'https://arxiv.org/pdf/2010.11929.pdf');
    expect(result).toBeNull();
  });

  it('does NOT resolve PDF attachment as snapshot even when attachmentType is mistakenly set to snapshot', () => {
    const paper: Partial<Item> = {
      id: 'paper-vit-2',
      title: 'ViT Paper with mislabeled snapshot attachmentType',
      attachments: [
        {
          id: 'att-mislabeled',
          itemId: 'paper-vit-2',
          filename: 'paper.pdf',
          mimeType: 'application/pdf',
          attachmentType: 'snapshot',
          url: '/api/v1/storage/paper.pdf',
        },
      ],
    };

    const result = resolveEpubOrSnapshot(paper, null, 'att-mislabeled');
    expect(result).toBeNull();
  });

  it('correctly resolves genuine HTML web snapshots', () => {
    const paper: Partial<Item> = {
      id: 'paper-web',
      title: 'OpenAI Blog Post',
      attachments: [
        {
          id: 'att-snap-1',
          itemId: 'paper-web',
          filename: 'snapshot.html',
          mimeType: 'text/html',
          attachmentType: 'web_snapshot',
          url: 'https://example.com/snapshot.html',
        },
      ],
    };

    const result = resolveEpubOrSnapshot(paper, null, 'att-snap-1');
    expect(result).toEqual({
      mode: 'snapshot',
      url: 'https://example.com/snapshot.html',
    });
  });

  it('correctly resolves EPUB files', () => {
    const paper: Partial<Item> = {
      id: 'paper-epub',
      title: 'Sample EPUB Book',
      attachments: [
        {
          id: 'att-epub-1',
          itemId: 'paper-epub',
          filename: 'book.epub',
          mimeType: 'application/epub+zip',
          attachmentType: 'imported_file',
          url: 'https://example.com/book.epub',
        },
      ],
    };

    const result = resolveEpubOrSnapshot(paper, null, 'att-epub-1');
    expect(result).toEqual({
      mode: 'epub',
      url: 'https://example.com/book.epub',
    });
  });
});
