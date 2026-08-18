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

async function rawFetch(
  path: string,
  method: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<Response> {
  const { params, headers: extraHeaders, signal, timeout = 15000, ...rest } = options;

  const url = buildUrl(path, params);
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(extraHeaders as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Handle AbortSignal & Timeout
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let finalSignal = signal;

  if (!signal && timeout > 0) {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), timeout);
    finalSignal = controller.signal;
  }

  try {
    return await fetch(url, {
      method,
      credentials: 'include',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: finalSignal,
      ...rest,
    });
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
  // Deduplicate concurrent in-flight GET requests
  const normalizedMethod = method.toUpperCase();
  const isGet = normalizedMethod === 'GET';
  const requestKey = isGet ? `${normalizedMethod}:${buildUrl(path, options.params)}` : null;

  if (requestKey && inFlightRequests.has(requestKey)) {
    return inFlightRequests.get(requestKey) as Promise<T>;
  }

  const executionPromise = (async () => {
    let response = await rawFetch(path, normalizedMethod, body, options);

    // Auto-refresh on 401
    const isAuthEndpoint =
      path.includes('/auth/refresh') ||
      path.includes('/auth/login') ||
      path.includes('/auth/register') ||
      path.includes('/auth/user') ||
      path.includes('/auth/me');

    if (response.status === 401 && !isAuthEndpoint) {
      const newToken = await tryRefresh();

      if (newToken) {
        response = await rawFetch(path, normalizedMethod, body, options);
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
      let payload: { message?: string; errors?: Record<string, string[]>; code?: string } = {};

      try {
        payload = (await response.json()) as { message?: string; errors?: Record<string, string[]>; code?: string };
      } catch {
        // Non-JSON error body fallback
      }

      const error = new ApiError({
        message: payload.message ?? response.statusText ?? 'Request failed',
        statusCode: response.status,
        errors: payload.errors,
        code: payload.code,
      });

      logger.error(`API Error: [${normalizedMethod}] ${path}`, error, {
        statusCode: response.status,
        errors: payload.errors,
      });

      throw error;
    }

    if (response.status === 204) return undefined as T;

    const json = await response.json();
    return json as T;
  })();

  if (requestKey) {
    inFlightRequests.set(requestKey, executionPromise);
    executionPromise.finally(() => {
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

export { ApiError, isApiError };
