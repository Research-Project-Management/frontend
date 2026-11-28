import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  exportZip,
  exportArxivZip,
  exportVersionZip,
} from '@/features/editor/sdk/archive/zip-export';
import {
  exportDocx,
  exportMarkdown,
  exportHtml,
} from '@/features/editor/sdk/archive/doc-export';
import {
  isZipFile,
  inferArchiveName,
  importZip,
} from '@/features/editor/sdk/archive/zip-import';
import { pagesService, filestore } from '@/features/editor/sdk/pages.service';
import type { ImportZipResult } from '@/features/editor/sdk/pages/types';

describe('Editor Archive Export & Import Pipeline', () => {
  const origCreateObjectURL = globalThis.URL.createObjectURL;
  const origRevokeObjectURL = globalThis.URL.revokeObjectURL;
  let origAppend: typeof document.body.appendChild;
  let origRemove: typeof document.body.removeChild;

  beforeEach(() => {
    vi.clearAllMocks();
    origAppend = document.body.appendChild;
    origRemove = document.body.removeChild;
  });

  afterEach(() => {
    globalThis.URL.createObjectURL = origCreateObjectURL;
    globalThis.URL.revokeObjectURL = origRevokeObjectURL;
    document.body.appendChild = origAppend;
    document.body.removeChild = origRemove;
    vi.restoreAllMocks();
  });

  describe('1. Source, arXiv & Historical Version ZIP Export', () => {
    it('requests standard ZIP from backend and triggers browser download', async () => {
      const mockZip = new Blob(['PK\x03\x04mock-zip'], { type: 'application/zip' });
      const exportZipSpy = vi
        .spyOn(pagesService.export, 'exportZip')
        .mockResolvedValue(mockZip);

      let createdBlob: Blob | null = null;
      let downloadedFilename = '';
      globalThis.URL.createObjectURL = vi.fn((blob: Blob) => {
        createdBlob = blob;
        return 'blob:mock-zip-url';
      });
      globalThis.URL.revokeObjectURL = vi.fn();
      document.body.appendChild = vi.fn((el: Node) => {
        const anchor = el as HTMLAnchorElement;
        if (anchor.download) downloadedFilename = anchor.download;
        return el;
      }) as typeof document.body.appendChild;
      document.body.removeChild = vi.fn() as typeof document.body.removeChild;

      const filename = await exportZip({
        spaceId: 'space-1',
        pageId: 'doc-1',
        title: 'Paper Draft',
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
    });

    it('requests cleanArxiv ZIP bundle without PDF', async () => {
      const mockZip = new Blob(['PK\x03\x04arxiv-zip'], { type: 'application/zip' });
      const exportZipSpy = vi
        .spyOn(pagesService.export, 'exportZip')
        .mockResolvedValue(mockZip);
      globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-arxiv-url');

      const filename = await exportArxivZip({
        pageId: 'doc-arxiv',
        title: 'arXiv_Manuscript',
      });

      expect(exportZipSpy).toHaveBeenCalledWith('doc-arxiv', {
        cleanArxiv: true,
        includePdf: false,
        mode: 'arxiv',
        projectName: 'arXiv_Manuscript',
        pageId: 'doc-arxiv',
      });
      expect(filename).toBe('arxiv-arXiv_Manuscript.zip');
    });

    it('exports historical version ZIP with sanitized title and revision label suffix', async () => {
      const mockZip = new Blob(['PK\x03\x04version-zip'], { type: 'application/zip' });
      const versionSpy = vi
        .spyOn(pagesService.history, 'exportVersionZip')
        .mockResolvedValue(mockZip);
      globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-version-url');
      document.body.appendChild = vi.fn((el: Node) => el) as typeof document.body.appendChild;
      document.body.removeChild = vi.fn() as typeof document.body.removeChild;

      const filename = await exportVersionZip({
        spaceId: 'root-1',
        pageId: 'page-99',
        versionId: 'ver-2',
        title: 'Deep Learning / AI Paper: Final!!',
        revisionLabel: 'Submission v2',
        revisionDate: '2026-09-18T09:30:00Z',
      });

      expect(versionSpy).toHaveBeenCalledWith(
        'root-1',
        'ver-2',
        'Deep_Learning_AI_Paper_Final',
        { pageId: 'page-99' },
      );
      expect(filename).toBe('Deep_Learning_AI_Paper_Final-Submission_v2.zip');
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
      document.body.appendChild = vi.fn((el: Node) => {
        const anchor = el as HTMLAnchorElement;
        if (anchor.download) downloadedFilename = anchor.download;
        return el;
      }) as typeof document.body.appendChild;
      document.body.removeChild = vi.fn() as typeof document.body.removeChild;

      const result = await exportDocx({
        docId: 'doc-report-1',
        title: 'Research Report',
      });

      expect(result).toBe('report.docx');
      expect(downloadedFilename).toBe('report.docx');
    });

    it('exports document as Markdown .md and standalone HTML via backend and propagates errors cleanly', async () => {
      vi.spyOn(pagesService.export, 'exportDocument').mockResolvedValueOnce({
        filename: 'draft.md',
        mimeType: 'text/markdown',
        content: '# Draft Title\nParagraph text.',
        isBase64: false,
        sizeBytes: 30,
      });

      expect(
        await exportMarkdown({
          docId: 'doc-draft-1',
          title: 'Draft Manuscript',
        }),
      ).toBe('draft.md');

      vi.spyOn(pagesService.export, 'exportDocument').mockRejectedValueOnce(
        new Error('Backend unavailable'),
      );
      await expect(
        exportMarkdown({
          docId: 'doc-draft-offline',
          title: 'Offline Paper',
        }),
      ).rejects.toThrow('Backend unavailable');

      vi.spyOn(pagesService.export, 'exportDocument').mockResolvedValueOnce({
        filename: 'thesis_final.html',
        mimeType: 'text/html',
        content: '<!DOCTYPE html><html><body><h1>Introduction</h1></body></html>',
        isBase64: false,
        sizeBytes: 64,
      });

      expect(
        await exportHtml({
          docId: 'doc-html-1',
          title: 'Thesis Final',
        }),
      ).toBe('thesis_final.html');
      expect(pagesService.export.exportDocument).toHaveBeenCalledWith('doc-html-1', 'html', true);
    });
  });

  describe('3. ZIP Archive Import & Filestore Page Routing', () => {
    it('identifies ZIP files and infers clean archive names', () => {
      expect(isZipFile('project.zip')).toBe(true);
      expect(isZipFile('PROJECT.ZIP')).toBe(true);
      expect(isZipFile('/path/to/archive.zip?download=1')).toBe(true);
      expect(isZipFile('document.tex')).toBe(false);
      expect(isZipFile('figures.tar.gz')).toBe(false);

      expect(isZipFile(new File(['dummy'], 'paper.zip', { type: 'application/zip' }))).toBe(true);
      expect(
        isZipFile(new File(['dummy'], 'archive.dat', { type: 'application/x-zip-compressed' })),
      ).toBe(true);
      expect(isZipFile(new File(['dummy'], 'main.tex', { type: 'text/x-tex' }))).toBe(false);

      expect(inferArchiveName(new File(['PK'], 'sample-paper.zip', { type: 'application/zip' }))).toBe(
        'sample-paper',
      );
      expect(inferArchiveName(new Blob(['PK']), 'Fallback Name')).toBe('Fallback Name');
    });

    it('passes spaceId, pageId, and preferredRootDoc to pagesService.export.importZip', async () => {
      const mockResult: ImportZipResult = {
        projectId: 'space-1',
        totalEntries: 5,
        totalDocs: 3,
        totalFiles: 2,
        totalFolders: 1,
        rootDocId: 'doc-root-1',
        rootDocPath: 'main.tex',
      };
      const importSpy = vi
        .spyOn(pagesService.export, 'importZip')
        .mockResolvedValueOnce(mockResult)
        .mockResolvedValueOnce({
          projectId: 'space-2',
          totalEntries: 2,
          totalDocs: 2,
          totalFiles: 0,
          totalFolders: 0,
          rootDocId: 'doc-root-2',
        });

      const zipFile = new File(['PK-bytes'], 'manuscript.zip', { type: 'application/zip' });
      const progressPhases: string[] = [];

      const res = await importZip({
        spaceId: 'space-1',
        pageId: 'page-manuscript-99',
        file: zipFile,
        onProgress: (p) => progressPhases.push(p.phase),
      });

      expect(importSpy).toHaveBeenNthCalledWith(1, 'space-1', zipFile, {
        pageId: 'page-manuscript-99',
      });
      expect(res.spaceId).toBe('space-1');
      expect(res.rootPageId).toBe('doc-root-1');
      expect(progressPhases).toEqual(['uploading', 'done']);

      const res2 = await importZip({
        spaceId: 'space-2',
        file: zipFile,
        preferredRootDoc: 'thesis.tex',
      });
      expect(importSpy).toHaveBeenNthCalledWith(2, 'space-2', zipFile, {
        preferredRootDoc: 'thesis.tex',
      });
      expect(res2.rootPageId).toBe('doc-root-2');
    });

    it('rejects empty and non-PKZIP files locally before uploading', async () => {
      const importSpy = vi.spyOn(pagesService.export, 'importZip');

      await expect(
        importZip({
          spaceId: 'space-1',
          file: new File([], 'empty.zip', { type: 'application/zip' }),
        }),
      ).rejects.toThrow('A non-empty ZIP archive file is required for import.');

      await expect(
        importZip({
          spaceId: 'space-1',
          file: new File(['<html>not a zip</html>'], 'corrupted.zip', {
            type: 'application/zip',
          }),
        }),
      ).rejects.toThrow('Selected file is not a valid PKZIP archive.');

      expect(importSpy).not.toHaveBeenCalled();
    });

    it('appends pageId query parameter in filestore.uploadPageFile with project and standalone fallback', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 'file-1',
              projectId: 'proj-1',
              pageId: 'page-1',
              filename: 'diagram.png',
              path: '/figures/diagram.png',
              sizeBytes: 12,
              hash: 'abc',
              mimeType: 'image/png',
              createdAt: '2026-01-01T00:00:00.000Z',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              success: true,
              data: {
                id: 'file-2',
                nodeId: 'node-2',
                fileId: 'file-2',
                projectId: 'page-standalone',
                filename: 'standalone.png',
                sizeBytes: 8,
                hash: 'def',
                mimeType: 'image/png',
                createdAt: '2026-01-01T00:00:00.000Z',
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );

      const png = new File([new Uint8Array([1, 2, 3])], 'diagram.png', { type: 'image/png' });
      const uploadedWithProject = await filestore.uploadPageFile(
        'page-1',
        png,
        null,
        undefined,
        'proj-1',
      );

      expect(String(fetchSpy.mock.calls[0]?.[0])).toContain(
        '/spaces/proj-1/files?name=diagram.png&pageId=page-1',
      );
      expect(uploadedWithProject.url).toContain('/spaces/proj-1/files/file-1');

      const standaloneItem = await filestore.uploadPageFile(
        'page-standalone',
        png,
        null,
        undefined,
        undefined,
      );
      expect(String(fetchSpy.mock.calls[1]?.[0])).toContain(
        '/spaces/page-standalone/files?name=diagram.png&pageId=page-standalone',
      );
      expect(standaloneItem.id).toBe('file-2');
      expect(standaloneItem.nodeId).toBe('node-2');
      expect(standaloneItem.fileId).toBe('file-2');
    });
  });
});
