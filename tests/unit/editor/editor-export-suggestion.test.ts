import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  exportProjectAsZip,
  exportArxivSubmissionZip,
} from '@/features/editor/sdk/archive/zip-export';
import {
  exportDocumentAsWord,
  exportDocumentAsMarkdown,
  exportDocumentAsHtml,
} from '@/features/editor/sdk/archive/doc-export';
import { pagesService } from '@/features/editor/sdk/pages.service';

describe('Export Pipeline Unit Tests (Authoritative Server-Side)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Project Source & arXiv ZIP Export', () => {
    it('requests standard project ZIP from backend and triggers download', async () => {
      const mockZip = new Blob(['PK\x03\x04mock-zip'], { type: 'application/zip' });
      const exportZipSpy = vi
        .spyOn(pagesService.export, 'exportProjectZip')
        .mockResolvedValue(mockZip);

      let createdBlob: Blob | null = null;
      let downloadedFilename = '';

      const origCreateObjectURL = globalThis.URL.createObjectURL;
      const origRevokeObjectURL = globalThis.URL.revokeObjectURL;
      globalThis.URL.createObjectURL = vi.fn((blob: Blob) => {
        createdBlob = blob;
        return 'blob:mock-zip-url';
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

      const filename = await exportProjectAsZip({
        spaceId: 'space-1',
        parentPageId: 'doc-1',
        projectTitle: 'Paper Draft',
      });

      expect(exportZipSpy).toHaveBeenCalledWith('space-1', {
        cleanArxiv: false,
        includePdf: true,
        mode: 'standard',
        projectName: 'Paper_Draft',
        pageId: 'doc-1',
      });
      expect(filename).toBe('Paper_Draft.zip');
      expect(createdBlob).toBe(mockZip);
      expect(downloadedFilename).toBe('Paper_Draft.zip');

      globalThis.URL.createObjectURL = origCreateObjectURL;
      globalThis.URL.revokeObjectURL = origRevokeObjectURL;
      document.body.appendChild = origAppend;
      document.body.removeChild = origRemove;
    });

    it('requests cleanArxiv ZIP bundle from backend without PDF', async () => {
      const mockZip = new Blob(['PK\x03\x04arxiv-zip'], { type: 'application/zip' });
      const exportZipSpy = vi
        .spyOn(pagesService.export, 'exportProjectZip')
        .mockResolvedValue(mockZip);

      const origCreateObjectURL = globalThis.URL.createObjectURL;
      globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-arxiv-url');

      const filename = await exportArxivSubmissionZip({
        parentPageId: 'doc-arxiv',
        projectTitle: 'arXiv_Manuscript',
      });

      expect(exportZipSpy).toHaveBeenCalledWith('doc-arxiv', {
        cleanArxiv: true,
        includePdf: false,
        mode: 'arxiv',
        projectName: 'arXiv_Manuscript',
        pageId: 'doc-arxiv',
      });
      expect(filename).toBe('arxiv-arXiv_Manuscript.zip');

      globalThis.URL.createObjectURL = origCreateObjectURL;
    });
  });

  describe('2. Multi-Format Document Export (Word, Markdown, HTML)', () => {
    it('exports document as Word .docx with base64 decoding', async () => {
      const mockBase64 = Buffer.from('mock-docx-zip-content').toString('base64');
      vi.spyOn(pagesService.export, 'exportDocument').mockResolvedValue({
        filename: 'report.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        content: mockBase64,
        isBase64: true,
        sizeBytes: 21,
      });

      let downloadedFilename = '';
      const origAppend = document.body.appendChild;
      const origRemove = document.body.removeChild;
      document.body.appendChild = vi.fn((el: Node) => {
        const anchor = el as HTMLAnchorElement;
        if (anchor.download) downloadedFilename = anchor.download;
        return el;
      }) as typeof document.body.appendChild;
      document.body.removeChild = vi.fn() as typeof document.body.removeChild;

      const result = await exportDocumentAsWord({
        docId: 'doc-report-1',
        projectTitle: 'Research Report',
      });

      expect(result).toBe('report.docx');
      expect(downloadedFilename).toBe('report.docx');

      document.body.appendChild = origAppend;
      document.body.removeChild = origRemove;
    });

    it('exports document as Markdown .md via backend and propagates errors cleanly', async () => {
      vi.spyOn(pagesService.export, 'exportDocument').mockResolvedValueOnce({
        filename: 'draft.md',
        mimeType: 'text/markdown',
        content: '# Draft Title\nParagraph text.',
        isBase64: false,
        sizeBytes: 30,
      });

      const result = await exportDocumentAsMarkdown({
        docId: 'doc-draft-1',
        projectTitle: 'Draft Manuscript',
      });
      expect(result).toBe('draft.md');

      vi.spyOn(pagesService.export, 'exportDocument').mockRejectedValueOnce(
        new Error('Backend unavailable'),
      );
      await expect(
        exportDocumentAsMarkdown({
          docId: 'doc-draft-offline',
          projectTitle: 'Offline Paper',
        }),
      ).rejects.toThrow('Backend unavailable');
    });

    it('exports document as standalone HTML via backend', async () => {
      vi.spyOn(pagesService.export, 'exportDocument').mockResolvedValueOnce({
        filename: 'thesis_final.html',
        mimeType: 'text/html',
        content: '<!DOCTYPE html><html><body><h1>Introduction</h1></body></html>',
        isBase64: false,
        sizeBytes: 64,
      });

      const result = await exportDocumentAsHtml({
        docId: 'doc-html-1',
        projectTitle: 'Thesis Final',
      });

      expect(pagesService.export.exportDocument).toHaveBeenCalledWith('doc-html-1', 'html', true);
      expect(result).toBe('thesis_final.html');
    });
  });
});
