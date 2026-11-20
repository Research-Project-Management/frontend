import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  smartUpload,
  MultipartCheckpointStore,
  buildUploadFingerprint,
  USER_ABORT_ERROR_MESSAGE,
} from '@/shared/lib/smart-upload-engine';
import { uploadFileWithDetails, uploadGenericFile } from '@/shared/lib/file-client';
import { uploadFile as uploadExperimentFile } from '@/features/storage/services/upload.service';

interface RecordedXhrCall {
  method: string;
  url: string;
  withCredentials: boolean;
  headers: Record<string, string>;
  bodySize: number;
  aborted: boolean;
}

function createMemoryBackingStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    get length() {
      return store.size;
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    rawMap: store,
  };
}

describe('Unified SmartUploadEngine', () => {
  const OriginalXhr = globalThis.XMLHttpRequest;
  const OriginalFetch = globalThis.fetch;

  let xhrCalls: RecordedXhrCall[];
  let xhrHandler: (
    call: RecordedXhrCall,
    instance: {
      status: number;
      responseText: string;
      headers: Record<string, string>;
    },
  ) => 'ok' | 'network-error' | 'hold';
  let heldXhrAbortHooks: Array<() => void>;

  beforeEach(() => {
    vi.restoreAllMocks();
    xhrCalls = [];
    heldXhrAbortHooks = [];
    xhrHandler = (call, instance) => {
      instance.status = 200;
      instance.headers = { ETag: `"etag-for-${call.url}"` };
      instance.responseText = JSON.stringify({ ok: true });
      return 'ok';
    };

    class MockXMLHttpRequest {
      public withCredentials = false;
      public status = 0;
      public responseText = '';
      public upload: { onprogress: ((e: ProgressEvent) => void) | null } = {
        onprogress: null,
      };
      public onload: (() => void) | null = null;
      public onerror: (() => void) | null = null;
      public onabort: (() => void) | null = null;

      private record: RecordedXhrCall = {
        method: '',
        url: '',
        withCredentials: false,
        headers: {},
        bodySize: 0,
        aborted: false,
      };
      private responseHeaders: Record<string, string> = {};

      open(method: string, url: string) {
        this.record.method = method;
        this.record.url = url;
      }

      setRequestHeader(key: string, value: string) {
        this.record.headers[key] = value;
      }

      getResponseHeader(name: string): string | null {
        const target = name.toLowerCase();
        for (const [k, v] of Object.entries(this.responseHeaders)) {
          if (k.toLowerCase() === target) return v;
        }
        return null;
      }

      abort() {
        this.record.aborted = true;
        this.onabort?.();
      }

      send(body?: unknown) {
        this.record.withCredentials = this.withCredentials;
        if (body && typeof (body as Blob).size === 'number') {
          this.record.bodySize = (body as Blob).size;
        }
        xhrCalls.push(this.record);

        const state = {
          status: 200,
          responseText: '',
          headers: {} as Record<string, string>,
        };
        const outcome = xhrHandler(this.record, state);

        if (outcome === 'hold') {
          heldXhrAbortHooks.push(() => this.abort());
          return;
        }

        queueMicrotask(() => {
          if (this.record.aborted) return;
          if (outcome === 'network-error') {
            this.onerror?.();
            return;
          }
          if (this.upload.onprogress && this.record.bodySize > 0) {
            this.upload.onprogress({
              lengthComputable: true,
              loaded: this.record.bodySize,
              total: this.record.bodySize,
            } as ProgressEvent);
          }
          this.status = state.status;
          this.responseText = state.responseText;
          this.responseHeaders = state.headers;
          this.onload?.();
        });
      }
    }

    (globalThis as unknown as { XMLHttpRequest: typeof XMLHttpRequest }).XMLHttpRequest =
      MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
  });

  afterEach(() => {
    (globalThis as unknown as { XMLHttpRequest: typeof XMLHttpRequest }).XMLHttpRequest =
      OriginalXhr;
    globalThis.fetch = OriginalFetch;
  });

  it('1. Small file (<= 15 MB) instant CAS SHA-256 dedup returns 100% progress with zero PUT uploads', async () => {
    const payload = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    const file = new File([payload], 'arxiv-paper.pdf', { type: 'application/pdf' });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      expect(url).toContain('/api/v1/files/presign');
      const parsedBody = JSON.parse(String(init?.body || '{}')) as {
        contentHash?: string;
      };
      expect(parsedBody.contentHash).toMatch(/^[a-f0-9]{64}$/);
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            deduplicated: true,
            fileId: 'blob-dedup-1',
            blobId: 'blob-dedup-1',
            url: '/api/v1/files/blob-dedup-1/content',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const progressUpdates: number[] = [];
    const result = await smartUpload(file, {
      baseEndpoint: '/api/v1/files',
      onProgress: (p) => progressUpdates.push(p),
    });

    expect(result.deduplicated).toBe(true);
    expect(result.fileId).toBe('blob-dedup-1');
    expect(result.url).toBe('/api/v1/files/blob-dedup-1/content');
    expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    expect(xhrCalls).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('2. Executes presign -> PUT (withCredentials=false for R2, true for local) -> presign/complete cleanly', async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'avatar.png', {
      type: 'image/png',
    });

    const uploadTargets = [
      'https://acc123.r2.cloudflarestorage.com/flux/uploads/staging/u1/f1.png?X-Amz-Signature=sig1',
      '/api/v1/files/local-upload?key=uploads/staging/u1/f2.png&expires=9999999999999&sig=abc',
    ];

    for (const [idx, signedUrl] of uploadTargets.entries()) {
      xhrCalls = [];
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/presign')) {
          return new Response(
            JSON.stringify({
              deduplicated: false,
              uploadUrl: signedUrl,
              storageKey: `uploads/staging/u1/f${idx + 1}.png`,
              fileUuid: `f${idx + 1}`,
              expiresIn: 300,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        expect(url).toContain('/presign/complete');
        return new Response(
          JSON.stringify({
            id: `blob-${idx + 1}`,
            fileId: `blob-${idx + 1}`,
            blobId: `blob-${idx + 1}`,
            url: `/api/v1/files/blob-${idx + 1}/content`,
            filename: 'avatar.png',
            size: 4,
            mimeType: 'image/png',
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        );
      });
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      if (idx === 0) {
        const res = await uploadFileWithDetails({
          file,
          prefix: 'general',
        });
        expect(res.fileId).toBe('blob-1');
        expect(xhrCalls).toHaveLength(1);
        expect(xhrCalls[0].method).toBe('PUT');
        expect(xhrCalls[0].url).toBe(signedUrl);
        expect(xhrCalls[0].withCredentials).toBe(false);
      } else {
        const url = await uploadGenericFile(file, 'project');
        expect(url).toContain('/api/v1/files/blob-2/content');
        expect(xhrCalls).toHaveLength(1);
        expect(xhrCalls[0].method).toBe('PUT');
        expect(xhrCalls[0].withCredentials).toBe(true);
      }
    }
  });

  it('3. Definitive policy error (400/413 from /presign) rejects directly without falling back to POST /upload', async () => {
    const file = new File([new Uint8Array([0x4d, 0x5a])], 'malware.exe', {
      type: 'application/x-msdownload',
    });

    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          message: 'File extension is prohibited for security reasons',
          code: 'BAD_REQUEST',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }) as unknown as typeof fetch;

    await expect(
      smartUpload(file, { baseEndpoint: '/api/v1/files' }),
    ).rejects.toThrow('File extension is prohibited for security reasons');

    expect(xhrCalls).toHaveLength(0);
  });

  it('4. Large file (> 15 MB) persists part ETags across mid-upload failure and resumes ONLY unfinished parts 3 & 4', async () => {
    const FIVE_MB = 5 * 1024 * 1024;
    const SIXTEEN_MB = 16 * 1024 * 1024;
    const bigBytes = new Uint8Array(SIXTEEN_MB);
    bigBytes[0] = 0x50; // P
    bigBytes[1] = 0x4b; // K

    const file = new File([bigBytes], 'big-dataset.zip', {
      type: 'application/zip',
      lastModified: 1700000000000,
    });

    const backing = createMemoryBackingStorage();
    const checkpointStore = new MultipartCheckpointStore(backing);
    const fingerprint = buildUploadFingerprint({
      baseEndpoint: '/api/v1/experiments/files',
      filename: file.name,
      size: file.size,
      lastModified: file.lastModified,
      spaceId: 'space-1',
    });

    let initiateCount = 0;
    let completePartsReceived: Array<{ partNumber: number; eTag: string }> = [];

    const setupFetchMock = () => {
      globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/multipart/initiate')) {
          initiateCount++;
          return new Response(
            JSON.stringify({
              sessionId: 'sess-resume-1',
              uploadId: 'r2-mpu-1',
              partSize: FIVE_MB,
              totalParts: 4,
              deduplicated: false,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (url.includes('/part-url')) {
          const parsedUrl = new URL(url, 'http://localhost');
          const partNumber = Number(parsedUrl.searchParams.get('partNumber'));
          return new Response(
            JSON.stringify({
              partNumber,
              uploadUrl: `https://r2.cloudflarestorage.com/flux/part/${partNumber}`,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (url.includes('/multipart/complete')) {
          const body = JSON.parse(String(init?.body || '{}')) as {
            parts: Array<{ partNumber: number; eTag: string }>;
          };
          completePartsReceived = body.parts;
          return new Response(
            JSON.stringify({
              fileId: 'exp-file-1',
              blobId: 'blob-big-1',
              url: '/api/v1/experiments/files/exp-file-1/content',
              filename: file.name,
              size: file.size,
              mimeType: 'application/zip',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response('{}', { status: 404 });
      }) as unknown as typeof fetch;
    };

    // First attempt: parts 1 & 2 succeed, part 3 & 4 hit network failure
    setupFetchMock();
    xhrHandler = (call, instance) => {
      const partNum = Number(call.url.split('/').pop());
      if (partNum <= 2) {
        instance.status = 200;
        instance.headers = { ETag: `"etag-part-${partNum}"` };
        return 'ok';
      }
      return 'network-error';
    };

    await expect(
      smartUpload(file, {
        baseEndpoint: '/api/v1/experiments/files',
        spaceId: 'space-1',
        concurrency: 1,
        maxPartRetries: 1,
        checkpointStore,
      }),
    ).rejects.toThrow('Network error during upload');

    expect(initiateCount).toBe(1);
    const savedCheckpoint = checkpointStore.load(fingerprint);
    expect(savedCheckpoint).not.toBeNull();
    expect(savedCheckpoint?.sessionId).toBe('sess-resume-1');
    expect(savedCheckpoint?.completedParts).toEqual({
      '1': 'etag-part-1',
      '2': 'etag-part-2',
    });

    // Second attempt: resume should skip parts 1 & 2 and upload ONLY parts 3 & 4
    xhrCalls = [];
    setupFetchMock();
    xhrHandler = (call, instance) => {
      const partNum = Number(call.url.split('/').pop());
      instance.status = 200;
      instance.headers = { ETag: `"etag-part-${partNum}"` };
      return 'ok';
    };

    const resumedProgress: number[] = [];
    const resumedResult = await smartUpload(file, {
      baseEndpoint: '/api/v1/experiments/files',
      spaceId: 'space-1',
      concurrency: 2,
      maxPartRetries: 1,
      checkpointStore,
      onProgress: (p) => resumedProgress.push(p),
    });

    // Still only 1 initiate call (reused checkpoint session!)
    expect(initiateCount).toBe(1);
    expect(xhrCalls.map((c) => c.url)).toEqual([
      'https://r2.cloudflarestorage.com/flux/part/3',
      'https://r2.cloudflarestorage.com/flux/part/4',
    ]);
    // Verify exact chunk byte sizes (part 3 = 5 MB, part 4 = 1 MB remainder)
    expect(xhrCalls.map((c) => c.bodySize)).toEqual([FIVE_MB, SIXTEEN_MB - 3 * FIVE_MB]);
    expect(completePartsReceived).toEqual([
      { partNumber: 1, eTag: 'etag-part-1' },
      { partNumber: 2, eTag: 'etag-part-2' },
      { partNumber: 3, eTag: 'etag-part-3' },
      { partNumber: 4, eTag: 'etag-part-4' },
    ]);
    expect(resumedProgress[0]).toBeGreaterThanOrEqual(60);
    expect(resumedProgress[resumedProgress.length - 1]).toBe(100);
    expect(checkpointStore.load(fingerprint)).toBeNull();
    expect(resumedResult.fileId).toBe('exp-file-1');

    // Also ensure experiments facade uploadFile exports seamlessly
    expect(typeof uploadExperimentFile).toBe('function');
  });

  it('5. Explicit user cancellation sends DELETE /multipart/:sessionId, clears checkpoint, and rejects cleanly', async () => {
    const file = new File([new Uint8Array(2 * 1024 * 1024)], 'abort-target.bin', {
      type: 'application/octet-stream',
      lastModified: 1700000001234,
    });

    const backing = createMemoryBackingStorage();
    const checkpointStore = new MultipartCheckpointStore(backing);
    const fingerprint = buildUploadFingerprint({
      baseEndpoint: '/api/v1/files',
      filename: file.name,
      size: file.size,
      lastModified: file.lastModified,
    });

    let deleteEndpointCalled = '';
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/multipart/initiate')) {
        return new Response(
          JSON.stringify({
            sessionId: 'sess-abort-99',
            uploadId: 'r2-mpu-abort',
            partSize: 1024 * 1024,
            totalParts: 2,
            deduplicated: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('/part-url')) {
        return new Response(
          JSON.stringify({
            partNumber: 1,
            uploadUrl: 'https://r2.cloudflarestorage.com/flux/part/1',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (init?.method === 'DELETE' && url.includes('/multipart/sess-abort-99')) {
        deleteEndpointCalled = url;
        return new Response(JSON.stringify({ aborted: true }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    }) as unknown as typeof fetch;

    xhrHandler = () => 'hold';
    const abortController = new AbortController();

    const uploadPromise = smartUpload(file, {
      baseEndpoint: '/api/v1/files',
      multipartThresholdBytes: 512 * 1024,
      concurrency: 1,
      signal: abortController.signal,
      checkpointStore,
    });

    // Wait until first XHR PUT is in-flight, then cancel
    await vi.waitFor(() => {
      expect(xhrCalls.length).toBe(1);
    });
    abortController.abort();

    await expect(uploadPromise).rejects.toThrow(USER_ABORT_ERROR_MESSAGE);
    expect(deleteEndpointCalled).toContain('/api/v1/files/multipart/sess-abort-99');
    expect(checkpointStore.load(fingerprint)).toBeNull();
  });

  it('6. Forwards headers to backend APIs only (never external R2 PUT), honors precomputed contentHash, directUploadEndpoint, and partUrl', async () => {
    const precomputedHash = 'a'.repeat(64);
    const spaceId = '11111111-1111-4111-8111-111111111111';
    const file = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'library-paper.pdf', {
      type: 'application/pdf',
    });

    const apiHeadersSeen: Array<Record<string, string>> = [];
    const presignBodies: Array<Record<string, unknown>> = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const reqHeaders = new Headers(init?.headers);
      const headerRecord: Record<string, string> = {};
      reqHeaders.forEach((v, k) => {
        headerRecord[k.toLowerCase()] = v;
      });
      apiHeadersSeen.push(headerRecord);

      if (url.endsWith('/presign')) {
        presignBodies.push(JSON.parse(String(init?.body || '{}')) as Record<string, unknown>);
        return new Response(
          JSON.stringify({
            deduplicated: false,
            uploadUrl: 'https://acc123.r2.cloudflarestorage.com/flux/uploads/staging/u1/paper.pdf',
            storageKey: 'uploads/staging/u1/paper.pdf',
            fileUuid: 'lib-file-1',
            expiresIn: 300,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          success: true,
          fileId: 'lib-blob-1',
          url: '/api/v1/files/lib-blob-1/content',
          filename: 'library-paper.pdf',
          size: 4,
          mimeType: 'application/pdf',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as unknown as typeof fetch;

    const res = await smartUpload(file, {
      baseEndpoint: `/api/v1/spaces/${spaceId}/library/attachments`,
      directUploadEndpoint: `/api/v1/spaces/${spaceId}/library/upload`,
      spaceId,
      contentHash: precomputedHash,
      headers: { 'X-Space-Id': spaceId },
    });

    expect(res.fileId).toBe('lib-blob-1');
    expect(presignBodies[0]?.contentHash).toBe(precomputedHash);
    expect(presignBodies[0]?.spaceId).toBe(spaceId);
    expect(apiHeadersSeen).toHaveLength(2);
    expect(apiHeadersSeen[0]['x-space-id']).toBe(spaceId);
    expect(apiHeadersSeen[1]['x-space-id']).toBe(spaceId);
    // External R2 PUT receives only Content-Type, NEVER X-Space-Id
    expect(xhrCalls).toHaveLength(1);
    expect(xhrCalls[0].headers['X-Space-Id']).toBeUndefined();

    // Verify directUploadEndpoint fallback on non-definitive presign error (502) and multipart partUrl compatibility
    xhrCalls = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/presign')) {
        return new Response('Bad Gateway', { status: 502 });
      }
      return new Response('{}', { status: 404 });
    }) as unknown as typeof fetch;

    xhrHandler = (_call, instance) => {
      instance.status = 201;
      instance.responseText = JSON.stringify({
        success: true,
        fileId: 'fallback-blob-1',
        url: '/api/v1/files/fallback-blob-1/content',
        filename: 'library-paper.pdf',
        size: 4,
        mimeType: 'application/pdf',
      });
      return 'ok';
    };

    const fallbackRes = await smartUpload(file, {
      baseEndpoint: `/api/v1/spaces/${spaceId}/library/attachments`,
      directUploadEndpoint: `/api/v1/spaces/${spaceId}/library/upload`,
      spaceId,
      headers: { 'X-Space-Id': spaceId },
    });

    expect(fallbackRes.fileId).toBe('fallback-blob-1');
    expect(xhrCalls).toHaveLength(1);
    expect(xhrCalls[0].method).toBe('POST');
    expect(xhrCalls[0].url).toContain(`/api/v1/spaces/${spaceId}/library/upload`);
    expect(xhrCalls[0].headers['X-Space-Id']).toBe(spaceId);

    // Multipart partUrl fallback compatibility
    const bigFile = new File([new Uint8Array(64)], 'big.pdf', { type: 'application/pdf' });
    xhrCalls = [];
    xhrHandler = (_call, instance) => {
      instance.status = 200;
      instance.headers = { ETag: '"etag-1"' };
      return 'ok';
    };
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/multipart/initiate')) {
        return new Response(
          JSON.stringify({
            sessionId: 'sess-parturl-1',
            uploadId: 'mpu-1',
            partSize: 64,
            totalParts: 1,
            deduplicated: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('/part-url')) {
        return new Response(
          JSON.stringify({ partNumber: 1, partUrl: 'https://r2.example.com/mpu-part-1' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          fileId: 'mpu-blob-1',
          url: '/api/v1/files/mpu-blob-1/content',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as unknown as typeof fetch;

    const mpuRes = await smartUpload(bigFile, {
      baseEndpoint: `/api/v1/spaces/${spaceId}/library/attachments`,
      multipartThresholdBytes: 32,
      contentHash: precomputedHash,
    });
    expect(mpuRes.fileId).toBe('mpu-blob-1');
    expect(xhrCalls[0].url).toBe('https://r2.example.com/mpu-part-1');
  });

  it('7. Batch-fetches presigned part URLs via POST /multipart/:sessionId/part-urls in a single request and skips single /part-url', async () => {
    const file = new File([new Uint8Array(96)], 'batch-paper.bin', {
      type: 'application/octet-stream',
    });

    const requestedEndpoints: string[] = [];
    let batchRequestParts: number[] = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requestedEndpoints.push(url);
      if (url.includes('/multipart/initiate')) {
        return new Response(
          JSON.stringify({
            sessionId: 'sess-batch-1',
            uploadId: 'r2-batch-mpu',
            partSize: 32,
            totalParts: 3,
            deduplicated: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('/part-urls')) {
        const parsed = JSON.parse(String(init?.body || '{}')) as {
          partNumbers?: number[];
        };
        batchRequestParts = parsed.partNumbers ?? [];
        return new Response(
          JSON.stringify({
            parts: batchRequestParts.map((partNumber) => ({
              partNumber,
              uploadUrl: `https://r2.example.com/batch-part/${partNumber}`,
            })),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('/multipart/complete')) {
        return new Response(
          JSON.stringify({
            fileId: 'batch-blob-1',
            blobId: 'batch-blob-1',
            url: '/api/v1/files/batch-blob-1/content',
            filename: 'batch-paper.bin',
            size: 96,
            mimeType: 'application/octet-stream',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('{}', { status: 404 });
    }) as unknown as typeof fetch;

    xhrCalls = [];
    xhrHandler = (call, instance) => {
      const partNum = call.url.split('/').pop();
      instance.status = 200;
      instance.headers = { ETag: `"etag-batch-${partNum}"` };
      return 'ok';
    };

    const res = await smartUpload(file, {
      baseEndpoint: '/api/v1/files',
      multipartThresholdBytes: 32,
      concurrency: 2,
    });

    expect(res.fileId).toBe('batch-blob-1');
    expect(batchRequestParts).toEqual([1, 2, 3]);
    expect(requestedEndpoints.filter((u) => u.includes('/part-urls'))).toHaveLength(1);
    expect(requestedEndpoints.some((u) => u.endsWith('/part-url') || u.includes('/part-url?'))).toBe(false);
    expect(xhrCalls).toHaveLength(3);
  });
});
