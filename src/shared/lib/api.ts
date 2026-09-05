/**
 * Centralized HTTP Client built on native Fetch API.
 * Features:
 * - Automatic JSON serialization / deserialization
 * - Bearer Token synchronization and silent 401 refresh mutex
 * - Typed ApiError with field validation details
 * - Query string builder via params
 * - In-flight request deduplication for concurrent GET calls
 * - Configurable request timeout via AbortController
 * - Structured telemetry via logger
 * - Safe fetch via Result<T, ApiError>
 */

import { API_BASE_URL } from '@/config/env';
import { ApiError, isApiError, type RequestOptions } from '@/shared/types/api.types';
import { tryCatch, type Result } from '@/shared/utils/error.util';
import { logger } from '@/shared/lib/logger';
import {
  tokenStorage,
  getAuthToken,
  getRefreshToken,
  setAuthToken,
  setRefreshToken,
  setTokens,
  removeAuthToken,
  hasAuthToken,
} from '@/shared/lib/token-storage';

// Re-export token management functions for backward compatibility
export {
  tokenStorage,
  getAuthToken,
  getRefreshToken,
  setAuthToken,
  setRefreshToken,
  setTokens,
  removeAuthToken,
  hasAuthToken,
};

// ─── 2. Deduplicated Silent Refresh ───────────────────────────────────────────

let refreshPromise: Promise<string | null> | null = null;

async function silentRefresh(): Promise<string | null> {
  const rt = getRefreshToken();
  if (!rt) return null;

  try {
    const url = `${API_BASE_URL}/auth/refresh`;
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      accessToken?: string;
      refreshToken?: string;
    };

    if (data.accessToken) {
      setAuthToken(data.accessToken);
      if (data.refreshToken) {
        setRefreshToken(data.refreshToken);
      }
      return data.accessToken;
    }

    return null;
  } catch (error) {
    logger.warn('Silent refresh failed with network error', { error });
    return null;
  }
}

function tryRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = silentRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// ─── 3. In-Flight Request Deduplicator ────────────────────────────────────────

const inFlightRequests = new Map<string, Promise<unknown>>();

// ─── 4. Query String Builder ──────────────────────────────────────────────────

function buildUrl(path: string, params?: RequestOptions['params']): string {
  const base = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  if (!params) return base;

  const query = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null) {
      query.set(key, String(val));
    }
  }
  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}

// ─── 5. Core Fetch Implementation ─────────────────────────────────────────────

export async function rawFetch(
  path: string,
  method: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<Response> {
  const { params, headers: extraHeaders, signal, timeout = 15000, idempotencyKey, ...rest } = options;

  const url = buildUrl(path, params);
  const token = getAuthToken();
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers: Record<string, string> = {
    ...(body !== undefined && !isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(extraHeaders as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  // Handle AbortSignal & Timeout
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let finalSignal = signal;

  if (!signal && timeout > 0) {
    const controller = new AbortController();
    timeoutId = setTimeout(() => {
      try {
        controller.abort(new DOMException(`Request timeout after ${timeout}ms`, 'TimeoutError'));
      } catch {
        controller.abort();
      }
    }, timeout);
    finalSignal = controller.signal;
  }

  try {
    return await fetch(url, {
      method,
      credentials: 'include',
      headers,
      body: body !== undefined ? (isFormData ? (body as any) : JSON.stringify(body)) : undefined,
      signal: finalSignal,
      ...rest,
    });
  } catch (err: unknown) {
    if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError' || err.message?.includes('aborted'))) {
      if (!signal && timeoutId) {
        throw new ApiError({
          message: `Request timed out after ${timeout}ms. Please ensure backend server is running.`,
          statusCode: 408,
          code: 'TIMEOUT',
        });
      }
    }
    if (err instanceof TypeError && err.message?.includes('Failed to fetch')) {
      throw new ApiError({
        message: 'Cannot connect to backend server. Please ensure backend is running.',
        statusCode: 503,
        code: 'NETWORK_ERROR',
      });
    }
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function apiFetch<T>(
  path: string,
  method: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  // Deduplicate concurrent in-flight GET requests ONLY when no component-specific signal is attached
  const normalizedMethod = method.toUpperCase();
  const isGet = normalizedMethod === 'GET';
  const requestKey = isGet && !options.signal ? `${normalizedMethod}:${buildUrl(path, options.params)}` : null;

  if (requestKey && inFlightRequests.has(requestKey)) {
    return inFlightRequests.get(requestKey) as Promise<T>;
  }

  const executionPromise = (async () => {
    let response: Response;
    try {
      response = await rawFetch(path, normalizedMethod, body, options);
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        throw err;
      }
      const apiError = new ApiError({
        message: err instanceof Error ? err.message : 'Network error: Failed to fetch',
        statusCode: 0,
      });
      logger.error(`Network Error: [${normalizedMethod}] ${path}`, apiError);
      throw apiError;
    }

    // Auto-refresh on 401 for all protected endpoints
    const isUnauthenticatedAuthEndpoint =
      path.includes('/auth/refresh') ||
      path.includes('/auth/login') ||
      path.includes('/auth/register') ||
      path.includes('/auth/forgot-password') ||
      path.includes('/auth/oauth/exchange');

    if (response.status === 401 && !isUnauthenticatedAuthEndpoint) {
      const newToken = await tryRefresh();

      if (newToken) {
        try {
          response = await rawFetch(path, normalizedMethod, body, options);
        } catch (err: unknown) {
          if ((err as Error)?.name === 'AbortError') {
            throw err;
          }
          const apiError = new ApiError({
            message: err instanceof Error ? err.message : 'Network error: Failed to fetch',
            statusCode: 0,
          });
          logger.error(`Network Error on retry: [${normalizedMethod}] ${path}`, apiError);
          throw apiError;
        }
      } else {
        removeAuthToken();

        if (typeof window !== 'undefined') {
          const publicPaths = ['/login', '/register', '/forgot-password', '/auth/callback', '/'];
          const isPublicPath = publicPaths.some(
            (p) => window.location.pathname === p || window.location.pathname.startsWith(p + '/'),
          );
          if (!isPublicPath) {
            window.location.href = '/login';
          }
        }
      }
    }

    if (!response.ok) {
      let payload: {
        message?: string;
        errors?: Record<string, string[]> | unknown;
        details?: unknown;
        code?: string;
        error?: { message?: string; code?: string; details?: unknown };
      } = {};

      try {
        payload = (await response.json()) as any;
      } catch {
        // Non-JSON error body fallback
      }

      const errorMessage =
        payload.error?.message ||
        payload.message ||
        response.statusText ||
        'Request failed';
      const errorCode =
        payload.error?.code ||
        payload.code;
      const errorDetails =
        payload.error?.details ||
        payload.errors ||
        payload.details;

      const error = new ApiError({
        message: errorMessage,
        statusCode: response.status,
        errors: errorDetails,
        details: errorDetails,
        code: errorCode,
      });

      if (response.status === 401) {
        logger.warn(`Authentication required: [${normalizedMethod}] ${path}`, {
          statusCode: response.status,
          message: errorMessage,
        });
      } else {
        logger.error(`API Error: [${normalizedMethod}] ${path}`, error, {
          statusCode: response.status,
          errors: errorDetails,
        });
      }

      throw error;
    }

    if (response.status === 204) return undefined as T;

    const json = await response.json();

    // Transparently unpack backend ApiResponseEnvelope<T> if wrapped
    if (
      json !== null &&
      typeof json === 'object' &&
      'success' in json &&
      (json as Record<string, unknown>).success === true &&
      'data' in json
    ) {
      const data = (json as Record<string, unknown>).data;
      const pagination = (json as Record<string, unknown>).pagination;
      if (pagination && Array.isArray(data)) {
        try {
          Object.defineProperty(data, 'pagination', {
            value: pagination,
            enumerable: false,
            writable: true,
            configurable: true,
          });
          Object.defineProperty(data, 'meta', {
            value: pagination,
            enumerable: false,
            writable: true,
            configurable: true,
          });
          Object.defineProperty(data, 'total', {
            value: (pagination as any).totalCount ?? (pagination as any).total ?? data.length,
            enumerable: false,
            writable: true,
            configurable: true,
          });
        } catch {
          // Safe fallback if array cannot be extended
        }
      } else if (pagination && typeof data === 'object' && data !== null) {
        if (!('pagination' in (data as object))) {
          (data as any).pagination = pagination;
        }
        if (!('meta' in (data as object))) {
          (data as any).meta = pagination;
        }
      }
      return data as T;
    }

    return json as T;
  })();

  if (requestKey) {
    inFlightRequests.set(requestKey, executionPromise);
    // Attach .catch handler to prevent unhandled rejection on this cleanup promise fork
    executionPromise
      .catch(() => {})
      .finally(() => {
        inFlightRequests.delete(requestKey);
      });
  }

  return executionPromise;
}

// ─── 6. Method Helpers ────────────────────────────────────────────────────────

export const apiGet = <T>(path: string, options?: RequestOptions) =>
  apiFetch<T>(path, 'GET', undefined, options);

export const apiPost = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  apiFetch<T>(path, 'POST', body, options);

export const apiPut = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  apiFetch<T>(path, 'PUT', body, options);

export const apiPatch = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  apiFetch<T>(path, 'PATCH', body, options);

export const apiDelete = <T>(path: string, options?: RequestOptions) =>
  apiFetch<T>(path, 'DELETE', undefined, options);

// ─── 7. Safe Fetch (Error as Value Result Pattern) ─────────────────────────────

export const safeApiFetch = <T>(
  path: string,
  method = 'GET',
  body?: unknown,
  options?: RequestOptions,
): Promise<Result<T, ApiError>> => {
  return tryCatch(
    apiFetch<T>(path, method, body, options),
    (err) =>
      isApiError(err)
        ? err
        : new ApiError({
          message: err instanceof Error ? err.message : 'Unknown Network Error',
          statusCode: 0,
        }),
  );
};

export { ApiError, isApiError, rawFetch as apiRawFetch };
