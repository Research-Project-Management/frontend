import type { Page } from '../types/page.types';

function extractEntityId(value?: string | { id?: string } | Record<string, unknown> | null): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value || null;
  if (typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    return value.id || null;
  }
  return null;
}

/**
 * Builds the canonical editor URL for a Page in either Personal Space (`/pages/:id`)
 * or Project Space (`/projects/:projectId/pages/:id`), preserving `?file=:mainFileId`.
 */
export function buildPageEditorHref(
  page: Pick<Page, 'id' | 'projectId' | 'mainFile' | 'mainFileId'>,
  routeProjectId?: string | null,
): string {
  const mainFileId = page.mainFileId || extractEntityId(page.mainFile);
  const fileQuery = mainFileId ? `?file=${mainFileId}` : '';
  const cleanRouteProjectId =
    routeProjectId && routeProjectId !== 'personal' ? routeProjectId : null;
  const pageProjectId = extractEntityId(page.projectId);
  const isPersonal = !cleanRouteProjectId || !pageProjectId || pageProjectId === 'personal';

  return isPersonal
    ? `/pages/${page.id}${fileQuery}`
    : `/projects/${cleanRouteProjectId}/pages/${page.id}${fileQuery}`;
}
