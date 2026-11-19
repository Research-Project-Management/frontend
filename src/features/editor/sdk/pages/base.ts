/**
 * base.ts
 *
 * Base URL configuration for the Pages / Manuscript subsystem.
 * Handles microservice URL resolution, relative fallback, and filestore route construction.
 */

import { getEffectiveBaseUrl } from '@/shared/lib/api';

export const PAGES_API_BASE =
  process.env.NEXT_PUBLIC_PAGES_SERVICE_URL ||
  process.env.NEXT_PUBLIC_MANUSCRIPTS_SERVICE_URL ||
  process.env.NEXT_PUBLIC_MANUSCRIPT_SERVICE_URL ||
  '/api/v1/pages';

export function getPagesBaseUrl(): string {
  if (PAGES_API_BASE.startsWith('http://') || PAGES_API_BASE.startsWith('https://')) {
    return PAGES_API_BASE;
  }
  if (typeof window !== 'undefined' && !process.env.VITEST) {
    return PAGES_API_BASE;
  }
  const base = getEffectiveBaseUrl().replace(/\/$/, '');
  const path = PAGES_API_BASE.startsWith('/') ? PAGES_API_BASE : `/${PAGES_API_BASE}`;
  return `${base}${path}`;
}

export function resolveFilestoreCollectionRoute(
  apiBase: string,
  spaceIdOrPageId: string,
  explicitPageId?: string,
  storeContext?: { spaceId?: string; rootPageId?: string },
): { basePath: string; pageQuery?: string } {
  const trimmedScope = spaceIdOrPageId?.trim() || '';
  const trimmedPage = explicitPageId?.trim() || undefined;
  if (trimmedPage && trimmedScope && trimmedScope !== trimmedPage) {
    return {
      basePath: `${apiBase}/spaces/${encodeURIComponent(trimmedScope)}/files`,
      pageQuery: `pageId=${encodeURIComponent(trimmedPage)}`,
    };
  }
  const storeSpaceId = storeContext?.spaceId?.trim() || '';
  const storePageId = storeContext?.rootPageId?.trim() || '';
  if (trimmedPage && (!trimmedScope || (storeSpaceId && storeSpaceId !== trimmedPage))) {
    return {
      basePath: `${apiBase}/pages/${encodeURIComponent(trimmedPage)}/files`,
    };
  }
  if (!trimmedPage && trimmedScope && storePageId && trimmedScope === storePageId && storeSpaceId !== trimmedScope) {
    return {
      basePath: `${apiBase}/pages/${encodeURIComponent(trimmedScope)}/files`,
    };
  }
  return {
    basePath: `${apiBase}/spaces/${encodeURIComponent(trimmedScope || trimmedPage || '')}/files`,
    pageQuery: trimmedPage ? `pageId=${encodeURIComponent(trimmedPage)}` : undefined,
  };
}

export function buildFilestoreStreamUrl(
  projectIdOrPageId: string,
  fileId: string,
  pageId?: string,
  storeContext?: { spaceId?: string; rootPageId?: string },
): string {
  const { basePath, pageQuery } = resolveFilestoreCollectionRoute(
    PAGES_API_BASE,
    projectIdOrPageId,
    pageId,
    storeContext,
  );
  return `${basePath}/${encodeURIComponent(fileId)}${pageQuery ? `?${pageQuery}` : ''}`;
}
