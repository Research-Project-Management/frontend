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

    it('prefixes relative file paths with API_BASE_URL or returns normalized path in browser', () => {
      const expected = typeof window !== 'undefined' ? '/uploads/avatar.png' : `${API_BASE_URL}/uploads/avatar.png`;
      expect(resolveFileUrl('/uploads/avatar.png')).toBe(expected);
      expect(resolveFileUrl('uploads/avatar.png')).toBe(expected);
    });
  });

  describe('validateFile', () => {
    it('validates file size correctly', () => {
      const file = new File(['hello world'], 'sample.txt', { type: 'text/plain' });

      // File size is 11 bytes
      expect(validateFile(file, { maxSize: 20 }).valid).toBe(true);
      expect(validateFile(file, { maxSize: 5 }).valid).toBe(false);
      expect(validateFile(file, { maxSize: 5 }).error?.message).toContain('exceeds limit');
    });

    it('validates allowed extensions and mime types', () => {
      const pdf = new File(['%PDF-1.4'], 'document.pdf', { type: 'application/pdf' });
      const img = new File(['data'], 'photo.png', { type: 'image/png' });

      expect(validateFile(pdf, { allowedTypes: ['application/pdf'] }).valid).toBe(true);
      expect(validateFile(pdf, { allowedTypes: ['.pdf'] }).valid).toBe(true);
      expect(validateFile(img, { allowedTypes: ['application/pdf'] }).valid).toBe(false);
      expect(validateFile(img, { allowedTypes: ['.jpg', '.jpeg'] }).valid).toBe(false);
    });

    it('passes validation when no constraints are specified', () => {
      const file = new File(['content'], 'file.bin');
      expect(validateFile(file).valid).toBe(true);
    });
  });

  describe('downloadFileUrl', () => {
    it('creates download anchor and handles click safely in browser environment', () => {
      // In jsdom environment
      expect(() => {
        downloadFileUrl('https://example.com/report.pdf', 'report.pdf');
      }).not.toThrow();
    });
  });
});
