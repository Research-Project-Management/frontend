import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  exportDocumentSchema,
  documentExportFormatSchema,
} from '@/features/editor/schemas/export.schema';
import { exportService } from '@/features/editor/services/export.service';
import {
  exportDocumentAsWord,
  exportDocumentAsMarkdown,
} from '@/features/editor/utils/export-document.util';

describe('Document Export Unit Tests (Word .docx and Markdown .md)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Export Schema Validation', () => {
    it('validates docx and md format options', () => {
      expect(documentExportFormatSchema.safeParse('docx').success).toBe(true);
      expect(documentExportFormatSchema.safeParse('md').success).toBe(true);
      expect(documentExportFormatSchema.safeParse('markdown').success).toBe(true);
      expect(documentExportFormatSchema.safeParse('pdf').success).toBe(true);
      expect(documentExportFormatSchema.safeParse('invalid').success).toBe(false);
    });

    it('parses export input with defaults', () => {
      const parsed = exportDocumentSchema.parse({ format: 'docx' });
      expect(parsed.format).toBe('docx');
      expect(parsed.includeChildren).toBe(true);
    });
  });

  describe('2. exportDocumentAsWord', () => {
    it('calls export service with docx format and triggers client download', async () => {
      // Sample base64 representing mock docx file
      const mockBase64 = btoa('PK\x03\x04mock-docx-bytes');

      vi.spyOn(exportService, 'exportDocument').mockResolvedValue({
        filename: 'quantum_paper.docx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        content: mockBase64,
        isBase64: true,
        sizeBytes: 100,
      });

      let downloadedFilename = '';
      let downloadedBlob: any = null;

      const origCreateObjectURL = globalThis.URL.createObjectURL;
      const origRevokeObjectURL = globalThis.URL.revokeObjectURL;
      globalThis.URL.createObjectURL = vi.fn((blob: any) => {
        downloadedBlob = blob;
        return 'blob:mock-docx-url';
      });
      globalThis.URL.revokeObjectURL = vi.fn();

      const origAppend = document.body.appendChild;
      const origRemove = document.body.removeChild;
      document.body.appendChild = vi.fn((el: any) => {
        if (el.download) downloadedFilename = el.download;
        return el;
      });
      document.body.removeChild = vi.fn();

      await exportDocumentAsWord({
        pageId: 'page-123',
        projectTitle: 'Quantum Paper',
      });

      expect(exportService.exportDocument).toHaveBeenCalledWith(
        'page-123',
        'docx',
        true,
      );
      expect(downloadedFilename).toBe('quantum_paper.docx');
      expect(downloadedBlob).not.toBeNull();
      expect(downloadedBlob?.type).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );

      globalThis.URL.createObjectURL = origCreateObjectURL;
      globalThis.URL.revokeObjectURL = origRevokeObjectURL;
      document.body.appendChild = origAppend;
      document.body.removeChild = origRemove;
    });
  });

  describe('3. exportDocumentAsMarkdown', () => {
    it('calls export service with md format and triggers client download', async () => {
      const mockMarkdown = '# Quantum Paper\n\nIntroduction paragraph.';

      vi.spyOn(exportService, 'exportDocument').mockResolvedValue({
        filename: 'quantum_paper.md',
        mimeType: 'text/markdown; charset=utf-8',
        content: mockMarkdown,
        isBase64: false,
        sizeBytes: mockMarkdown.length,
      });

      let downloadedFilename = '';
      let downloadedBlob: any = null;

      const origCreateObjectURL = globalThis.URL.createObjectURL;
      const origRevokeObjectURL = globalThis.URL.revokeObjectURL;
      globalThis.URL.createObjectURL = vi.fn((blob: any) => {
        downloadedBlob = blob;
        return 'blob:mock-md-url';
      });
      globalThis.URL.revokeObjectURL = vi.fn();

      const origAppend = document.body.appendChild;
      const origRemove = document.body.removeChild;
      document.body.appendChild = vi.fn((el: any) => {
        if (el.download) downloadedFilename = el.download;
        return el;
      });
      document.body.removeChild = vi.fn();

      await exportDocumentAsMarkdown({
        pageId: 'page-123',
        projectTitle: 'Quantum Paper',
      });

      expect(exportService.exportDocument).toHaveBeenCalledWith(
        'page-123',
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
