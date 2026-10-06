import { describe, it, expect, vi, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { exportProjectAsZip, exportArxivSubmissionZip } from '@/features/editor/utils/export-zip.util';
import {
  exportDocumentAsWord,
  exportDocumentAsMarkdown,
  exportDocumentAsHtml,
} from '@/features/editor/utils/export-document.util';
import { documentService, fileService } from '@/features/editor/services/core.service';
import { StorageService } from '@/features/editor/services/storage.service';
import { exportService } from '@/features/editor/services/export.service';

describe('Export Pipeline & Inline Suggestion Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Project Source ZIP Export (Overleaf 1:1 Package)', () => {
    it('should bundle main.tex and subfiles into a downloadable zip', async () => {
      vi.spyOn(documentService, 'getById').mockResolvedValue({
        id: 'doc-1',
        title: 'Project Manuscript',
        content: '\\documentclass{article}\n\\begin{document}\nHello World\n\\end{document}',
      } as any);

      vi.spyOn(fileService, 'getByPageId').mockResolvedValue([
        { id: 'f-1', title: 'intro.tex', content: '\\section{Introduction}' },
        { id: 'f-2', title: 'references.bib', content: '@article{test, title={Test}}' },
      ] as any);

      vi.spyOn(StorageService, 'getPageFiles').mockResolvedValue([]);

      let createdBlob: Blob | null = null;
      let downloadedFilename = '';

      // Mock URL.createObjectURL and link.click
      const origCreateObjectURL = globalThis.URL.createObjectURL;
      const origRevokeObjectURL = globalThis.URL.revokeObjectURL;
      globalThis.URL.createObjectURL = vi.fn((blob: any) => {
        createdBlob = blob;
        return 'blob:mock-zip-url';
      });
      globalThis.URL.revokeObjectURL = vi.fn();

      const origAppend = document.body.appendChild;
      const origRemove = document.body.removeChild;
      document.body.appendChild = vi.fn((el: any) => {
        if (el.download) downloadedFilename = el.download;
        return el;
      });
      document.body.removeChild = vi.fn();

      await exportProjectAsZip({
        parentPageId: 'doc-1',
        projectTitle: 'Paper Draft',
      });

      expect(createdBlob).not.toBeNull();
      expect(downloadedFilename).toBe('Paper_Draft.zip');

      // Unpack and verify files in the ZIP archive
      const zip = await JSZip.loadAsync(createdBlob!);
      expect(zip.file('main.tex')).not.toBeNull();
      expect(zip.file('intro.tex')).not.toBeNull();
      expect(zip.file('references.bib')).not.toBeNull();

      const mainContent = await zip.file('main.tex')!.async('string');
      expect(mainContent).toContain('Hello World');

      globalThis.URL.createObjectURL = origCreateObjectURL;
      globalThis.URL.revokeObjectURL = origRevokeObjectURL;
      document.body.appendChild = origAppend;
      document.body.removeChild = origRemove;
    });

    it('should filter out auxiliary files in arXiv submission package', async () => {
      vi.spyOn(documentService, 'getById').mockResolvedValue({
        id: 'doc-arxiv',
        title: 'Main',
        content: '\\documentclass{article}\n\\begin{document}\nPaper\n\\end{document}',
      } as any);

      vi.spyOn(fileService, 'getByPageId').mockResolvedValue([
        { id: 'f-1', title: 'paper.tex', content: '\\section{Paper}' },
        { id: 'f-2', title: 'paper.aux', content: '\\relax' },
        { id: 'f-3', title: 'paper.log', content: 'Compile log' },
        { id: 'f-4', title: 'paper.synctex.gz', content: 'SyncTeX data' },
        { id: 'f-5', title: 'refs.bib', content: '@article{a}' },
      ] as any);

      vi.spyOn(StorageService, 'getPageFiles').mockResolvedValue([]);

      let createdBlob: Blob | null = null;
      globalThis.URL.createObjectURL = vi.fn((blob: any) => {
        createdBlob = blob;
        return 'blob:mock-arxiv-url';
      });

      await exportArxivSubmissionZip({
        parentPageId: 'doc-arxiv',
        projectTitle: 'arXiv_Manuscript',
      });

      expect(createdBlob).not.toBeNull();
      const zip = await JSZip.loadAsync(createdBlob!);

      // Allowed files
      expect(zip.file('paper.tex')).not.toBeNull();
      expect(zip.file('refs.bib')).not.toBeNull();

      // Disallowed aux/log/synctex files MUST NOT be in arXiv zip
      expect(zip.file('paper.aux')).toBeNull();
      expect(zip.file('paper.log')).toBeNull();
      expect(zip.file('paper.synctex.gz')).toBeNull();
    });
  });

  describe('2. Multi-Format Document Export (Word, Markdown, HTML)', () => {
    it('should export document as Word .docx with base64 decoding', async () => {
      const mockBase64 = Buffer.from('mock-docx-zip-content').toString('base64');
      vi.spyOn(exportService, 'exportDocument').mockResolvedValue({
        filename: 'report.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        content: mockBase64,
        isBase64: true,
        sizeBytes: 21,
      });

      let downloadedFilename = '';
      const origAppend = document.body.appendChild;
      const origRemove = document.body.removeChild;
      document.body.appendChild = vi.fn((el: any) => {
        if (el.download) downloadedFilename = el.download;
        return el;
      });
      document.body.removeChild = vi.fn();

      const result = await exportDocumentAsWord({
        pageId: 'doc-report-1',
        projectTitle: 'Research Report',
      });

      expect(result).toBe('report.docx');
      expect(downloadedFilename).toBe('report.docx');

      document.body.appendChild = origAppend;
      document.body.removeChild = origRemove;
    });

    it('should export document as Markdown .md and handle offline fallback', async () => {
      vi.spyOn(exportService, 'exportDocument').mockResolvedValue({
        filename: 'draft.md',
        mimeType: 'text/markdown',
        content: '# Draft Title\nParagraph text.',
        isBase64: false,
        sizeBytes: 30,
      });

      let downloadedFilename = '';
      const origAppend = document.body.appendChild;
      const origRemove = document.body.removeChild;
      document.body.appendChild = vi.fn((el: any) => {
        if (el.download) downloadedFilename = el.download;
        return el;
      });
      document.body.removeChild = vi.fn();

      const result = await exportDocumentAsMarkdown({
        pageId: 'doc-draft-1',
        projectTitle: 'Draft Manuscript',
      });

      expect(result).toBe('draft.md');
      expect(downloadedFilename).toBe('draft.md');

      // Test fallback when remote endpoint errors
      vi.spyOn(exportService, 'exportDocument').mockRejectedValue(new Error('Backend offline'));

      const fallbackResult = await exportDocumentAsMarkdown({
        pageId: 'doc-draft-offline',
        projectTitle: 'Offline Paper',
        fallbackContent: '# Offline Content',
      });

      expect(fallbackResult).toBe('offline_paper.md');
      expect(downloadedFilename).toBe('offline_paper.md');

      document.body.appendChild = origAppend;
      document.body.removeChild = origRemove;
    });

    it('should export document as standalone HTML with KaTeX styles', () => {
      let downloadedFilename = '';
      const origAppend = document.body.appendChild;
      const origRemove = document.body.removeChild;
      document.body.appendChild = vi.fn((el: any) => {
        if (el.download) downloadedFilename = el.download;
        return el;
      });
      document.body.removeChild = vi.fn();

      const result = exportDocumentAsHtml({
        content: '\\section{Introduction}\n\\textbf{Bold text} and regular text.',
        projectTitle: 'Thesis Final',
      });

      expect(result).toBe('thesis_final.html');
      expect(downloadedFilename).toBe('thesis_final.html');

      document.body.appendChild = origAppend;
      document.body.removeChild = origRemove;
    });
  });
});
