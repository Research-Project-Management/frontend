/**
 * Common TypeScript utility types and primitives.
 */

declare const __brand: unique symbol;

/**
 * Creates a nominal (branded) type from a primitive.
 */
export type Brand<T, B> = T & { readonly [__brand]: B };

/**
 * Flattens an intersection type into a clean, single object type in IDE tooltips.
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * Preserves IDE autocomplete for a literal union string while still allowing any custom string.
 */
export type LooseAutocomplete<T extends string> = T | (string & {});

/**
 * Type-safe state representing an async query or data-fetching operation.
 * Eliminates impossible states like `{ isLoading: true, isError: true }`.
 */
export type AsyncState<T, E = Error> =
  | { status: 'idle'; data: null; error: null }
  | { status: 'loading'; data: T | null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: null; error: E };

/**
 * Type-safe state representing a mutation, action, or form submission.
 */
export type ActionState<T = void, E = string> =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: E };

/**
 * Standard paginated API response structure.
 */
export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type PaginatedResponse<T> = {
  items: T[];
  meta: PaginationMeta;
};
