import { describe, it, expect, vi, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { exportProjectAsZip, exportArxivSubmissionZip } from '@/features/editor/utils/export-zip.util';
import { documentService, fileService } from '@/features/editor/services/core.service';
import { StorageService } from '@/features/editor/services/storage.service';

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
});
