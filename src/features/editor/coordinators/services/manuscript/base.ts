/**
 * base.ts
 *
 * Base URL configuration for the Manuscript subsystem.
 * Handles microservice URL resolution and relative fallback.
 */

import { getEffectiveBaseUrl } from '@/shared/lib/api';

export const MANUSCRIPTS_API_BASE =
  process.env.NEXT_PUBLIC_MANUSCRIPTS_SERVICE_URL ||
  process.env.NEXT_PUBLIC_MANUSCRIPT_SERVICE_URL ||
  '/api/v1/manuscripts';

export function getManuscriptsBaseUrl(): string {
  if (MANUSCRIPTS_API_BASE.startsWith('http://') || MANUSCRIPTS_API_BASE.startsWith('https://')) {
    return MANUSCRIPTS_API_BASE;
  }
  if (typeof window !== 'undefined' && !process.env.VITEST) {
    return MANUSCRIPTS_API_BASE;
  }
  const base = getEffectiveBaseUrl().replace(/\/$/, '');
  const path = MANUSCRIPTS_API_BASE.startsWith('/') ? MANUSCRIPTS_API_BASE : `/${MANUSCRIPTS_API_BASE}`;
  return `${base}${path}`;
}
