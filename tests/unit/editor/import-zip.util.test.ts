import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isZipFile,
  inferArchiveName,
  importZip,
} from '@/features/editor/sdk/archive/zip-import';
import { pagesService, filestore } from '@/features/editor/sdk/pages.service';
import type { ImportZipResult } from '@/features/editor/sdk/pages/types';

describe('zip-import (Authoritative Server-Side Archive SDK)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isZipFile', () => {
    it('identifies filenames with .zip extension', () => {
      expect(isZipFile('project.zip')).toBe(true);
      expect(isZipFile('PROJECT.ZIP')).toBe(true);
      expect(isZipFile('/path/to/archive.zip?download=1')).toBe(true);
      expect(isZipFile('document.tex')).toBe(false);
      expect(isZipFile('figures.tar.gz')).toBe(false);
    });

    it('identifies File objects by name or MIME type', () => {
      const zipFile = new File(['dummy'], 'paper.zip', { type: 'application/zip' });
      const genericZip = new File(['dummy'], 'archive.dat', {
        type: 'application/x-zip-compressed',
      });
      const texFile = new File(['dummy'], 'main.tex', { type: 'text/x-tex' });

      expect(isZipFile(zipFile)).toBe(true);
      expect(isZipFile(genericZip)).toBe(true);
      expect(isZipFile(texFile)).toBe(false);
    });
  });

  describe('inferArchiveName', () => {
    it('infers clean title from File name', () => {
      const file = new File(['PK'], 'sample-paper.zip', { type: 'application/zip' });
      expect(inferArchiveName(file)).toBe('sample-paper');
      expect(inferArchiveName(new Blob(['PK']), 'Fallback Name')).toBe('Fallback Name');
    });
  });

  describe('importZip', () => {
    it('passes spaceId and pageId scope when both exist', async () => {
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
        .mockResolvedValueOnce(mockResult);

      const zipFile = new File(['PK-bytes'], 'manuscript.zip', { type: 'application/zip' });
      const progressPhases: string[] = [];

      const res = await importZip({
        spaceId: 'space-1',
        pageId: 'page-manuscript-99',
        file: zipFile,
        onProgress: (p) => progressPhases.push(p.phase),
      });

      expect(importSpy).toHaveBeenCalledTimes(1);
      expect(importSpy).toHaveBeenCalledWith(
        'space-1',
        zipFile,
        { pageId: 'page-manuscript-99' },
      );
      expect(res.spaceId).toBe('space-1');
      expect(res.rootPageId).toBe('doc-root-1');
      expect(res.mainFileId).toBe('doc-root-1');
      expect(res.summary).toEqual(mockResult);
      expect(progressPhases).toEqual(['uploading', 'done']);
    });

    it('forwards preferredRootDoc when explicitly specified', async () => {
      const importSpy = vi
        .spyOn(pagesService.export, 'importZip')
        .mockResolvedValueOnce({
          projectId: 'space-2',
          totalEntries: 2,
          totalDocs: 2,
          totalFiles: 0,
          totalFolders: 0,
          rootDocId: 'doc-root-2',
        });

      const zipFile = new File(['PK-bytes'], 'paper.zip', { type: 'application/zip' });

      const res = await importZip({
        spaceId: 'space-2',
        file: zipFile,
        preferredRootDoc: 'thesis.tex',
      });

      expect(importSpy).toHaveBeenCalledWith(
        'space-2',
        zipFile,
        { preferredRootDoc: 'thesis.tex' },
      );
      expect(res.rootPageId).toBe('doc-root-2');
    });

    it('throws when empty ZIP archive is provided', async () => {
      const emptyZip = new File([], 'empty.zip', { type: 'application/zip' });
      await expect(
        importZip({ spaceId: 'space-1', file: emptyZip }),
      ).rejects.toThrow('A non-empty ZIP archive file is required for import.');
    });

    it('rejects renamed non-ZIP files locally via 4-byte PKZIP magic header check before network upload', async () => {
      const importSpy = vi.spyOn(pagesService.export, 'importZip');
      const fakeZip = new File(['<html>not a zip</html>'], 'corrupted.zip', {
        type: 'application/zip',
      });

      await expect(
        importZip({ spaceId: 'space-1', file: fakeZip }),
      ).rejects.toThrow('Selected file is not a valid PKZIP archive.');
      expect(importSpy).not.toHaveBeenCalled();
    });
  });

  describe('filestore.upload & uploadPageFile pageId routing', () => {
    it('appends pageId query parameter when provided and preserves fallback when projectId is absent', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
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
      );

      const png = new File([new Uint8Array([1, 2, 3])], 'diagram.png', { type: 'image/png' });
      const uploadedWithProject = await filestore.uploadPageFile(
        'page-1',
        png,
        null,
        undefined,
        'proj-1',
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const firstUrl = String(fetchSpy.mock.calls[0]?.[0]);
      expect(firstUrl).toContain('/spaces/proj-1/files?name=diagram.png&pageId=page-1');
      expect(uploadedWithProject.url).toContain('/spaces/proj-1/files/file-1');

      fetchSpy.mockResolvedValueOnce(
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

      const standaloneItem = await filestore.uploadPageFile(
        'page-standalone',
        png,
        null,
        undefined,
        undefined,
      );
      const secondUrl = String(fetchSpy.mock.calls[1]?.[0]);
      expect(secondUrl).toContain(
        '/spaces/page-standalone/files?name=diagram.png&pageId=page-standalone',
      );
      expect(standaloneItem.id).toBe('file-2');
      expect(standaloneItem.nodeId).toBe('node-2');
      expect(standaloneItem.fileId).toBe('file-2');
    });
  });
});
