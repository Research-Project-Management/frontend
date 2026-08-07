/**
 * common.types.ts
 * Generic utility types shared across features.
 */

// ─── Primitive Aliases ────────────────────────────────────────────────────────

/** MongoDB ObjectId as string */
export type ID = string;

/** ISO 8601 date string */
export type ISODateString = string;

// ─── Nullable / Optional ──────────────────────────────────────────────────────

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;

// ─── Select / Option ─────────────────────────────────────────────────────────

export type Option<T = string> = {
  label: string;
  value: T;
  disabled?: boolean;
};

export type SelectOption = Option<string>;

// ─── Sorting & Filtering ─────────────────────────────────────────────────────

export type SortOrder = 'asc' | 'desc';

export type SortConfig<T extends string = string> = {
  field: T;
  order: SortOrder;
};

export type PaginationParams = {
  page?: number;
  limit?: number;
};

export type FilterParams = Record<string, string | number | boolean | undefined>;

// ─── Component Helpers ────────────────────────────────────────────────────────

/** Props for any component that accepts children */
export type WithChildren<T = object> = T & {
  children?: React.ReactNode;
};

/** Props for components with optional className */
export type WithClassName<T = object> = T & {
  className?: string;
};
