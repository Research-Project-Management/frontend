import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isZipFile,
  isTextFile,
  parseZipArchive,
  extractAndImportZipToProject,
} from '@/features/editor/sdk/archive/archive-import';
import { manuscriptService } from '@/features/editor/sdk/pages.service';
import type { ImportProjectZipResult } from '@/features/editor/sdk/pages/types';

describe('import-zip.util (Thin-Client Archive SDK)', () => {
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

  describe('isTextFile', () => {
    it('identifies LaTeX text extensions correctly', () => {
      expect(isTextFile('main.tex')).toBe(true);
      expect(isTextFile('ref.bib')).toBe(true);
      expect(isTextFile('custom.sty')).toBe(true);
      expect(isTextFile('ieee.cls')).toBe(true);
      expect(isTextFile('notes.md')).toBe(true);
      expect(isTextFile('figure.png')).toBe(false);
      expect(isTextFile('diagram.pdf')).toBe(false);
    });
  });

  describe('parseZipArchive', () => {
    it('prepares lightweight descriptor from File without client-side JSZip extraction', async () => {
      const zipBlob = new Blob([new Uint8Array([80, 75, 3, 4, 1, 2])], {
        type: 'application/zip',
      });
      const file = new File([zipBlob], 'sample-paper.zip', { type: 'application/zip' });

      const parsed = await parseZipArchive(file);

      expect(parsed.name).toBe('sample-paper');
      expect(parsed.mainFilePath).toBe('main.tex');
      expect(parsed.zipFile).toBe(file);
      expect(parsed.totalFiles).toBe(1);
      expect(parsed.totalSize).toBe(file.size);
      expect(parsed.textFiles).toHaveLength(1);
      expect(parsed.assetFiles).toHaveLength(0);
    });

    it('uses preferredName and handles empty blobs gracefully', async () => {
      const emptyBlob = new Blob([], { type: 'application/zip' });
      const parsed = await parseZipArchive(emptyBlob, 'Empty Bundle');

      expect(parsed.name).toBe('Empty Bundle');
      expect(parsed.totalFiles).toBe(0);
      expect(parsed.totalSize).toBe(0);
      expect(parsed.items).toEqual([]);
    });
  });

  describe('extractAndImportZipToProject', () => {
    it('prioritizes parentPageId over projectId when importing into an existing manuscript page', async () => {
      const mockResult: ImportProjectZipResult = {
        projectId: 'space-123',
        totalEntries: 5,
        totalDocs: 3,
        totalFiles: 2,
        totalFolders: 1,
        rootDocId: 'doc-root-1',
        rootDocPath: 'main.tex',
      };
      const importSpy = vi
        .spyOn(manuscriptService.export, 'importProjectZip')
        .mockResolvedValueOnce(mockResult);

      const zipFile = new File(['PK-bytes'], 'manuscript.zip', { type: 'application/zip' });
      const progressPhases: string[] = [];

      const res = await extractAndImportZipToProject({
        projectId: 'project-container-1',
        parentPageId: 'page-manuscript-99',
        zipFile,
        onProgress: (p) => progressPhases.push(p.phase),
      });

      expect(importSpy).toHaveBeenCalledTimes(1);
      expect(importSpy).toHaveBeenCalledWith(
        'page-manuscript-99',
        zipFile,
        undefined,
      );
      expect(res.projectId).toBe('space-123');
      expect(res.rootPageId).toBe('doc-root-1');
      expect(res.mainFileId).toBe('doc-root-1');
      expect(res.summary).toEqual(mockResult);
      expect(progressPhases).toEqual(['uploading_assets', 'done']);
    });

    it('falls back to projectId when parentPageId is not supplied', async () => {
      const importSpy = vi
        .spyOn(manuscriptService.export, 'importProjectZip')
        .mockResolvedValueOnce({
          projectId: 'project-container-2',
          totalEntries: 2,
          totalDocs: 2,
          totalFiles: 0,
          totalFolders: 0,
          rootDocId: 'doc-root-2',
        });

      const zipFile = new File(['PK-bytes'], 'paper.zip', { type: 'application/zip' });
      const parsed = await parseZipArchive(zipFile);

      const res = await extractAndImportZipToProject({
        projectId: 'project-container-2',
        extracted: parsed,
      });

      expect(importSpy).toHaveBeenCalledWith(
        'project-container-2',
        zipFile,
        'main.tex',
      );
      expect(res.rootPageId).toBe('doc-root-2');
    });

    it('throws when no ZIP archive file is provided', async () => {
      await expect(
        extractAndImportZipToProject({ projectId: 'project-1' }),
      ).rejects.toThrow('ZIP archive file is required for import.');
    });
  });
});
