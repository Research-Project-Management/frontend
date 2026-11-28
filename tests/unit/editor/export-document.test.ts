import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pagesService } from '@/features/editor/sdk/pages.service';
import {
  exportDocx,
  exportMarkdown,
} from '@/features/editor/sdk/archive/doc-export';

describe('Document Export Unit Tests (Word .docx and Markdown .md)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. exportDocumentAsWord', () => {
    it('calls export service with docx format and triggers client download', async () => {
      const mockBase64 = btoa('PK\x03\x04mock-docx-bytes');

      vi.spyOn(pagesService.export, 'exportDocument').mockResolvedValue({
        filename: 'quantum_paper.docx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        content: mockBase64,
        isBase64: true,
        sizeBytes: 100,
      });

      let downloadedFilename = '';
      let downloadedBlob: Blob | null = null;

      const origCreateObjectURL = globalThis.URL.createObjectURL;
      const origRevokeObjectURL = globalThis.URL.revokeObjectURL;
      globalThis.URL.createObjectURL = vi.fn((blob: Blob) => {
        downloadedBlob = blob;
        return 'blob:mock-docx-url';
      });
      globalThis.URL.revokeObjectURL = vi.fn();

      const origAppend = document.body.appendChild;
      const origRemove = document.body.removeChild;
      document.body.appendChild = vi.fn((el: Node) => {
        const anchor = el as HTMLAnchorElement;
        if (anchor.download) downloadedFilename = anchor.download;
        return el;
      }) as typeof document.body.appendChild;
      document.body.removeChild = vi.fn() as typeof document.body.removeChild;

      await exportDocx({
        docId: 'doc-123',
        title: 'Quantum Paper',
      });

      expect(pagesService.export.exportDocument).toHaveBeenCalledWith(
        'doc-123',
        'docx',
        true,
      );
      expect(downloadedFilename).toBe('quantum_paper.docx');
      expect(downloadedBlob).not.toBeNull();
      expect((downloadedBlob as Blob | null)?.type).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );

      globalThis.URL.createObjectURL = origCreateObjectURL;
      globalThis.URL.revokeObjectURL = origRevokeObjectURL;
      document.body.appendChild = origAppend;
      document.body.removeChild = origRemove;
    });
  });

  describe('2. exportDocumentAsMarkdown', () => {
    it('calls export service with md format and triggers client download', async () => {
      const mockMarkdown = '# Quantum Paper\n\nIntroduction paragraph.';

      vi.spyOn(pagesService.export, 'exportDocument').mockResolvedValue({
        filename: 'quantum_paper.md',
        mimeType: 'text/markdown; charset=utf-8',
        content: mockMarkdown,
        isBase64: false,
        sizeBytes: mockMarkdown.length,
      });

      let downloadedFilename = '';
      let downloadedBlob: Blob | null = null;

      const origCreateObjectURL = globalThis.URL.createObjectURL;
      const origRevokeObjectURL = globalThis.URL.revokeObjectURL;
      globalThis.URL.createObjectURL = vi.fn((blob: Blob) => {
        downloadedBlob = blob;
        return 'blob:mock-md-url';
      });
      globalThis.URL.revokeObjectURL = vi.fn();

      const origAppend = document.body.appendChild;
      const origRemove = document.body.removeChild;
      document.body.appendChild = vi.fn((el: Node) => {
        const anchor = el as HTMLAnchorElement;
        if (anchor.download) downloadedFilename = anchor.download;
        return el;
      }) as typeof document.body.appendChild;
      document.body.removeChild = vi.fn() as typeof document.body.removeChild;

      await exportMarkdown({
        docId: 'doc-123',
        title: 'Quantum Paper',
      });

      expect(pagesService.export.exportDocument).toHaveBeenCalledWith(
        'doc-123',
        'md',
        true,
      );
      expect(downloadedFilename).toBe('quantum_paper.md');
      expect(downloadedBlob).not.toBeNull();

      globalThis.URL.createObjectURL = origCreateObjectURL;
      globalThis.URL.revokeObjectURL = origRevokeObjectURL;
      document.body.appendChild = origAppend;
      document.body.removeChild = origRemove;
    });
  });
});
