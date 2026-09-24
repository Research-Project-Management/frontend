/**
 * Centralized HTTP Client built on native Fetch API.
 * Features:
 * - Clean Architecture separation: Network transport decoupled from UI routing
 * - Automatic JSON serialization / deserialization
 * - Bearer Token synchronization and single-flight 401 refresh mutex
 * - Decoupled onSessionExpired event subscriber (avoids hard page reloads)
 * - Typed ApiError with field validation details and code classification
 * - Safe query string builder via URLSearchParams
 * - Auth-scoped in-flight request deduplication for concurrent GET calls
 * - Composite AbortSignal and request timeout management
 * - Safe envelope unwrapping without prototype corruption
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

// ─── 1. Base URL Resolution (Secured against Production Storage Tampering) ───

export function getEffectiveBaseUrl(): string {
  // Allow local development override only in non-production environments
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    try {
      const override = window.localStorage.getItem('FLUX_API_BASE_URL');
      if (override && override.trim()) return override.trim().replace(/\/$/, '');
    } catch {
      // Ignore security errors in restricted browser contexts
    }
  }
  return API_BASE_URL;
}

// ─── 2. Auth Session Management & Decoupled Event Emitter ─────────────────────

export type SessionExpiredCallback = () => void;
const sessionExpiredListeners = new Set<SessionExpiredCallback>();

/**
 * Register a listener for authentication session expiration (401 refresh failed).
 * Decouples HTTP client from UI router and avoids uncoordinated page reloads.
 */
export function onSessionExpired(callback: SessionExpiredCallback): () => void {
  sessionExpiredListeners.add(callback);
  return () => {
    sessionExpiredListeners.delete(callback);
  };
}

function handleSessionExpired(): void {
  removeAuthToken();

  if (sessionExpiredListeners.size > 0) {
    sessionExpiredListeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        logger.error('Error executing onSessionExpired listener', err);
      }
    });
    return;
  }

  // Graceful fallback if no UI subscriber is attached
  if (typeof window !== 'undefined') {
    const publicPaths = ['/login', '/register', '/forgot-password', '/auth/callback', '/'];
    const isPublicPath = publicPaths.some(
      (publicPath) =>
        window.location.pathname === publicPath ||
        window.location.pathname.startsWith(publicPath + '/'),
    );
    if (!isPublicPath) {
      window.location.href = '/login';
    }
  }
}

interface RefreshTokenResult {
  readonly success: boolean;
  readonly accessToken: string | null;
  readonly isSessionInvalid: boolean;
}

let refreshPromise: Promise<RefreshTokenResult> | null = null;

async function silentRefresh(): Promise<RefreshTokenResult> {
  try {
    const refreshEndpointUrl = `${getEffectiveBaseUrl()}/auth/refresh`;
    const storedRefreshToken = getRefreshToken();
    const requestPayload = storedRefreshToken
      ? JSON.stringify({ refreshToken: storedRefreshToken })
      : JSON.stringify({});

    const refreshResponse = await fetch(refreshEndpointUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: requestPayload,
    });

    if (!refreshResponse.ok) {
      const isSessionInvalid =
        refreshResponse.status === 401 ||
        refreshResponse.status === 403 ||
        refreshResponse.status === 400;
      return {
        success: false,
        accessToken: null,
        isSessionInvalid,
      };
    }

    const refreshData = (await refreshResponse.json()) as {
      accessToken?: string;
      token?: string;
      refreshToken?: string;
    };

    const newAccessToken = refreshData.accessToken || refreshData.token;
    if (newAccessToken) {
      setTokens(newAccessToken, refreshData.refreshToken);
      return {
        success: true,
        accessToken: newAccessToken,
        isSessionInvalid: false,
      };
    }

    return {
      success: false,
      accessToken: null,
      isSessionInvalid: true,
    };
  } catch (caughtError: unknown) {
    logger.warn('Silent refresh failed with network error', { error: caughtError });
    return {
      success: false,
      accessToken: null,
      isSessionInvalid: false,
    };
  }
}

function tryRefresh(): Promise<RefreshTokenResult> {
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

function buildUrl(path: string, params?: RequestOptions['params'], relativeOnly = false): string {
  let base: string;
  if (relativeOnly) {
    base = path.startsWith('/') ? path : `/${path}`;
  } else {
    base = path.startsWith('http') ? path : `${getEffectiveBaseUrl()}${path}`;
  }
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
  const {
    params,
    headers: extraHeaders,
    signal,
    timeout = 15000,
    idempotencyKey,
    skipAuth = false,
    ...rest
  } = options;

  const url = buildUrl(path, params);
  const token = !skipAuth ? getAuthToken() : null;
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

  // Composite Timeout & Signal Controller
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let finalSignal: AbortSignal | undefined = (signal || undefined);

  if (timeout > 0) {
    const timeoutController = new AbortController();
    timeoutId = setTimeout(() => {
      try {
        timeoutController.abort(new DOMException(`Request timed out after ${timeout}ms`, 'TimeoutError'));
      } catch {
        timeoutController.abort();
      }
    }, timeout);

    if (signal) {
      if (typeof (AbortSignal as any).any === 'function') {
        finalSignal = (AbortSignal as any).any([signal, timeoutController.signal]);
      } else {
        if (signal.aborted) {
          timeoutController.abort(signal.reason);
        } else {
          signal.addEventListener('abort', () => timeoutController.abort(signal.reason), { once: true });
        }
        finalSignal = timeoutController.signal;
      }
    } else {
      finalSignal = timeoutController.signal;
    }
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
    if (
      err instanceof Error &&
      (err.name === 'AbortError' || err.name === 'TimeoutError' || err.message?.includes('aborted') || err.message?.includes('timed out'))
    ) {
      if (timeoutId && (err.name === 'TimeoutError' || err.message?.includes('timed out'))) {
        throw new ApiError({
          message: `Request timed out after ${timeout}ms. Please ensure backend server is running.`,
          statusCode: 408,
          code: 'TIMEOUT',
        });
      }
    }
    if (err instanceof TypeError && err.message?.includes('Failed to fetch')) {
      // Fallback to relative proxy route via Next.js rewrites if direct cross-origin failed
      if (typeof window !== 'undefined' && url.startsWith('http') && path.startsWith('/')) {
        try {
          const fallbackUrl = buildUrl(path, params, true);
          return await fetch(fallbackUrl, {
            method,
            credentials: 'include',
            headers,
            body: body !== undefined ? (isFormData ? (body as any) : JSON.stringify(body)) : undefined,
            signal: finalSignal,
            ...rest,
          });
        } catch (fallbackErr: unknown) {
          logger.debug('Relative proxy fallback also failed', { fallbackErr });
        }
      }
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
  const normalizedMethod = method.toUpperCase();
  const isGet = normalizedMethod === 'GET';

  // Auth-scoped request deduplication key to prevent cross-identity cache leaks
  const token = !options.skipAuth ? getAuthToken() : null;
  const tokenScope = token ? token.slice(-8) : 'anon';
  const requestKey = isGet && !options.signal ? `${tokenScope}:${normalizedMethod}:${buildUrl(path, options.params)}` : null;

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
      const apiError = isApiError(err)
        ? err
        : new ApiError({
            message: err instanceof Error ? err.message : 'Network error: Failed to fetch',
            statusCode: 0,
            code: 'NETWORK_ERROR',
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

    if (response.status === 401 && !options.skipAuth && !isUnauthenticatedAuthEndpoint) {
      const refreshResult = await tryRefresh();

      if (refreshResult.success && refreshResult.accessToken) {
        try {
          response = await rawFetch(path, normalizedMethod, body, options);
        } catch (caughtRetryError: unknown) {
          if ((caughtRetryError as Error)?.name === 'AbortError') {
            throw caughtRetryError;
          }
          const apiError = new ApiError({
            message:
              caughtRetryError instanceof Error
                ? caughtRetryError.message
                : 'Network error: Failed to fetch',
            statusCode: 0,
            code: 'NETWORK_ERROR',
          });
          logger.error(`Network Error on retry: [${normalizedMethod}] ${path}`, apiError);
          throw apiError;
        }
      } else if (refreshResult.isSessionInvalid) {
        handleSessionExpired();
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

      if (!payload || typeof payload !== 'object') {
        payload = {};
      }

      const errorMessage =
        payload?.error?.message ||
        payload?.message ||
        response.statusText ||
        'Request failed';
      const errorCode = payload?.error?.code || payload?.code;
      const errorDetails = payload?.error?.details || payload?.errors || payload?.details;

      const error = new ApiError({
        message: errorMessage,
        statusCode: response.status,
        errors: errorDetails,
        details: errorDetails,
        code: errorCode,
      });

      if (options?.silent) {
        logger.debug(`API Request rejected (silent): [${normalizedMethod}] ${path}`, {
          statusCode: response.status,
          message: errorMessage,
        });
      } else if (response.status === 404) {
        logger.warn(`Resource not found (404): [${normalizedMethod}] ${path}`, {
          statusCode: response.status,
          message: errorMessage,
        });
      } else if (response.status === 401) {
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

    // If caller explicitly requested the raw backend envelope, return directly
    if (options.rawEnvelope) {
      return json as T;
    }

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
        // Assign standard enumerable metadata properties without breaking V8 optimization
        try {
          const totalCount =
            (pagination as any).totalCount ??
            (pagination as any).total ??
            data.length;
          (data as any).pagination = pagination;
          (data as any).meta = pagination;
          (data as any).total = totalCount;
        } catch {
          // Fallback if data is frozen
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
            code: 'NETWORK_ERROR',
          }),
  );
};

export { ApiError, isApiError, rawFetch as apiRawFetch };
