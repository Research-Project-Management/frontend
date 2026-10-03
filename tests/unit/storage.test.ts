import { describe, it, expect } from 'vitest';
import {
  getFileType,
  getFileIcon,
  getFileColor,
  getFileColorClass,
  formatFileSize,
  formatMimeType,
  formatDate,
} from '@/features/storage/utils/storage.util';
import {
  formatDetailedSize,
  formatFileLocation,
  formatDetailedDate,
} from '@/features/storage/utils/preview.util';
import type { StorageItem } from '@/features/storage/types/storage.types';

describe('Storage Utilities & Domain Helpers', () => {
  describe('getFileType', () => {
    it('should identify folder items regardless of filename', () => {
      const item: StorageItem = {
        id: '1',
        filename: 'paper.pdf',
        isFolder: true,
        size: 0,
      };
      expect(getFileType(item)).toBe('folder');
    });

    it('should classify documents by mimeType or extension', () => {
      expect(
        getFileType({ id: '2', filename: 'thesis.pdf', isFolder: false, size: 1024 }),
      ).toBe('document');
      expect(
        getFileType({ id: '3', filename: 'draft.docx', isFolder: false, size: 2048 }),
      ).toBe('document');
      expect(
        getFileType({ id: '4', filename: 'main.tex', isFolder: false, size: 512 }),
      ).toBe('document');
    });

    it('should classify images, videos, audio, and archives', () => {
      expect(
        getFileType({ id: '5', filename: 'figure1.png', isFolder: false, size: 100 }),
      ).toBe('image');
      expect(
        getFileType({ id: '6', filename: 'clip.mp4', isFolder: false, size: 100 }),
      ).toBe('video');
      expect(
        getFileType({ id: '7', filename: 'audio.wav', isFolder: false, size: 100 }),
      ).toBe('audio');
      expect(
        getFileType({ id: '8', filename: 'dataset.zip', isFolder: false, size: 100 }),
      ).toBe('archive');
      expect(
        getFileType({ id: '9', filename: 'binary.xyz', isFolder: false, size: 100 }),
      ).toBe('other');
    });
  });

  describe('formatFileSize', () => {
    it('should format 0 bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });

    it('should handle undefined or null', () => {
      expect(formatFileSize(undefined)).toBe('—');
      expect(formatFileSize(null as any)).toBe('—');
      expect(formatFileSize(NaN)).toBe('—');
    });

    it('should format KB, MB, GB accurately', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(1536 * 1024)).toBe('1.5 MB');
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });

  describe('formatMimeType', () => {
    it('should format known extensions cleanly', () => {
      expect(
        formatMimeType({ id: '1', filename: 'paper.pdf', isFolder: false, size: 0 }),
      ).toBe('PDF Document');
      expect(
        formatMimeType({ id: '2', filename: 'draft.docx', isFolder: false, size: 0 }),
      ).toBe('Word Document');
      expect(
        formatMimeType({ id: '3', filename: 'data.xlsx', isFolder: false, size: 0 }),
      ).toBe('Excel Spreadsheet');
      expect(
        formatMimeType({ id: '4', filename: 'archive.tar', isFolder: false, size: 0 }),
      ).toBe('TAR Archive');
      expect(
        formatMimeType({ id: '5', filename: 'folder', isFolder: true, size: 0 }),
      ).toBe('Folder');
    });
  });

  describe('formatDate', () => {
    it('should format dates relative to current time', () => {
      const now = new Date();
      expect(formatDate(now.toISOString())).toBe('Today');

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      expect(formatDate(yesterday.toISOString())).toBe('Yesterday');

      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      expect(formatDate(threeDaysAgo.toISOString())).toBe('3 days ago');
    });

    it('should handle invalid date gracefully', () => {
      expect(formatDate(undefined)).toBe('—');
      expect(formatDate(null)).toBe('—');
      expect(formatDate('invalid-date')).toBe('—');
    });
  });

  describe('Preview detailed helpers', () => {
    it('formatDetailedSize should format both human and raw byte counts', () => {
      expect(formatDetailedSize(2541200)).toContain('bytes');
      expect(formatDetailedSize(2541200)).toContain('2.4 MB');
      expect(formatDetailedSize(undefined)).toBe('—');
    });

    it('formatFileLocation should show hierarchical path', () => {
      expect(
        formatFileLocation(
          { id: '1', filename: 'test.pdf', isFolder: false, size: 10, parent: 'Datasets' },
          'Quantum Project',
        ),
      ).toBe('Quantum Project / Datasets');

      expect(
        formatFileLocation(
          { id: '2', filename: 'test.pdf', isFolder: false, size: 10, parent: 'Datasets' },
        ),
      ).toBe('My Files / Datasets');

      expect(
        formatFileLocation(
          { id: '3', filename: 'test.pdf', isFolder: false, size: 10 },
        ),
      ).toBe('My Files (Root)');
    });
  });

  describe('getFileColor and getFileColorClass', () => {
    it('should return valid OKLCH colors and Tailwind color classes for all types', () => {
      const types = ['folder', 'document', 'image', 'video', 'audio', 'archive', 'other'] as const;
      for (const t of types) {
        expect(getFileColor(t)).toContain('oklch');
        expect(getFileColorClass(t)).toContain('text-');
      }
    });
  });
});
