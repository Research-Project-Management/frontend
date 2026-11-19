/**
 * Unified Smart Upload Engine for Flux Frontend.
 * Consolidates client SHA-256 instant CAS deduplication, automatic size-based routing
 * (Single Presigned PUT <= 15 MB vs Parallel Resumable Multipart > 15 MB),
 * persistent localStorage/memory checkpoints for network-drop resume, and clean abort.
 */

import { API_BASE_URL } from '@/config/env';
import {
  apiDelete,
  apiGet,
  apiPost,
  getAuthToken,
  getEffectiveBaseUrl,
  isApiError,
} from '@/shared/lib/api';

export const DEFAULT_MULTIPART_THRESHOLD_BYTES = 15 * 1024 * 1024;
export const MAX_CLIENT_HASH_BYTES = 50 * 1024 * 1024;
export const DEFAULT_PART_CONCURRENCY = 3;
export const DEFAULT_PART_MAX_RETRIES = 3;
export const CHECKPOINT_TTL_MS = 20 * 60 * 60 * 1000;
export const USER_ABORT_ERROR_MESSAGE = 'Upload aborted by user';

const CHECKPOINT_KEY_PREFIX = 'flux:upload-ckpt:v1:';
const MAX_CHECKPOINTS = 30;
const DEFINITIVE_CLIENT_ERROR_STATUSES = new Set([400, 401, 403, 413, 422]);

export class UploadHttpError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'UploadHttpError';
    this.status = status;
    this.code = code;
  }
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length: number;
  key(index: number): string | null;
}

export interface MultipartCheckpoint {
  sessionId: string;
  uploadId?: string;
  partSize: number;
  totalParts: number;
  totalSize: number;
  createdAt: number;
  expiresAt: number;
  completedParts: Record<string, string>;
}

export interface UploadFingerprintInput {
  baseEndpoint: string;
  filename: string;
  size: number;
  lastModified?: number;
  spaceId?: string;
  parentId?: string | null;
  pageId?: string | null;
}

export interface SmartUploadOptions {
  baseEndpoint?: string;
  filename?: string;
  mimeType?: string;
  spaceId?: string;
  projectId?: string;
  pageId?: string;
  parentId?: string | null;
  metaData?: Record<string, unknown> | null;
  multipartThresholdBytes?: number;
  concurrency?: number;
  maxPartRetries?: number;
  allowDirectFallback?: boolean;
  extraFormFields?: Record<string, string>;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
  resolveUrl?: (path: string | null | undefined) => string | null;
  checkpointStore?: MultipartCheckpointStore;
}

export interface SmartUploadResult {
  fileId: string;
  blobId?: string;
  url: string;
  path: string;
  filename: string;
  size: number;
  mimeType: string;
  deduplicated?: boolean;
}

interface PresignResponsePayload {
  uploadUrl?: string;
  storageKey?: string;
  fileUuid?: string;
  expiresIn?: number;
  deduplicated?: boolean;
  fileId?: string;
  blobId?: string;
  url?: string;
  path?: string;
}

interface UploadCompletePayload {
  id?: string;
  fileId?: string;
  blobId?: string;
  url?: string;
  path?: string;
  filename?: string;
  size?: number;
  mimeType?: string;
  file?: { id?: string; url?: string; filename?: string; size?: number };
}

interface InitiateMultipartPayload {
  sessionId: string;
  uploadId?: string;
  partSize: number;
  totalParts: number;
  deduplicated?: boolean;
  fileId?: string;
  blobId?: string;
  url?: string;
  path?: string;
}

interface PartUrlPayload {
  partNumber: number;
  uploadUrl: string;
}

export function buildUploadFingerprint(input: UploadFingerprintInput): string {
  return [
    input.baseEndpoint.replace(/\/+$/, ''),
    input.filename,
    String(input.size),
    String(input.lastModified ?? 0),
    input.spaceId ?? '',
    input.parentId ?? '',
    input.pageId ?? '',
  ].join('|');
}

export class MultipartCheckpointStore {
  private readonly memoryFallback = new Map<string, string>();
  private readonly backingStorage?: StorageLike;

  constructor(backingStorage?: StorageLike) {
    if (backingStorage) {
      this.backingStorage = backingStorage;
    } else if (typeof window !== 'undefined') {
      try {
        const probeKey = `${CHECKPOINT_KEY_PREFIX}__probe__`;
        window.localStorage.setItem(probeKey, '1');
        window.localStorage.removeItem(probeKey);
        this.backingStorage = window.localStorage;
      } catch {
        this.backingStorage = undefined;
      }
    }
  }

  private getStorageKey(fingerprint: string): string {
    return `${CHECKPOINT_KEY_PREFIX}${fingerprint}`;
  }

  private readRaw(storageKey: string): string | null {
    if (this.backingStorage) {
      try {
        const val = this.backingStorage.getItem(storageKey);
        if (val !== null) return val;
      } catch {
        // Fall back to memory map
      }
    }
    return this.memoryFallback.get(storageKey) ?? null;
  }

  private writeRaw(storageKey: string, value: string): void {
    this.memoryFallback.set(storageKey, value);
    if (this.backingStorage) {
      try {
        this.backingStorage.setItem(storageKey, value);
      } catch {
        // Non-fatal if storage quota is full
      }
    }
  }

  private deleteRaw(storageKey: string): void {
    this.memoryFallback.delete(storageKey);
    if (this.backingStorage) {
      try {
        this.backingStorage.removeItem(storageKey);
      } catch {
        // Non-fatal
      }
    }
  }

  private listAllKeys(): string[] {
    const keys = new Set<string>(this.memoryFallback.keys());
    if (this.backingStorage) {
      try {
        for (let i = 0; i < this.backingStorage.length; i++) {
          const k = this.backingStorage.key(i);
          if (k && k.startsWith(CHECKPOINT_KEY_PREFIX)) {
            keys.add(k);
          }
        }
      } catch {
        // Ignore enumeration failures
      }
    }
    return Array.from(keys).filter(
      (k) => k.startsWith(CHECKPOINT_KEY_PREFIX) && k !== `${CHECKPOINT_KEY_PREFIX}__probe__`,
    );
  }

  load(fingerprint: string, now = Date.now()): MultipartCheckpoint | null {
    const storageKey = this.getStorageKey(fingerprint);
    const raw = this.readRaw(storageKey);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as MultipartCheckpoint;
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        typeof parsed.sessionId !== 'string' ||
        !parsed.sessionId ||
        typeof parsed.partSize !== 'number' ||
        parsed.partSize <= 0 ||
        typeof parsed.totalParts !== 'number' ||
        parsed.totalParts < 1 ||
        typeof parsed.expiresAt !== 'number' ||
        parsed.expiresAt <= now
      ) {
        this.deleteRaw(storageKey);
        return null;
      }
      return {
        ...parsed,
        completedParts:
          parsed.completedParts && typeof parsed.completedParts === 'object'
            ? parsed.completedParts
            : {},
      };
    } catch {
      this.deleteRaw(storageKey);
      return null;
    }
  }

  save(fingerprint: string, checkpoint: MultipartCheckpoint): void {
    const now = Date.now();
    this.pruneExpired(now);

    const normalized: MultipartCheckpoint = {
      ...checkpoint,
      createdAt: checkpoint.createdAt || now,
      expiresAt: checkpoint.expiresAt || now + CHECKPOINT_TTL_MS,
      completedParts: checkpoint.completedParts || {},
    };
    this.writeRaw(this.getStorageKey(fingerprint), JSON.stringify(normalized));
    this.enforceMaxEntries(now);
  }

  recordPart(fingerprint: string, partNumber: number, eTag: string): void {
    const existing = this.load(fingerprint);
    if (!existing) return;

    existing.completedParts[String(partNumber)] = eTag;
    this.writeRaw(this.getStorageKey(fingerprint), JSON.stringify(existing));
  }

  remove(fingerprint: string): void {
    this.deleteRaw(this.getStorageKey(fingerprint));
  }

  pruneExpired(now = Date.now()): void {
    for (const storageKey of this.listAllKeys()) {
      const raw = this.readRaw(storageKey);
      if (!raw) {
        this.deleteRaw(storageKey);
        continue;
      }
      try {
        const parsed = JSON.parse(raw) as Partial<MultipartCheckpoint>;
        if (!parsed.expiresAt || parsed.expiresAt <= now) {
          this.deleteRaw(storageKey);
        }
      } catch {
        this.deleteRaw(storageKey);
      }
    }
  }

  private enforceMaxEntries(now: number): void {
    const entries: Array<{ key: string; createdAt: number }> = [];
    for (const storageKey of this.listAllKeys()) {
      const raw = this.readRaw(storageKey);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as Partial<MultipartCheckpoint>;
        if (!parsed.expiresAt || parsed.expiresAt <= now) {
          this.deleteRaw(storageKey);
          continue;
        }
        entries.push({ key: storageKey, createdAt: parsed.createdAt ?? 0 });
      } catch {
        this.deleteRaw(storageKey);
      }
    }

    if (entries.length <= MAX_CHECKPOINTS) return;
    entries.sort((a, b) => a.createdAt - b.createdAt);
    const excessCount = entries.length - MAX_CHECKPOINTS;
    for (let i = 0; i < excessCount; i++) {
      this.deleteRaw(entries[i].key);
    }
  }
}

export const defaultCheckpointStore = new MultipartCheckpointStore();

export async function computeClientSha256Hex(
  blob: Blob,
  maxBytes = MAX_CLIENT_HASH_BYTES,
): Promise<string | undefined> {
  const subtle =
    globalThis.crypto?.subtle ??
    (typeof window !== 'undefined' ? window.crypto?.subtle : undefined);
  if (!subtle || blob.size <= 0 || blob.size > maxBytes) {
    return undefined;
  }
  if (typeof blob.arrayBuffer !== 'function') {
    return undefined;
  }
  try {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return undefined;
  }
}

function resolveApiEndpoint(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (typeof window !== 'undefined') {
    return `${getEffectiveBaseUrl()}${path}`;
  }
  return `${API_BASE_URL}${path}`;
}

function resolveReturnUrl(
  rawUrl: string,
  customResolver?: (path: string | null | undefined) => string | null,
): string {
  if (!rawUrl) return '';
  if (customResolver) {
    return customResolver(rawUrl) || rawUrl;
  }
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }
  const normalized = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
  return typeof window !== 'undefined' ? normalized : `${API_BASE_URL}${normalized}`;
}

function unwrapPayload<T>(raw: unknown): T {
  if (raw && typeof raw === 'object' && 'data' in raw) {
    const dataVal = (raw as { data?: unknown }).data;
    if (dataVal !== undefined) {
      return dataVal as T;
    }
  }
  return raw as T;
}

function extractHttpStatus(err: unknown): number {
  if (isApiError(err)) return err.statusCode;
  if (err instanceof UploadHttpError) return err.status;
  if (err && typeof err === 'object') {
    const obj = err as { status?: unknown; statusCode?: unknown };
    if (typeof obj.statusCode === 'number') return obj.statusCode;
    if (typeof obj.status === 'number') return obj.status;
  }
  return 0;
}

function isAbortError(err: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (err instanceof Error) {
    return (
      err.message === USER_ABORT_ERROR_MESSAGE ||
      err.name === 'AbortError' ||
      err.message.toLowerCase().includes('aborted')
    );
  }
  return false;
}

function parseErrorText(rawText: string, fallback: string): string {
  if (!rawText) return fallback;
  try {
    const errRes = JSON.parse(rawText) as Record<string, unknown> | string;
    if (typeof errRes === 'string') return errRes;
    if (errRes && typeof errRes === 'object') {
      if (errRes.message) {
        if (Array.isArray(errRes.message)) {
          return errRes.message
            .map((m: unknown) =>
              typeof m === 'object' && m !== null && 'message' in m
                ? String((m as { message?: unknown }).message ?? '')
                : typeof m === 'object' && m !== null
                  ? JSON.stringify(m)
                  : String(m),
            )
            .join(', ');
        }
        if (typeof errRes.message === 'object' && errRes.message !== null) {
          const mObj = errRes.message as Record<string, unknown>;
          return String(mObj.message || mObj.error || JSON.stringify(errRes.message));
        }
        return String(errRes.message);
      }
      if (errRes.error) {
        if (typeof errRes.error === 'object' && errRes.error !== null) {
          const eObj = errRes.error as Record<string, unknown>;
          return String(eObj.message || eObj.error || JSON.stringify(errRes.error));
        }
        return String(errRes.error);
      }
      if (errRes.detail) {
        return typeof errRes.detail === 'object'
          ? JSON.stringify(errRes.detail)
          : String(errRes.detail);
      }
    }
  } catch {
    return rawText.slice(0, 300);
  }
  return fallback;
}

function xhrPutBinary(params: {
  url: string;
  body: Blob;
  contentType?: string;
  signal?: AbortSignal;
  onProgress?: (loadedBytes: number, totalBytes: number, percent: number) => void;
}): Promise<{ eTag: string }> {
  const { url, body, contentType, signal, onProgress } = params;
  const isRelativeLocal = url.startsWith('/');
  const targetUrl = isRelativeLocal ? resolveApiEndpoint(url) : url;

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new Error(USER_ABORT_ERROR_MESSAGE));
    }

    const xhr = new XMLHttpRequest();
    xhr.withCredentials = isRelativeLocal;

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        const total = event.lengthComputable && event.total > 0 ? event.total : body.size;
        const percent = total > 0 ? Math.min(100, Math.round((event.loaded / total) * 100)) : 100;
        onProgress(event.loaded, total, percent);
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        let eTag = (
          xhr.getResponseHeader('ETag') ||
          xhr.getResponseHeader('etag') ||
          ''
        ).replace(/^"|"$/g, '');

        if (!eTag && xhr.responseText) {
          try {
            const parsed = unwrapPayload<{ eTag?: string }>(JSON.parse(xhr.responseText));
            if (parsed?.eTag) {
              eTag = String(parsed.eTag).replace(/^"|"$/g, '');
            }
          } catch {
            // Non-JSON PUT response from R2/S3 is expected
          }
        }
        resolve({ eTag });
      } else {
        const msg = parseErrorText(
          xhr.responseText,
          `Direct upload failed with status ${xhr.status}`,
        );
        reject(new UploadHttpError(msg, xhr.status));
      }
    };

    xhr.onerror = () => reject(new UploadHttpError('Network error during upload', 0, 'NETWORK_ERROR'));
    xhr.onabort = () => reject(new Error(USER_ABORT_ERROR_MESSAGE));

    if (signal) {
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    xhr.open('PUT', targetUrl, true);
    if (contentType) {
      xhr.setRequestHeader('Content-Type', contentType);
    }
    xhr.send(body);
  });
}

function uploadDirectMultipartForm(
  blob: Blob,
  filename: string,
  mimeType: string,
  options: SmartUploadOptions,
): Promise<SmartUploadResult> {
  const baseEndpoint = (options.baseEndpoint || '/api/v1/files').replace(/\/+$/, '');
  const effectiveSpaceId = options.spaceId ?? options.projectId;

  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      return reject(new Error(USER_ABORT_ERROR_MESSAGE));
    }

    const formData = new FormData();
    formData.append('file', blob, filename);
    formData.append('fileName', filename);
    if (effectiveSpaceId) {
      formData.append('spaceId', effectiveSpaceId);
      formData.append('projectId', effectiveSpaceId);
    }
    if (options.pageId) formData.append('pageId', options.pageId);
    if (options.parentId) formData.append('parentId', options.parentId);
    if (options.extraFormFields) {
      for (const [k, v] of Object.entries(options.extraFormFields)) {
        formData.append(k, v);
      }
    }

    const xhr = new XMLHttpRequest();
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0 && options.onProgress) {
        options.onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const parsed = unwrapPayload<UploadCompletePayload>(JSON.parse(xhr.responseText));
          const rawUrl = parsed.url || parsed.file?.url || parsed.path || '';
          const url = resolveReturnUrl(rawUrl, options.resolveUrl);
          const fileId = parsed.fileId || parsed.file?.id || parsed.id || '';
          resolve({
            fileId,
            blobId: parsed.blobId || fileId || undefined,
            url,
            path: rawUrl || url,
            filename: parsed.filename || parsed.file?.filename || filename,
            size: parsed.size ?? parsed.file?.size ?? blob.size,
            mimeType: parsed.mimeType || mimeType,
            deduplicated: false,
          });
        } catch {
          reject(new Error('Failed to parse backend response'));
        }
      } else {
        const errorMsg = parseErrorText(xhr.responseText, `Upload failed with status ${xhr.status}`);
        reject(new UploadHttpError(errorMsg, xhr.status));
      }
    };

    xhr.onerror = () => reject(new UploadHttpError('Network error during upload', 0, 'NETWORK_ERROR'));
    xhr.onabort = () => reject(new Error(USER_ABORT_ERROR_MESSAGE));

    xhr.open('POST', resolveApiEndpoint(`${baseEndpoint}/upload`), true);
    const token = getAuthToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    if (options.signal) {
      options.signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }
    xhr.send(formData);
  });
}

function normalizeCompletedResult(
  payload: UploadCompletePayload,
  fallbackFilename: string,
  fallbackSize: number,
  fallbackMimeType: string,
  deduplicated: boolean,
  resolveUrl?: (path: string | null | undefined) => string | null,
): SmartUploadResult {
  const rawUrl = payload.url || payload.file?.url || payload.path || '';
  const url = resolveReturnUrl(rawUrl, resolveUrl);
  const fileId = payload.fileId || payload.file?.id || payload.id || payload.blobId || '';
  return {
    fileId,
    blobId: payload.blobId || fileId || undefined,
    url,
    path: rawUrl || url,
    filename: payload.filename || fallbackFilename,
    size: payload.size ?? fallbackSize,
    mimeType: payload.mimeType || fallbackMimeType,
    deduplicated,
  };
}

async function executePresignedSingleUpload(
  blob: Blob,
  filename: string,
  mimeType: string,
  options: SmartUploadOptions,
): Promise<SmartUploadResult> {
  const baseEndpoint = (options.baseEndpoint || '/api/v1/files').replace(/\/+$/, '');
  const effectiveSpaceId = options.spaceId ?? options.projectId;

  if (options.signal?.aborted) {
    throw new Error(USER_ABORT_ERROR_MESSAGE);
  }

  try {
    const contentHash = await computeClientSha256Hex(blob);
    const presignRaw = await apiPost<PresignResponsePayload>(
      `${baseEndpoint}/presign`,
      {
        filename,
        mimeType,
        size: blob.size,
        sizeBytes: blob.size,
        ...(effectiveSpaceId ? { spaceId: effectiveSpaceId } : {}),
        ...(options.pageId ? { pageId: options.pageId } : {}),
        ...(options.parentId ? { parentId: options.parentId } : {}),
        ...(contentHash ? { contentHash } : {}),
        ...(options.metaData ? { metaData: options.metaData } : {}),
      },
      { signal: options.signal, silent: true },
    );
    const presigned = unwrapPayload<PresignResponsePayload>(presignRaw);

    if (presigned?.deduplicated && presigned.url) {
      options.onProgress?.(100);
      return normalizeCompletedResult(
        presigned,
        filename,
        blob.size,
        mimeType,
        true,
        options.resolveUrl,
      );
    }

    if (presigned?.uploadUrl && presigned?.storageKey) {
      await xhrPutBinary({
        url: presigned.uploadUrl,
        body: blob,
        contentType: mimeType,
        signal: options.signal,
        onProgress: (_loaded, _total, percent) => {
          options.onProgress?.(percent);
        },
      });

      const completeRaw = await apiPost<UploadCompletePayload>(
        `${baseEndpoint}/presign/complete`,
        {
          storageKey: presigned.storageKey,
          filename,
          size: blob.size,
          sizeBytes: blob.size,
          mimeType,
          ...(effectiveSpaceId ? { spaceId: effectiveSpaceId } : {}),
          ...(options.pageId ? { pageId: options.pageId } : {}),
          ...(options.parentId ? { parentId: options.parentId } : {}),
          ...(contentHash ? { contentHash } : {}),
          ...(options.metaData ? { metaData: options.metaData } : {}),
        },
        { signal: options.signal },
      );
      const completed = unwrapPayload<UploadCompletePayload>(completeRaw);
      options.onProgress?.(100);
      return normalizeCompletedResult(
        completed,
        filename,
        blob.size,
        mimeType,
        false,
        options.resolveUrl,
      );
    }
  } catch (err: unknown) {
    if (isAbortError(err, options.signal)) {
      throw new Error(USER_ABORT_ERROR_MESSAGE);
    }
    const status = extractHttpStatus(err);
    if (
      options.allowDirectFallback === false ||
      DEFINITIVE_CLIENT_ERROR_STATUSES.has(status)
    ) {
      throw err;
    }
  }

  return uploadDirectMultipartForm(blob, filename, mimeType, options);
}

class StaleSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaleSessionError';
  }
}

async function runResumableMultipartAttempt(
  blob: Blob,
  filename: string,
  mimeType: string,
  options: SmartUploadOptions,
  fingerprint: string,
  checkpointStore: MultipartCheckpointStore,
  allowStaleRecovery: boolean,
): Promise<SmartUploadResult> {
  const baseEndpoint = (options.baseEndpoint || '/api/v1/files').replace(/\/+$/, '');
  const effectiveSpaceId = options.spaceId ?? options.projectId;
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_PART_CONCURRENCY);
  const maxPartRetries = Math.max(1, options.maxPartRetries ?? DEFAULT_PART_MAX_RETRIES);

  if (options.signal?.aborted) {
    throw new Error(USER_ABORT_ERROR_MESSAGE);
  }

  const expectedHash = await computeClientSha256Hex(blob);
  let checkpoint = checkpointStore.load(fingerprint);
  const resumedFromCheckpoint = Boolean(checkpoint);

  if (!checkpoint) {
    const initiateRaw = await apiPost<InitiateMultipartPayload>(
      `${baseEndpoint}/multipart/initiate`,
      {
        filename,
        mimeType,
        totalSize: blob.size,
        sizeBytes: blob.size,
        ...(effectiveSpaceId ? { spaceId: effectiveSpaceId } : {}),
        ...(options.pageId ? { pageId: options.pageId } : {}),
        ...(options.parentId ? { parentId: options.parentId } : {}),
        ...(expectedHash ? { expectedHash } : {}),
      },
      { signal: options.signal },
    );
    const initiated = unwrapPayload<InitiateMultipartPayload>(initiateRaw);

    if (initiated?.deduplicated && initiated.url) {
      options.onProgress?.(100);
      return normalizeCompletedResult(
        initiated,
        filename,
        blob.size,
        mimeType,
        true,
        options.resolveUrl,
      );
    }

    const now = Date.now();
    checkpoint = {
      sessionId: initiated.sessionId,
      uploadId: initiated.uploadId,
      partSize: initiated.partSize,
      totalParts: initiated.totalParts,
      totalSize: blob.size,
      createdAt: now,
      expiresAt: now + CHECKPOINT_TTL_MS,
      completedParts: {},
    };
    checkpointStore.save(fingerprint, checkpoint);
  }

  const { sessionId, partSize, totalParts } = checkpoint;
  const parts: Array<{ partNumber: number; eTag: string } | undefined> = new Array(totalParts);
  const partLoadedBytes = new Array<number>(totalParts).fill(0);
  const pendingPartNumbers: number[] = [];

  for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
    const savedEtag = checkpoint.completedParts[String(partNumber)];
    const start = (partNumber - 1) * partSize;
    const end = Math.min(start + partSize, blob.size);
    const partLength = Math.max(0, end - start);

    if (typeof savedEtag === 'string' && savedEtag.length > 0) {
      parts[partNumber - 1] = { partNumber, eTag: savedEtag };
      partLoadedBytes[partNumber - 1] = partLength;
    } else {
      pendingPartNumbers.push(partNumber);
    }
  }

  const reportProgress = () => {
    if (!options.onProgress || blob.size <= 0) return;
    const loaded = partLoadedBytes.reduce((sum, n) => sum + n, 0);
    options.onProgress(Math.min(100, Math.round((loaded / blob.size) * 100)));
  };

  if (pendingPartNumbers.length < totalParts) {
    reportProgress();
  }

  const uploadSinglePartWithRetry = async (partNumber: number): Promise<void> => {
    const start = (partNumber - 1) * partSize;
    const end = Math.min(start + partSize, blob.size);
    const chunk = blob.slice(start, end);

    for (let attempt = 1; attempt <= maxPartRetries; attempt++) {
      if (options.signal?.aborted) {
        throw new Error(USER_ABORT_ERROR_MESSAGE);
      }

      try {
        const partUrlRaw = await apiGet<PartUrlPayload>(
          `${baseEndpoint}/multipart/${encodeURIComponent(sessionId)}/part-url`,
          {
            params: { partNumber },
            signal: options.signal,
            silent: resumedFromCheckpoint && allowStaleRecovery,
          },
        );
        const { uploadUrl } = unwrapPayload<PartUrlPayload>(partUrlRaw);

        const { eTag } = await xhrPutBinary({
          url: uploadUrl,
          body: chunk,
          signal: options.signal,
          onProgress: (loadedBytes) => {
            partLoadedBytes[partNumber - 1] = loadedBytes;
            reportProgress();
          },
        });

        partLoadedBytes[partNumber - 1] = chunk.size;
        parts[partNumber - 1] = { partNumber, eTag };
        checkpointStore.recordPart(fingerprint, partNumber, eTag);
        reportProgress();
        return;
      } catch (err: unknown) {
        if (isAbortError(err, options.signal)) {
          throw new Error(USER_ABORT_ERROR_MESSAGE);
        }
        const status = extractHttpStatus(err);
        if (
          resumedFromCheckpoint &&
          allowStaleRecovery &&
          (status === 400 || status === 404)
        ) {
          throw new StaleSessionError(
            err instanceof Error ? err.message : 'Multipart session expired',
          );
        }
        partLoadedBytes[partNumber - 1] = 0;
        if (
          attempt === maxPartRetries ||
          (status > 0 && DEFINITIVE_CLIENT_ERROR_STATUSES.has(status))
        ) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
  };

  try {
    let cursor = 0;
    const worker = async () => {
      while (cursor < pendingPartNumbers.length) {
        if (options.signal?.aborted) {
          throw new Error(USER_ABORT_ERROR_MESSAGE);
        }
        const idx = cursor++;
        await uploadSinglePartWithRetry(pendingPartNumbers[idx]);
      }
    };

    const workerCount = Math.min(concurrency, pendingPartNumbers.length);
    if (workerCount > 0) {
      await Promise.all(Array.from({ length: workerCount }, () => worker()));
    }

    const completedParts = parts.filter(
      (p): p is { partNumber: number; eTag: string } => Boolean(p),
    );
    const completeRaw = await apiPost<UploadCompletePayload>(
      `${baseEndpoint}/multipart/complete`,
      { sessionId, parts: completedParts },
      { signal: options.signal },
    );
    const completed = unwrapPayload<UploadCompletePayload>(completeRaw);
    checkpointStore.remove(fingerprint);
    options.onProgress?.(100);

    return normalizeCompletedResult(
      completed,
      filename,
      blob.size,
      mimeType,
      false,
      options.resolveUrl,
    );
  } catch (err: unknown) {
    if (isAbortError(err, options.signal)) {
      checkpointStore.remove(fingerprint);
      await apiDelete(`${baseEndpoint}/multipart/${encodeURIComponent(sessionId)}`, {
        silent: true,
      }).catch(() => {});
      throw new Error(USER_ABORT_ERROR_MESSAGE);
    }

    const status = extractHttpStatus(err);
    if (
      err instanceof StaleSessionError ||
      (resumedFromCheckpoint && allowStaleRecovery && (status === 400 || status === 404))
    ) {
      checkpointStore.remove(fingerprint);
      throw new StaleSessionError(
        err instanceof Error ? err.message : 'Multipart session stale',
      );
    }

    // Keep checkpoint intact on transient network failure so next retry resumes cleanly
    throw err;
  }
}

async function executeResumableMultipartUpload(
  blob: Blob,
  filename: string,
  mimeType: string,
  options: SmartUploadOptions,
): Promise<SmartUploadResult> {
  const baseEndpoint = (options.baseEndpoint || '/api/v1/files').replace(/\/+$/, '');
  const effectiveSpaceId = options.spaceId ?? options.projectId;
  const checkpointStore = options.checkpointStore ?? defaultCheckpointStore;
  const lastModified = blob instanceof File ? blob.lastModified : 0;
  const fingerprint = buildUploadFingerprint({
    baseEndpoint,
    filename,
    size: blob.size,
    lastModified,
    spaceId: effectiveSpaceId,
    parentId: options.parentId,
    pageId: options.pageId,
  });

  try {
    return await runResumableMultipartAttempt(
      blob,
      filename,
      mimeType,
      options,
      fingerprint,
      checkpointStore,
      true,
    );
  } catch (err: unknown) {
    if (err instanceof StaleSessionError) {
      return runResumableMultipartAttempt(
        blob,
        filename,
        mimeType,
        options,
        fingerprint,
        checkpointStore,
        false,
      );
    }
    throw err;
  }
}

export async function smartUpload(
  blob: Blob | File,
  options: SmartUploadOptions = {},
): Promise<SmartUploadResult> {
  const filename =
    options.filename || (blob instanceof File ? blob.name : 'uploaded-file');
  const mimeType = options.mimeType || blob.type || 'application/octet-stream';
  const threshold =
    options.multipartThresholdBytes ?? DEFAULT_MULTIPART_THRESHOLD_BYTES;

  if (blob.size > threshold && blob.size > 0) {
    return executeResumableMultipartUpload(blob, filename, mimeType, options);
  }

  return executePresignedSingleUpload(blob, filename, mimeType, options);
}
