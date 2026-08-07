/**
 * shared/lib/index.ts
 *
 * Barrel export for shared lib utilities.
 *
 * NOTE: Import directly from sub-modules inside shared/lib itself
 * to avoid circular dependencies. This barrel is for external consumers.
 */

// HTTP client
export {
  apiFetch,
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
  ApiError,
} from './api';

// Query client factory
export { getQueryClient, defaultQueryOptions } from './get-query-client';

// Class utility (cn)
export { cn } from './utils';
