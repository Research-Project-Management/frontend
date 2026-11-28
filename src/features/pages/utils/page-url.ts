import {
  buildPageScopeHref,
  type BuildPageEditorHrefOptions,
} from '@/features/editor';
import { copyToClipboard } from '@/shared/lib/utils';
import { toast } from 'sonner';
import type { Page } from '../types/page.types';

function extractEntityId(value?: string | { id?: string } | Record<string, unknown> | null): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value || null;
  if (typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    return value.id || null;
  }
  return null;
}

export async function copyPageLink(relativeHref: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const fullUrl = `${window.location.origin}${relativeHref}`;
  const ok = await copyToClipboard(fullUrl);
  if (ok) toast.success('Copied link');
  else toast.error('Copy failed');
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
