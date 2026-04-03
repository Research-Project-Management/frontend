const isBrowserLocalhost =
  !import.meta.env.SSR &&
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);

export const API_URL = isBrowserLocalhost
  ? import.meta.env.VITE_DEV_API_URL || import.meta.env.VITE_API_URL || ""
  : import.meta.env.DEV
    ? import.meta.env.VITE_DEV_API_URL || import.meta.env.VITE_API_URL || ""
    : import.meta.env.VITE_API_URL || "";

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
