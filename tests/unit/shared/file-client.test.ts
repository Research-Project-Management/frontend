import { describe, it, expect } from 'vitest';
import {
  resolveFileUrl,
  validateFile,
  downloadFileUrl,
} from '@/shared/lib/file-client';
import { API_BASE_URL } from '@/config/env';

describe('file-client Deep Module', () => {
  describe('resolveFileUrl', () => {
    it('handles null, undefined and empty values safely', () => {
      expect(resolveFileUrl(null)).toBeNull();
      expect(resolveFileUrl(undefined)).toBeNull();
      expect(resolveFileUrl('')).toBeNull();
    });

    it('preserves fully-qualified HTTP/HTTPS URLs', () => {
      expect(resolveFileUrl('https://s3.amazonaws.com/bucket/doc.pdf')).toBe(
        'https://s3.amazonaws.com/bucket/doc.pdf',
      );
      expect(resolveFileUrl('http://localhost:8000/static/file.png')).toBe(
        'http://localhost:8000/static/file.png',
      );
    });

    it('prefixes relative file paths with API_BASE_URL', () => {
      expect(resolveFileUrl('/uploads/avatar.png')).toBe(
        `${API_BASE_URL}/uploads/avatar.png`,
      );
      expect(resolveFileUrl('uploads/avatar.png')).toBe(
        `${API_BASE_URL}/uploads/avatar.png`,
      );
    });
  });

  describe('validateFile', () => {
    it('validates file size correctly', () => {
      const file = new File(['hello world'], 'sample.txt', { type: 'text/plain' });

      // File size is 11 bytes
      const validRes = validateFile(file, { maxSize: 100 });
      expect(validRes.valid).toBe(true);
      expect(validRes.error).toBeUndefined();

      const invalidRes = validateFile(file, { maxSize: 5 });
      expect(invalidRes.valid).toBe(false);
      expect(invalidRes.error?.message).toContain('File size exceeds limit');
    });

    it('validates allowed extensions and mime types', () => {
      const pdfFile = new File(['%PDF'], 'paper.pdf', { type: 'application/pdf' });
      const imgFile = new File(['img-bytes'], 'photo.png', { type: 'image/png' });

      expect(validateFile(pdfFile, { allowedTypes: ['.pdf'] }).valid).toBe(true);
      expect(validateFile(pdfFile, { allowedTypes: ['application/pdf'] }).valid).toBe(true);
      expect(validateFile(pdfFile, { allowedTypes: ['image/*'] }).valid).toBe(false);

      expect(validateFile(imgFile, { allowedTypes: ['image/*'] }).valid).toBe(true);
      expect(validateFile(imgFile, { allowedTypes: ['.png', '.jpg'] }).valid).toBe(true);
      expect(validateFile(imgFile, { allowedTypes: ['.pdf'] }).valid).toBe(false);
    });

    it('passes validation when no constraints are specified', () => {
      const file = new File(['content'], 'data.bin', { type: 'application/octet-stream' });
      expect(validateFile(file).valid).toBe(true);
    });
  });

  describe('downloadFileUrl', () => {
    it('creates download anchor and handles click safely in browser environment', () => {
      expect(() => {
        downloadFileUrl('/files/export.csv', 'export.csv');
      }).not.toThrow();
    });
  });
});
