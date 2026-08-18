/**
 * shared/types/api.types.ts
 *
 * Core HTTP & API communication types.
 * Provides the contract between the Network Adapter and Domain Services.
 */

// ─── 1. Standard Response Envelope ────────────────────────────────────────────

export type ApiResponse<T> = {
  data: T;
  message?: string;
  success: boolean;
};

// ─── 2. Type-Safe API Error Definition ────────────────────────────────────────

export type ApiErrorPayload = {
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
  code?: string;
};

/**
 * Typed HTTP error produced by the API Client Seam.
 * Preserves HTTP status codes, structured validation errors, and stack traces.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly status: number; // Aliased for backwards compatibility
  public readonly errors?: Record<string, string[]>;
  public readonly code?: string;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = 'ApiError';
    this.statusCode = payload.statusCode;
    this.status = payload.statusCode;
    this.errors = payload.errors;
    this.code = payload.code;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Type guard to check if an unknown error is an ApiError.
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError || (error instanceof Error && error.name === 'ApiError');
}

// ─── 3. Request Options & HTTP Methods ─────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RequestOptions = Omit<RequestInit, 'method' | 'body'> & {
  params?: Record<string, string | number | boolean | undefined | null>;
  timeout?: number;
};
