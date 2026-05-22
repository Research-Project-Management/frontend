
export const API_URL = import.meta.env.VITE_API_URL;

/**
 * Normalizes a file URL stored in the database to always use the current API_URL.
 *
 * Handles three cases:
 *   1. Relative path:  "/api/files/..."       → "${API_URL}/api/files/..."
 *   2. Legacy absolute: "http://localhost:.../api/files/..." → "${API_URL}/api/files/..."
 *   3. Correct absolute: "https://rpm.aisq.dev/api/files/..." → returned as-is
 */
export function resolveFileUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // Already a relative path starting with /api/files/
  if (url.startsWith("/api/files/")) {
    return `${API_URL}${url}`;
  }

  // If it's a relative storage key starting with workspace/ or project/
  if (url.startsWith("workspace/") || url.startsWith("project/")) {
    return `${API_URL}/api/files/${url}`;
  }

  // Absolute URL — extract the /api/files/... path and reattach to current API_URL
  // This fixes legacy records that stored localhost or an old domain
  const match = url.match(/\/api\/files\/(.+)/);
  if (match) {
    return `${API_URL}/api/files/${match[1]}`;
  }

  // If it does not start with http:// or https:// or /, treat it as a relative storage key
  if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) {
    return `${API_URL}/api/files/${url}`;
  }

  // External URL (e.g. ui-avatars, gravatar) — return as-is
  return url;
}


// ── Custom error class ────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

export async function apiFetch<T = any>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let data: any;
    try {
      data = await res.json();
    } catch {
      /* empty body */
    }
    throw new ApiError(
      data?.error || data?.message || `Request failed (${res.status})`,
      res.status,
      data,
    );
  }

  // Handle 204 No Content
  if (res.status === 204) return null as T;

  const text = await res.text();
  return text ? JSON.parse(text) : (null as T);
}

// ── Convenience helpers ───────────────────────────────────────────────────────

export const apiGet = <T = any>(url: string, options?: RequestInit) =>
  apiFetch<T>(url, options);

export const apiPost = <T = any>(url: string, body?: unknown) =>
  apiFetch<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body != null ? JSON.stringify(body) : undefined,
  });

export const apiPut = <T = any>(url: string, body?: unknown) =>
  apiFetch<T>(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body != null ? JSON.stringify(body) : undefined,
  });

export const apiDelete = <T = any>(url: string) =>
  apiFetch<T>(url, { method: "DELETE" });
