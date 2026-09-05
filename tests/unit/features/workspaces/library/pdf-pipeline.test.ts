import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getPaperFileUrl } from '@/features/workspaces/library/utils/library.util';
import { fetchPdfBlob } from '@/features/workspaces/library/services/catalog.service';
import { usePdf } from '@/features/workspaces/library/hooks/reader/use-pdf';
import { renderHook, act, waitFor } from '@testing-library/react';

describe('Frontend Library PDF Pipeline & Security Hardening Tests', () => {
  const originalFetch = globalThis.fetch;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('accessToken', 'jwt-test-token-xyz');
    URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost:3000/mock-uuid');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  describe('getPaperFileUrl (Primary PDF Selection & Origin Safety)', () => {
    it('prioritizes attachment with attachmentType === "primary_pdf" over index 0 supplementary attachment', () => {
      const paper: any = {
        id: 'paper-1',
        title: 'Quantum Deep Learning',
        attachments: [
          {
            id: 'att-supp',
            attachmentType: 'supplementary_data',
            mimeType: 'text/csv',
            filename: 'dataset.csv',
            fileId: 'file-csv',
            url: '/api/files/file-csv/content',
          },
          {
            id: 'att-primary',
            attachmentType: 'primary_pdf',
            mimeType: 'application/pdf',
            filename: 'quantum.pdf',
            fileId: 'file-primary-pdf',
            url: '/api/files/file-primary-pdf/content',
          },
        ],
      };

      const result = getPaperFileUrl(paper);
      expect(result).toBe('/api/files/file-primary-pdf/content');
    });

    it('does NOT choose supplementary non-PDF attachment at index 0 if no PDF attachment exists', () => {
      const paper: any = {
        id: 'paper-2',
        title: 'Dataset Only',
        attachments: [
          {
            id: 'att-zip',
            attachmentType: 'supplementary_archive',
            mimeType: 'application/zip',
            filename: 'code.zip',
            fileId: 'file-zip',
            url: '/api/files/file-zip/content',
          },
        ],
      };

      const result = getPaperFileUrl(paper);
      expect(result).toBe('');
    });

    it('does NOT fall back to paper.url (external DOI/publisher landing page)', () => {
      const paper: any = {
        id: 'paper-3',
        title: 'Nature Paper',
        url: 'https://nature.com/articles/s41586-020-0001',
        doi: '10.1038/s41586-020-0001',
        attachments: [],
      };

      const result = getPaperFileUrl(paper);
      expect(result).toBe('');
    });

    it('canonicalizes legacy metadata URL /api/files/:fileId to /api/files/:fileId/content', () => {
      const paper: any = {
        id: 'paper-4',
        fileUrl: '/api/files/file-legacy-999',
      };

      const result = getPaperFileUrl(paper);
      expect(result).toBe('/api/files/file-legacy-999/content');
    });

    it('preserves user arXiv fallback when paper has arxivId or arXiv DOI', () => {
      const paper: any = {
        id: 'paper-arxiv',
        title: 'Attention Is All You Need',
        doi: 'arxiv.1706.03762',
      };

      const result = getPaperFileUrl(paper);
      expect(result).toBe('https://arxiv.org/pdf/1706.03762.pdf');
    });
  });

  describe('fetchPdfBlob (Token Security & PDF Signature Validation)', () => {
    it('includes Authorization header for same-origin API endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        blob: async () => new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35])], { type: 'application/pdf' }),
      });
      globalThis.fetch = mockFetch;

      await fetchPdfBlob('/api/files/file-123/content');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1]?.headers || {};
      expect(headers['Authorization']).toBe('Bearer jwt-test-token-xyz');
    });

    it('does NOT include Authorization header when fetching from third-party URL (attacker.example)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        blob: async () => new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35])], { type: 'application/pdf' }),
      });
      globalThis.fetch = mockFetch;

      await fetchPdfBlob('https://attacker.example/malicious.pdf');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1]?.headers || {};
      expect(headers['Authorization']).toBeUndefined();
    });

    it('keeps static attachment previews on the frontend origin', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        blob: async () => new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], { type: 'application/pdf' }),
      });
      globalThis.fetch = mockFetch;

      await fetchPdfBlob('/papers/local-attachment.pdf');

      expect(mockFetch).toHaveBeenCalledWith(
        '/papers/local-attachment.pdf',
        expect.objectContaining({ credentials: 'same-origin' }),
      );
      expect(mockFetch.mock.calls[0][1]?.headers.Authorization).toBeUndefined();
    });

    it('rejects JSON error responses disguised as 200 OK blobs', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        blob: async () => new Blob([JSON.stringify({ message: 'File is in trash' })], { type: 'application/json' }),
      });
      globalThis.fetch = mockFetch;

      await expect(fetchPdfBlob('/api/files/file-trashed/content')).rejects.toThrow(
        /Invalid PDF response|JSON/,
      );
    });

    it('rejects binary responses that do not start with %PDF- signature', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        blob: async () =>
          new Blob(
            [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
            { type: 'application/pdf' },
          ),
      });
      globalThis.fetch = mockFetch;

      await expect(fetchPdfBlob('/api/files/file-corrupt/content')).rejects.toThrow(
        /Invalid document format: missing %PDF- signature/i,
      );
    });

    it('rejects empty blobs (< 5 bytes)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        blob: async () => new Blob([], { type: 'application/pdf' }),
      });
      globalThis.fetch = mockFetch;

      await expect(fetchPdfBlob('/api/files/file-empty/content')).rejects.toThrow(
        /Empty or invalid document payload/i,
      );
    });
  });

  describe('usePdf Hook (Lifecycle, AbortController & Retry)', () => {
    it('creates object URL on success and revokes on unmount', async () => {
      const validPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        blob: async () => new Blob([validPdfBytes], { type: 'application/pdf' }),
      });

      const { result, unmount } = renderHook(() =>
        usePdf('/api/files/file-valid/content'),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.blobUrl).toBe('blob:http://localhost:3000/mock-uuid');
        expect(result.current.error).toBeNull();
      });

      unmount();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost:3000/mock-uuid');
    });

    it('sets error state on failure and allows retry to succeed', async () => {
      let callCount = 0;
      const validPdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            headers: new Headers(),
          });
        }
        return Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'application/pdf' }),
          blob: async () => new Blob([validPdfBytes], { type: 'application/pdf' }),
        });
      });

      const { result } = renderHook(() =>
        usePdf('/api/files/file-retry/content'),
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toMatch(/Not Found/);
        expect(result.current.blobUrl).toBeNull();
      });

      // Trigger retry
      act(() => {
        result.current.retry();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.blobUrl).toBe('blob:http://localhost:3000/mock-uuid');
      });

      expect(callCount).toBe(2);
    });
  });
});
