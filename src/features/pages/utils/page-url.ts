import {
  buildPageScopeHref,
  resolvePageScope,
  type BuildPageEditorHrefOptions,
  type PageEditorSubpath,
  type PageScope,
  type PageScopeInput,
  type PageSpaceKind,
} from '@/features/editor/core/coordinator/editor-scope';
import type { Page } from '../types/page.types';

export {
  resolvePageScope,
  buildPageScopeHref,
  type PageScope,
  type PageScopeInput,
  type PageSpaceKind,
  type PageEditorSubpath,
  type BuildPageEditorHrefOptions,
};

function extractEntityId(value?: string | { id?: string } | Record<string, unknown> | null): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value || null;
  if (typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    return value.id || null;
  }
  return null;
}

export function buildPageEditorHref(
  pageId: string,
  options?: BuildPageEditorHrefOptions,
): string;
export function buildPageEditorHref(
  page: Pick<Page, 'id' | 'projectId' | 'mainFile' | 'mainFileId'>,
  routeProjectId?: string | null,
): string;
export function buildPageEditorHref(
  pageOrId: string | Pick<Page, 'id' | 'projectId' | 'mainFile' | 'mainFileId'>,
  optionsOrRouteProjectId?: BuildPageEditorHrefOptions | string | null,
): string {
  if (typeof pageOrId === 'string') {
    const opts =
      typeof optionsOrRouteProjectId === 'object' && optionsOrRouteProjectId !== null
        ? optionsOrRouteProjectId
        : { projectId: optionsOrRouteProjectId };
    return buildPageScopeHref(pageOrId, opts);
  }

  const routeProjectId =
    typeof optionsOrRouteProjectId === 'string' ? optionsOrRouteProjectId : null;
  const mainFileId = pageOrId.mainFileId || extractEntityId(pageOrId.mainFile);
  const cleanRouteProjectId =
    routeProjectId && routeProjectId !== 'personal' ? routeProjectId : null;
  const pageProjectId = extractEntityId(pageOrId.projectId);
  const isPersonal = !cleanRouteProjectId || !pageProjectId || pageProjectId === 'personal';

  return buildPageScopeHref(pageOrId.id, {
    spaceKind: isPersonal ? 'personal' : 'project',
    projectId: isPersonal ? null : cleanRouteProjectId,
    fileId: mainFileId,
  });
}
