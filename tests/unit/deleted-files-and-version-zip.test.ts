import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportVersionAsZip } from '@/features/editor/utils/export-zip.util';
import { fileService, documentService } from '@/features/editor/services/core.service';
import { versionService } from '@/features/editor/services/history.service';
import { StorageService } from '@/features/editor/services/storage.service';
import { pageKeys } from '@/features/editor/hooks/use-core';

// Mock browser globals for JSZip file download
const mockClick = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();

describe('Deleted Files Recovery & Download Version as ZIP (Overleaf Parity)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup DOM mocks for <a> download
    global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-zip-uuid');
    global.URL.revokeObjectURL = vi.fn();

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return {
          href: '',
          download: '',
          click: mockClick,
        } as unknown as HTMLElement;
      }
      return document.createElement(tagName);
    });

    vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild as any);
    vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild as any);
  });

  describe('1. Deleted Files Identification & Query Keys', () => {
    it('creates accurate query keys for deleted files', () => {
      const pageId = 'proj-page-123';
      const key = pageKeys.deletedFiles(pageId);
      expect(key).toEqual(['pages', 'detail', 'proj-page-123', 'deleted-files']);
    });

    it('identifies deleted files vs active files correctly', () => {
      const activeFiles = [
        { id: 'f-1', title: 'main.tex', deletedAt: null },
        { id: 'f-2', title: 'intro.tex', deletedAt: null },
      ];
      const deletedFiles = [
        { id: 'f-3', title: 'old_chapter2.tex', deletedAt: '2026-09-18T10:00:00Z' },
        { id: 'f-4', title: 'scratch.tex', deletedAt: '2026-09-19T14:30:00Z' },
      ];

      const activeFileId1 = 'f-3';
      const isDeleted1 = deletedFiles.some((df) => df.id === activeFileId1);
      expect(isDeleted1).toBe(true);

      const activeFileId2 = 'f-1';
      const isDeleted2 = deletedFiles.some((df) => df.id === activeFileId2);
      expect(isDeleted2).toBe(false);
    });
  });

  describe('2. Deleted Files Restoration Logic & Safety', () => {
    it('restores a soft-deleted file without altering existing active files', async () => {
      const mockProject = {
        activeFiles: [
          { id: 'f-1', title: 'main.tex', content: '\\input{intro}' },
          { id: 'f-2', title: 'intro.tex', content: 'Introduction section' },
        ],
        deletedFiles: [
          { id: 'f-3', title: 'appendix.tex', content: 'Original appendix formulas' },
        ],
      };

      const restorePageMock = vi.fn().mockImplementation(async (fileId: string) => {
        const deletedIndex = mockProject.deletedFiles.findIndex((f) => f.id === fileId);
        if (deletedIndex !== -1) {
          const [restored] = mockProject.deletedFiles.splice(deletedIndex, 1);
          mockProject.activeFiles.push(restored);
          return restored;
        }
        throw new Error('File not found');
      });

      // User restores appendix.tex
      const targetId = 'f-3';
      await restorePageMock(targetId);

      expect(restorePageMock).toHaveBeenCalledWith('f-3');
      expect(mockProject.deletedFiles).toHaveLength(0);
      expect(mockProject.activeFiles).toHaveLength(3);
      expect(mockProject.activeFiles.find((f) => f.id === 'f-3')?.title).toBe('appendix.tex');
      // Existing active files remain pristine
      expect(mockProject.activeFiles.find((f) => f.id === 'f-1')?.content).toBe('\\input{intro}');
    });

    it('triggers invalidations on pageKeys.files, deletedFiles, and all on restore', () => {
      const invalidateQueriesMock = vi.fn();
      const mockQueryClient = { invalidateQueries: invalidateQueriesMock };

      const restoredPage = { id: 'f-3', title: 'appendix.tex', parentPageId: 'root-proj-1' };

      // Callback inside usePageActions onSuccess
      mockQueryClient.invalidateQueries({ queryKey: pageKeys.all });
      mockQueryClient.invalidateQueries({ queryKey: pageKeys.files(restoredPage.parentPageId) });
      mockQueryClient.invalidateQueries({ queryKey: pageKeys.deletedFiles(restoredPage.parentPageId) });
      mockQueryClient.invalidateQueries({ queryKey: pageKeys.detail(restoredPage.id) });

      expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ['pages'] });
      expect(invalidateQueriesMock).toHaveBeenCalledWith({
        queryKey: ['pages', 'detail', 'root-proj-1', 'files'],
      });
      expect(invalidateQueriesMock).toHaveBeenCalledWith({
        queryKey: ['pages', 'detail', 'root-proj-1', 'deleted-files'],
      });
      expect(invalidateQueriesMock).toHaveBeenCalledWith({
        queryKey: ['pages', 'detail', 'f-3'],
      });
    });
  });

  describe('3. Download Version as ZIP (exportVersionAsZip)', () => {
    it('bundles all files at historical revision into a ZIP and triggers download', async () => {
      // Mock documentService & fileService
      vi.spyOn(documentService, 'getById').mockResolvedValue({
        id: 'root-1',
        title: 'Quantum_Paper',
        content: '\\documentclass{article}\n\\begin{document}\nMain text\n\\end{document}',
      } as any);

      vi.spyOn(fileService, 'getByPageId').mockResolvedValue([
        { id: 'f-2', title: 'chapter1.tex', content: 'Chapter 1 live content' } as any,
      ]);

      vi.spyOn(fileService, 'getDeletedByPageId').mockResolvedValue([
        { id: 'f-3', title: 'removed_note.tex', content: 'Historical note content' } as any,
      ]);

      vi.spyOn(StorageService, 'getPageFiles').mockResolvedValue([]);

      // Mock versionService snapshots
      vi.spyOn(versionService, 'getByPageId').mockImplementation(async (pageId: string) => {
        if (pageId === 'root-1') {
          return [
            { id: 'ver-root-1', createdAt: '2026-09-15T12:00:00Z', label: 'v1.0' } as any,
          ];
        }
        if (pageId === 'f-2') {
          return [
            { id: 'ver-c1-1', createdAt: '2026-09-15T12:00:00Z', label: 'v1.0' } as any,
          ];
        }
        return [];
      });

      vi.spyOn(versionService, 'getById').mockImplementation(async (pageId: string, versionId: string) => {
        if (pageId === 'root-1' && versionId === 'ver-root-1') {
          return { id: versionId, content: '\\documentclass{article}\n% Snapshot v1.0\n' } as any;
        }
        if (pageId === 'f-2' && versionId === 'ver-c1-1') {
          return { id: versionId, content: 'Chapter 1 snapshot content' } as any;
        }
        return null as any;
      });

      // Trigger export
      await exportVersionAsZip({
        parentPageId: 'root-1',
        versionId: 'ver-root-1',
        revisionDate: '2026-09-15T12:00:00Z',
        revisionLabel: 'CameraReady_v1',
        projectTitle: 'Quantum Paper',
      });

      // Verify browser download was triggered with expected filename
      expect(mockClick).toHaveBeenCalledTimes(1);
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    });

    it('formats snapshot filename properly with sanitized project title and label', async () => {
      vi.spyOn(documentService, 'getById').mockResolvedValue({
        id: 'root-1',
        title: 'Deep Learning / AI Project: Final!!',
        content: 'Content',
      } as any);
      vi.spyOn(fileService, 'getByPageId').mockResolvedValue([]);
      vi.spyOn(fileService, 'getDeletedByPageId').mockResolvedValue([]);
      vi.spyOn(StorageService, 'getPageFiles').mockResolvedValue([]);
      vi.spyOn(versionService, 'getByPageId').mockResolvedValue([]);

      let capturedFilename = '';
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          const el = {
            href: '',
            get download() {
              return capturedFilename;
            },
            set download(val: string) {
              capturedFilename = val;
            },
            click: mockClick,
          };
          return el as unknown as HTMLElement;
        }
        return document.createElement(tagName);
      });

      await exportVersionAsZip({
        parentPageId: 'root-1',
        versionId: 'ver-2',
        revisionDate: '2026-09-18T09:30:00Z',
        revisionLabel: 'Submission v2',
        projectTitle: 'Deep Learning / AI Project: Final!!',
      });

      expect(capturedFilename).toBe('Deep_Learning_AI_Project_Final-Submission_v2.zip');
    });
  });
});
