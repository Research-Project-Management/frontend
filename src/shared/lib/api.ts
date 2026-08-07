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

// ─── Core Fetch ───────────────────────────────────────────────────────────────

export async function apiFetch<T>(
  path: string,
  method: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const { params, headers: extraHeaders, ...rest } = options;

  const url = buildUrl(path, params);

  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
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

  return response.json() as Promise<T>;
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

