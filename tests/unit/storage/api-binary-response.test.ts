import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, apiGet } from '@/shared/lib/api';
import { ApiError } from '@/shared/types/api.types';
import * as tokenStorage from '@/shared/lib/token-storage';

describe('Frontend API Binary Response & Security Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return Blob when responseType is blob without attempting JSON unwrap', async () => {
    const mockBlob = new Blob(['%PDF-1.7 binary content'], { type: 'application/pdf' });
    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      blob: vi.fn().mockResolvedValue(mockBlob),
      json: vi.fn().mockRejectedValue(new Error('SyntaxError: Unexpected token % in JSON')),
      headers: new Headers({ 'content-type': 'application/pdf' }),
    };

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const result = await apiGet<Blob>('/api/v1/library/files/file-123/content', {
      responseType: 'blob',
    });

    expect(result).toBe(mockBlob);
    expect(mockResponse.blob).toHaveBeenCalledTimes(1);
    expect(mockResponse.json).not.toHaveBeenCalled();
  });

  it('should parse JSON error envelope even when responseType is blob on 4xx/5xx status', async () => {
    const errorPayload = {
      message: 'Attachment not found or embargoed',
      statusCode: 404,
      code: 'ATTACHMENT_NOT_FOUND',
    };

    const mockResponse = {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: vi.fn().mockResolvedValue(errorPayload),
      blob: vi.fn(),
      headers: new Headers({ 'content-type': 'application/json' }),
    };

    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    await expect(
      apiGet<Blob>('/api/v1/library/files/missing-file/content', {
        responseType: 'blob',
        silent: true,
      }),
    ).rejects.toThrow(ApiError);

    expect(mockResponse.json).toHaveBeenCalled();
  });

  it('should not leak Authorization header to third-party external origins', async () => {
    vi.spyOn(tokenStorage, 'getAuthToken').mockReturnValue('super-secret-jwt-token');

    let capturedHeaders: Record<string, string> = {};
    global.fetch = vi.fn().mockImplementation((_url, init) => {
      capturedHeaders = init?.headers || {};
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'ok' }),
        headers: new Headers(),
      });
    });

    // Third-party external URL
    await apiFetch('https://untrusted-external-domain.com/data', 'GET', undefined, {
      silent: true,
    });

    expect(capturedHeaders['Authorization']).toBeUndefined();
  });
});
