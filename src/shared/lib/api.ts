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
 * - Tree-shakeable named helpers: apiGet, apiPost, apiPut, apiPatch, apiDelete
 */

import { API_BASE_URL } from '@/shared/constants';
import { ApiError } from '@/shared/types';
import type { RequestOptions } from '@/shared/types';


// ─── Token Management ─────────────────────────────────────────────────────────

export function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token') || localStorage.getItem('accessToken') || null;
  }
  return null;
}

export function setAuthToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('token', token);
    localStorage.setItem('accessToken', token);
  }
}

export function removeAuthToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
  }
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

// ─── Core Fetch ───────────────────────────────────────────────────────────────

export async function apiFetch<T>(
  path: string,
  method: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
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

  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...rest,
  });

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

// ─── Re-export for convenience ────────────────────────────────────────────────

export { ApiError };

