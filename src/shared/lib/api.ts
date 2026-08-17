/**
 * shared/lib/api.ts
 *
 * Centralized HTTP client built on the native Fetch API.
 *
 * Features:
 * - Automatic JSON serialization / deserialization
 * - Cookie-based auth (credentials: 'include')
 * - Typed ApiError with HTTP status and field-level errors
 * - Query string builder via `params` option
 * - Transparent 401 auto-refresh via refresh token rotation
 * - Tree-shakeable named helpers: apiGet, apiPost, apiPut, apiPatch, apiDelete
 */

import { API_BASE_URL } from '@/shared/constants';
import { ApiError } from '@/shared/types';
import type { RequestOptions } from '@/shared/types';


// ─── Token Management ─────────────────────────────────────────────────────────

const TOKEN_KEY = 'token';
const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';

export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(ACCESS_KEY) || null;
  }
  return null;
}

export function getRefreshToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(REFRESH_KEY) || null;
  }
  return null;
}

export function setAuthToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ACCESS_KEY, token);
  }
}

export function setRefreshToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(REFRESH_KEY, token);
  }
}

/** Store both tokens at once (convenience for login/register flows) */
export function setTokens(accessToken: string, refreshToken: string) {
  setAuthToken(accessToken);
  setRefreshToken(refreshToken);
}

export function removeAuthToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }
}

// ─── Silent Refresh ───────────────────────────────────────────────────────────

/** Mutex to prevent multiple concurrent refresh attempts */
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
      // If backend rotates the refresh token, store the new one
      if (data.refreshToken) {
        setRefreshToken(data.refreshToken);
      }
      return data.accessToken;
    }

    return null;
  } catch {
    return null;
  }
}

/** Deduplicated refresh — all concurrent callers share one in-flight request */
function tryRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = silentRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// ─── Query String Builder ─────────────────────────────────────────────────────

function buildUrl(
  path: string,
  params?: RequestOptions['params'],
): string {
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

// ─── Response Normalizer ───────────────────────────────────────────────────────

function normalizeResponse<T>(data: T): T {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map(normalizeResponse) as unknown as T;
  }
  const obj = data as Record<string, any>;
  if ('id' in obj && !('_id' in obj)) {
    obj._id = obj.id;
  } else if ('_id' in obj && !('id' in obj)) {
    obj.id = obj._id;
  }
  for (const key of Object.keys(obj)) {
    if (obj[key] && typeof obj[key] === 'object') {
      obj[key] = normalizeResponse(obj[key]);
    }
  }
  return obj as T;
}

// ─── Core Fetch (with auto-refresh on 401) ────────────────────────────────────

async function rawFetch<T>(
  path: string,
  method: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<Response> {
  const { params, headers: extraHeaders, ...rest } = options;

  const url = buildUrl(path, params);
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extraHeaders as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    method,
    credentials: 'include',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...rest,
  });
}

export async function apiFetch<T>(
  path: string,
  method: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  let response = await rawFetch<T>(path, method, body, options);

  // ── Auto-refresh on 401 ─────────────────────────────────────────────
  // Skip refresh for auth endpoints to prevent infinite loops
  const isAuthEndpoint =
    path.includes('/auth/refresh') ||
    path.includes('/auth/login') ||
    path.includes('/auth/register') ||
    path.includes('/auth/user') ||
    path.includes('/auth/me');

  if (response.status === 401 && !isAuthEndpoint) {
    const newToken = await tryRefresh();

    if (newToken) {
      // Retry the original request with the fresh token
      response = await rawFetch<T>(path, method, body, options);
    } else {
      // Refresh failed — clear invalid tokens
      removeAuthToken();

      // Only redirect if user was on a protected page, not on public/landing pages
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
    let payload: { message?: string; errors?: Record<string, string[]> } = {};

    try {
      payload = await response.json();
    } catch {
      // non-JSON error body — use status text
    }

    throw new ApiError({
      message: payload.message ?? response.statusText ?? 'Request failed',
      statusCode: response.status,
      errors: payload.errors,
    });
  }

  // 204 No Content — return undefined cast to T
  if (response.status === 204) return undefined as T;

  const json = await response.json();
  return normalizeResponse(json) as T;
}

// ─── Method Helpers ───────────────────────────────────────────────────────────

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

// ─── Safe Fetch (Error as Value Pattern) ───────────────────────────────────────

import { tryCatch, type Result } from '@/shared/utils/error.util';

export const safeApiFetch = <T>(
  path: string,
  method = 'GET',
  body?: unknown,
  options?: RequestOptions,
): Promise<Result<T, Error>> => {
  return tryCatch(apiFetch<T>(path, method, body, options));
};

// ─── Re-export for convenience ────────────────────────────────────────────────

export { ApiError };

