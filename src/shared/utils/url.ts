/**
 * shared/utils/url.ts
 *
 * Pure URL utility functions — no HTTP calls, no side effects.
 * Used across multiple features (storage, library, editor, workspaces).
 */

import { API_BASE_URL } from '@/shared/constants';


/**
 * Resolve a relative file path or S3 key to a full URL.
 * - Paths starting with 'http(s)://' are returned as-is.
 * - Relative paths are prefixed with API_BASE_URL.
 * - null / undefined → null
 *
 * @example
 * resolveFileUrl('/uploads/avatar.png')
 * // → 'http://localhost:3000/api/v1/uploads/avatar.png'
 *
 * resolveFileUrl('https://cdn.example.com/file.pdf')
 * // → 'https://cdn.example.com/file.pdf'
 *
 * resolveFileUrl(null) // → null
 */
export const resolveFileUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
};
