/**
 * api.types.ts
 * Shared API response types used across all service layers.
 */

// ─── Standard Response Wrappers ───────────────────────────────────────────────

export type ApiResponse<T> = {
  data: T;
  message?: string;
  success: boolean;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// ─── Error ────────────────────────────────────────────────────────────────────

export type ApiErrorPayload = {
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
};

/**
 * Typed HTTP error thrown by the api client.
 * Carries the HTTP status code and optional field-level validation errors.
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly errors?: Record<string, string[]>;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = 'ApiError';
    this.status = payload.statusCode;
    this.errors = payload.errors;
  }
}

// ─── Request Helpers ──────────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RequestOptions = Omit<RequestInit, 'method' | 'body'> & {
  params?: Record<string, string | number | boolean | undefined>;
};
